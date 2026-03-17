/**
 * Intent Signal Detection - Google News RSS + Job Postings
 */

import { parseStringPromise } from "xml2js";

export interface IntentSignal {
  type:
    | "funding"
    | "product_launch"
    | "supplier_change"
    | "hiring"
    | "hiring_procurement"
    | "expansion";
  strength: "high" | "medium" | "low";
  description: string;
  date?: string;
  url?: string;
}

async function fetchGoogleNewsRSS(companyName: string): Promise<IntentSignal[]> {
  try {
    const query = encodeURIComponent(`"${companyName}" sourcing OR procurement OR supplier`);
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
    const signals: IntentSignal[] = [];

    // Filter to last 90 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    for (const item of itemList) {
      const title = (item.title || "").toLowerCase();
      const pubDate = item.pubDate ? new Date(item.pubDate) : null;

      if (pubDate && pubDate < cutoff) continue;

      let signal: IntentSignal | null = null;

      if (title.includes("funding") || title.includes("raised") || title.includes("investment") || title.includes("series")) {
        signal = {
          type: "funding",
          strength: "high",
          description: item.title,
          date: item.pubDate,
          url: item.link,
        };
      } else if (title.includes("new product") || title.includes("launch") || title.includes("expand")) {
        signal = {
          type: "product_launch",
          strength: "high",
          description: item.title,
          date: item.pubDate,
          url: item.link,
        };
      } else if (title.includes("supplier") || title.includes("sourcing") || title.includes("procurement")) {
        signal = {
          type: "supplier_change",
          strength: "medium",
          description: item.title,
          date: item.pubDate,
          url: item.link,
        };
      } else if (title.includes("hiring") || title.includes("recruitment")) {
        signal = {
          type: "hiring",
          strength: "medium",
          description: item.title,
          date: item.pubDate,
          url: item.link,
        };
      }

      if (signal) signals.push(signal);
    }

    return signals.slice(0, 3);
  } catch (err) {
    console.warn("[NewsRSS] Failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

async function checkHiringPage(domain: string): Promise<IntentSignal[]> {
  const hiringUrls = [
    `https://${domain}/careers`,
    `https://${domain}/jobs`,
    `https://${domain}/join-us`,
    `https://${domain}/work-with-us`,
  ];

  const procurementKeywords = [
    "procurement",
    "sourcing",
    "purchasing",
    "buying",
    "supply chain",
    "vendor",
    "supplier",
  ];

  for (const url of hiringUrls) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (!res.ok) continue;
      const html = await res.text();
      const lowerHtml = html.toLowerCase();

      const found = procurementKeywords.some((kw) => lowerHtml.includes(kw));
      if (found) {
        return [
          {
            type: "hiring_procurement",
            strength: "high",
            description: `Actively hiring for procurement/sourcing roles (${url})`,
            url,
          },
        ];
      }
    } catch {
      continue;
    }
  }

  return [];
}

export async function detectIntentSignals(
  companyName: string,
  domain: string
): Promise<IntentSignal[]> {
  const [newsSignals, hiringSignals] = await Promise.allSettled([
    fetchGoogleNewsRSS(companyName),
    checkHiringPage(domain),
  ]);

  const signals: IntentSignal[] = [
    ...(newsSignals.status === "fulfilled" ? newsSignals.value : []),
    ...(hiringSignals.status === "fulfilled" ? hiringSignals.value : []),
  ];

  // Sort: high strength first, then hiring_procurement first
  return signals.sort((a, b) => {
    const strengthOrder = { high: 0, medium: 1, low: 2 };
    const typeOrder = { hiring_procurement: 0, funding: 1, product_launch: 2, expansion: 2, supplier_change: 3, hiring: 4 };
    if (strengthOrder[a.strength] !== strengthOrder[b.strength]) {
      return strengthOrder[a.strength] - strengthOrder[b.strength];
    }
    return typeOrder[a.type] - typeOrder[b.type];
  });
}
