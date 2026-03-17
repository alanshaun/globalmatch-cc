/**
 * Supplier Weakness Radar
 * 三路并发：SerpAPI投诉搜索 + Google News过滤 + 招聘页Sourcing Manager检测
 * 输出结构化弱点信号，帮助用户判断切入时机
 */

import { parseStringPromise } from "xml2js";
import { llmParseJSON } from "@/lib/llmClient";

export interface WeaknessSignal {
  type: "quality" | "delivery" | "price" | "service" | "compliance";
  description: string;
  source: "google" | "news" | "hiring";
  confidence: "high" | "medium" | "low";
}

export interface SupplierWeaknessResult {
  hasWeaknessSignal: boolean;
  signals: WeaknessSignal[];
  opportunitySummary: string;
}

const EMPTY_RESULT: SupplierWeaknessResult = {
  hasWeaknessSignal: false,
  signals: [],
  opportunitySummary: "",
};

// Source 1: SerpAPI — search for complaint/problem/issue mentions
async function searchSupplierComplaints(companyName: string): Promise<string[]> {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) return [];

  const queries = [
    `"${companyName}" supplier complaint`,
    `"${companyName}" supplier problem`,
    `"${companyName}" sourcing issue`,
  ];

  const snippets: string[] = [];

  await Promise.allSettled(
    queries.map(async (q) => {
      try {
        const params = new URLSearchParams({
          api_key: apiKey,
          engine: "google",
          q,
          num: "5",
          hl: "en",
        });
        const res = await fetch(`https://serpapi.com/search?${params}`, {
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return;
        const data = await res.json();
        for (const item of data.organic_results || []) {
          if (item.snippet) snippets.push(item.snippet);
          if (item.title) snippets.push(item.title);
        }
      } catch {
        // SerpAPI not available, skip
      }
    })
  );

  return snippets;
}

// Source 2: Google News RSS — filter for supplier-switch/replace/complaint items
async function fetchSupplierNewsSignals(companyName: string): Promise<string[]> {
  try {
    const query = encodeURIComponent(
      `"${companyName}" supplier switch OR replace OR complaint OR "supply chain problem"`
    );
    const url = `https://news.google.com/rss/search?q=${query}&hl=en&gl=US&ceid=US:en`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const parsed = await parseStringPromise(xml, { explicitArray: false });
    const items = parsed?.rss?.channel?.item;
    if (!items) return [];

    const itemList = Array.isArray(items) ? items : [items];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 180);

    const lines: string[] = [];
    for (const item of itemList) {
      const pubDate = item.pubDate ? new Date(item.pubDate) : null;
      if (pubDate && pubDate < cutoff) continue;
      const title = item.title || "";
      const lower = title.toLowerCase();
      if (
        lower.includes("supplier") ||
        lower.includes("supply chain") ||
        lower.includes("sourcing") ||
        lower.includes("procurement") ||
        lower.includes("switch") ||
        lower.includes("replace") ||
        lower.includes("complaint")
      ) {
        lines.push(title);
      }
    }
    return lines.slice(0, 5);
  } catch {
    return [];
  }
}

// Source 3: Job page — check for "Sourcing Manager" specifically
async function checkSourcingManagerHiring(domain: string): Promise<boolean> {
  const hiringUrls = [
    `https://${domain}/careers`,
    `https://${domain}/jobs`,
    `https://${domain}/join-us`,
  ];

  // Keywords that specifically indicate supplier relationship restructuring
  const sourcingManagerKw = [
    "sourcing manager",
    "head of sourcing",
    "director of sourcing",
    "global sourcing",
    "strategic sourcing",
    "supply chain manager",
    "vendor manager",
  ];

  for (const url of hiringUrls) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(6000),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      if (!res.ok) continue;
      const html = (await res.text()).toLowerCase();
      if (sourcingManagerKw.some((kw) => html.includes(kw))) return true;
    } catch {
      continue;
    }
  }
  return false;
}

export async function detectSupplierWeakness(
  companyName: string,
  domain: string
): Promise<SupplierWeaknessResult> {
  try {
    // Three parallel sources
    const [serpSnippets, newsLines, hiringSignal] = await Promise.allSettled([
      searchSupplierComplaints(companyName),
      fetchSupplierNewsSignals(companyName),
      checkSourcingManagerHiring(domain),
    ]);

    const googleSnippets =
      serpSnippets.status === "fulfilled" ? serpSnippets.value : [];
    const newsItems =
      newsLines.status === "fulfilled" ? newsLines.value : [];
    const hasSourcingHiring =
      hiringSignal.status === "fulfilled" ? hiringSignal.value : false;

    // Early exit: no signals at all, skip LLM call
    if (googleSnippets.length === 0 && newsItems.length === 0 && !hasSourcingHiring) {
      return EMPTY_RESULT;
    }

    // Build context for LLM
    const context = [
      googleSnippets.length > 0
        ? `[Google Search Snippets]\n${googleSnippets.slice(0, 8).join("\n")}`
        : "",
      newsItems.length > 0
        ? `[Recent News Headlines]\n${newsItems.join("\n")}`
        : "",
      hasSourcingHiring
        ? `[Hiring Signal]\nCompany is actively recruiting for Sourcing Manager / Strategic Sourcing roles — indicates supplier relationship restructuring.`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const prompt = `
Analyze the following data about "${companyName}" and identify if there are real signals of supplier weakness or dissatisfaction.
Return ONLY valid JSON, no markdown.

Data:
${context}

Rules:
- Only report signals with actual evidence in the data above
- Do NOT invent signals not supported by the text
- If data is generic and unrelated to supplier issues, return hasWeaknessSignal: false

Return this exact JSON:
{
  "hasWeaknessSignal": true or false,
  "signals": [
    {
      "type": "quality" | "delivery" | "price" | "service" | "compliance",
      "description": "specific description in Chinese (1-2 sentences)",
      "source": "google" | "news" | "hiring",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "opportunitySummary": "one sentence in Chinese: how a new supplier can break in (only if hasWeaknessSignal is true, else empty string)"
}`;

    const result = await llmParseJSON<SupplierWeaknessResult>(
      prompt,
      "You analyze B2B supplier relationship signals. Be evidence-based, not speculative.",
      EMPTY_RESULT
    );

    // Validate: if LLM hallucinates signals without evidence, return empty
    if (!result.hasWeaknessSignal || !Array.isArray(result.signals) || result.signals.length === 0) {
      return EMPTY_RESULT;
    }

    return {
      hasWeaknessSignal: result.hasWeaknessSignal,
      signals: result.signals.slice(0, 4),
      opportunitySummary: result.opportunitySummary || "",
    };
  } catch (err) {
    console.warn("[SupplierWeakness] Failed:", err instanceof Error ? err.message : err);
    return EMPTY_RESULT;
  }
}
