/**
 * Intelligence Agent
 *
 * Upgrades buyer research from "web scraper" to "field intelligence agent".
 * Runs three parallel missions per buyer:
 *   1. CompetitorIntel  — find who they currently buy from (customs + web)
 *   2. SupplierWeakness — why that supplier is vulnerable right now
 *   3. SocialDynamics   — decision-maker public posts / LinkedIn signals
 *
 * Synthesises findings into one punchy outreach "Hook" sentence.
 */

import { llmParseJSON, llmCall } from "@/lib/llmClient";
import { parseStringPromise } from "xml2js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CompetitorInfo {
  name: string;
  country: string;
  estimatedShare: string; // "dominant" | "partial" | "unknown"
  source: "customs" | "web" | "inferred";
  notes: string;
}

export interface CompetitorData {
  suppliers: CompetitorInfo[];
  primarySupplier: string; // best guess at main supplier name
  dataConfidence: "high" | "medium" | "low";
}

export interface SocialPost {
  author: string;
  title: string;
  summary: string;
  date?: string;
  url?: string;
  relevance: "high" | "medium" | "low";
}

export interface SocialDynamics {
  posts: SocialPost[];
  keyThemes: string[]; // e.g. ["cost pressure", "quality issues", "expansion"]
  lastUpdated: string;
}

export interface IntelligenceResult {
  competitorData: CompetitorData;
  socialDynamics: SocialDynamics;
  outreachHook: string; // 1-sentence personalised hook for the email
}

// ── Competitor Intelligence ───────────────────────────────────────────────────

/**
 * Searches customs data + general web to find who currently supplies this buyer.
 */
async function researchCompetitors(
  companyName: string,
  domain: string,
  productKeywords: string[]
): Promise<CompetitorData> {
  const empty: CompetitorData = {
    suppliers: [],
    primarySupplier: "Unknown",
    dataConfidence: "low",
  };

  try {
    const snippets: string[] = [];

    // [V1.0 REMOVED] ImportYeti company page fetch — 依赖HTML结构，易崩溃
    // Phase 2 将用 SearXNG 替代
    // const importYetiUrl = `https://www.importyeti.com/company/...`;

    // Google News: search for "[company] supplier" or "[company] manufacturer"
    const productKw = productKeywords.slice(0, 2).join(" ");
    const newsQuery = encodeURIComponent(`"${companyName}" supplier OR manufacturer ${productKw}`);
    const newsUrl = `https://news.google.com/rss/search?q=${newsQuery}&hl=en&gl=US&ceid=US:en`;

    try {
      const res = await fetch(newsUrl, {
        signal: AbortSignal.timeout(8000),
        headers: { Accept: "application/rss+xml" },
      });
      if (res.ok) {
        const xml = await res.text();
        const parsed = await parseStringPromise(xml, { explicitArray: false });
        const items = parsed?.rss?.channel?.item ?? [];
        const itemList = Array.isArray(items) ? items : [items];
        for (const item of itemList.slice(0, 6)) {
          if (item?.title) snippets.push(`News: ${item.title}`);
          if (item?.description) snippets.push(`News desc: ${item.description}`);
        }
      }
    } catch {
      // skip
    }

    if (snippets.length === 0) return empty;

    const prompt = `
You are a trade intelligence analyst. Based on the following data about "${companyName}", identify who their current suppliers/manufacturers are.
Return ONLY valid JSON, no markdown.

Data:
${snippets.slice(0, 15).join("\n")}

Return this exact JSON:
{
  "suppliers": [
    {
      "name": "supplier company name",
      "country": "country of origin",
      "estimatedShare": "dominant|partial|unknown",
      "source": "customs|web|inferred",
      "notes": "brief note about this supplier relationship"
    }
  ],
  "primarySupplier": "best guess at the main supplier name, or 'Unknown'",
  "dataConfidence": "high|medium|low"
}

Rules:
- Only include suppliers with real evidence in the data
- Max 4 suppliers
- If no clear suppliers found, return empty suppliers array and primarySupplier: "Unknown"`;

    return await llmParseJSON<CompetitorData>(
      prompt,
      "You are a trade intelligence analyst identifying supplier relationships.",
      empty
    );
  } catch (err) {
    console.warn("[IntelAgent] competitor research failed:", err instanceof Error ? err.message : err);
    return empty;
  }
}

// ── Social Dynamics ───────────────────────────────────────────────────────────

/**
 * Searches Google News and LinkedIn-like signals for decision-maker activity.
 */
async function fetchSocialDynamics(
  companyName: string,
  decisionMakerName?: string
): Promise<SocialDynamics> {
  const empty: SocialDynamics = {
    posts: [],
    keyThemes: [],
    lastUpdated: new Date().toISOString(),
  };

  try {
    const posts: SocialPost[] = [];
    const queries = [
      `"${companyName}" sourcing OR procurement OR "supply chain" site:linkedin.com`,
      decisionMakerName
        ? `"${decisionMakerName}" "${companyName}" supplier OR sourcing`
        : `"${companyName}" CEO OR CPO OR "procurement director" sourcing`,
    ].filter(Boolean);

    for (const query of queries) {
      const encoded = encodeURIComponent(query);
      const url = `https://news.google.com/rss/search?q=${encoded}&hl=en&gl=US&ceid=US:en`;
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(7000),
          headers: { Accept: "application/rss+xml" },
        });
        if (!res.ok) continue;
        const xml = await res.text();
        const parsed = await parseStringPromise(xml, { explicitArray: false });
        const items = parsed?.rss?.channel?.item ?? [];
        const itemList = Array.isArray(items) ? items : [items];

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 60); // last 60 days only

        for (const item of itemList.slice(0, 5)) {
          const pubDate = item.pubDate ? new Date(item.pubDate) : null;
          if (pubDate && pubDate < cutoff) continue;

          const title = (item.title || "") as string;
          const lowerTitle = title.toLowerCase();

          let relevance: "high" | "medium" | "low" = "low";
          if (
            lowerTitle.includes("sourcing") ||
            lowerTitle.includes("supplier") ||
            lowerTitle.includes("procurement") ||
            lowerTitle.includes("supply chain") ||
            lowerTitle.includes("funding") ||
            lowerTitle.includes("expansion")
          ) {
            relevance = "high";
          } else if (
            lowerTitle.includes("growth") ||
            lowerTitle.includes("partnership") ||
            lowerTitle.includes("launch")
          ) {
            relevance = "medium";
          }

          posts.push({
            author: decisionMakerName || companyName,
            title,
            summary: title,
            date: item.pubDate || undefined,
            url: item.link || undefined,
            relevance,
          });
        }
      } catch {
        continue;
      }
    }

    if (posts.length === 0) return empty;

    // Extract themes via LLM
    const titlesText = posts.map((p) => p.title).join("\n");
    const themePrompt = `
Based on these news headlines about "${companyName}", extract 2-4 key business themes relevant to a supplier pitching to them.
Return ONLY a JSON array of short theme strings (max 6 words each), e.g. ["cost pressure", "supply chain restructure"].
No markdown, no code blocks.

Headlines:
${titlesText}`;

    let keyThemes: string[] = [];
    try {
      const raw = await llmCall(themePrompt, "Extract business intelligence themes.");
      keyThemes = JSON.parse(raw.content.replace(/```json|```/g, "").trim());
      if (!Array.isArray(keyThemes)) keyThemes = [];
    } catch {
      keyThemes = [];
    }

    return {
      posts: posts.slice(0, 8),
      keyThemes: keyThemes.slice(0, 4),
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("[IntelAgent] social dynamics failed:", err instanceof Error ? err.message : err);
    return empty;
  }
}

// ── Outreach Hook Builder ─────────────────────────────────────────────────────

/**
 * Synthesises competitor + social data into a single punchy hook sentence
 * that the email writer can use as the opening line.
 */
async function buildOutreachHook(
  companyName: string,
  competitorData: CompetitorData,
  socialDynamics: SocialDynamics,
  productName: string,
  whyTheyNeedUs: string
): Promise<string> {
  const competitorContext =
    competitorData.primarySupplier !== "Unknown"
      ? `Current main supplier: ${competitorData.primarySupplier}. Weaknesses: ${
          competitorData.suppliers
            .map((s) => s.notes)
            .filter(Boolean)
            .join("; ") || "none identified"
        }`
      : "Current supplier: unknown";

  const socialContext =
    socialDynamics.posts.length > 0
      ? `Recent signals: ${socialDynamics.posts
          .filter((p) => p.relevance === "high")
          .slice(0, 2)
          .map((p) => p.title)
          .join("; ")}`
      : "";

  const themes =
    socialDynamics.keyThemes.length > 0
      ? `Key themes: ${socialDynamics.keyThemes.join(", ")}`
      : "";

  if (!competitorContext && !socialContext && !themes) {
    return "";
  }

  const prompt = `
Write ONE punchy opening sentence for a B2B cold email to ${companyName}.

Context:
- We sell: ${productName}
- Why they need us: ${whyTheyNeedUs}
- ${competitorContext}
- ${socialContext}
- ${themes}

Requirements:
- Exactly 1 sentence (max 25 words)
- Must reference a SPECIFIC fact from the context (supplier name, news, or theme)
- DO NOT start with "I", "We", "Our", or generic phrases
- Make the buyer feel you did your homework
- Write in English

Return ONLY the sentence, no quotes, no explanation.`;

  try {
    const result = await llmCall(prompt, "You write razor-sharp B2B email opening lines.");
    const hook = result.content.trim().replace(/^["']|["']$/g, "");
    return hook;
  } catch {
    return "";
  }
}

// ── Main Export ───────────────────────────────────────────────────────────────

export async function runIntelligenceAgent(
  companyName: string,
  domain: string,
  productKeywords: string[],
  productName: string,
  whyTheyNeedUs: string,
  topContactName?: string
): Promise<IntelligenceResult> {
  const [competitorResult, socialResult] = await Promise.allSettled([
    researchCompetitors(companyName, domain, productKeywords),
    fetchSocialDynamics(companyName, topContactName),
  ]);

  const competitorData: CompetitorData =
    competitorResult.status === "fulfilled"
      ? competitorResult.value
      : { suppliers: [], primarySupplier: "Unknown", dataConfidence: "low" };

  const socialDynamics: SocialDynamics =
    socialResult.status === "fulfilled"
      ? socialResult.value
      : { posts: [], keyThemes: [], lastUpdated: new Date().toISOString() };

  const outreachHook = await buildOutreachHook(
    companyName,
    competitorData,
    socialDynamics,
    productName,
    whyTheyNeedUs
  );

  return { competitorData, socialDynamics, outreachHook };
}
