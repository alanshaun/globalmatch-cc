/**
 * DuckDuckGo HTML Scraper - Free fallback
 */

export interface DDGResult {
  domain: string;
  title: string;
  url: string;
  snippet: string;
  source: "ddg";
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function randomDelay(min = 800, max = 1500): Promise<void> {
  return new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
}

async function searchDDGQuery(query: string): Promise<DDGResult[]> {
  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        signal: AbortSignal.timeout(12000),
      }
    );

    if (!res.ok) return [];
    const html = await res.text();

    // Parse results from HTML
    const results: DDGResult[] = [];
    const resultPattern =
      /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi;
    const snippetPattern = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>(.*?)<\/a>/gi;

    const titles: { url: string; title: string }[] = [];
    let match;
    while ((match = resultPattern.exec(html)) !== null) {
      const url = match[1];
      const title = match[2].replace(/<[^>]+>/g, "").trim();
      if (url.startsWith("http") && !url.includes("duckduckgo.com")) {
        titles.push({ url, title });
      }
    }

    const snippets: string[] = [];
    while ((match = snippetPattern.exec(html)) !== null) {
      snippets.push(match[1].replace(/<[^>]+>/g, "").trim());
    }

    titles.forEach((t, i) => {
      const domain = extractDomain(t.url);
      if (domain) {
        results.push({
          domain,
          title: t.title,
          url: t.url,
          snippet: snippets[i] || "",
          source: "ddg",
        });
      }
    });

    return results.slice(0, 20);
  } catch (err) {
    console.warn(
      "[DDG] Query failed:",
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function searchViaDDG(
  queries: string[]
): Promise<DDGResult[]> {
  const allResults: DDGResult[] = [];

  for (const query of queries) {
    const results = await searchDDGQuery(query);
    allResults.push(...results);
    // Random delay between queries
    if (queries.indexOf(query) < queries.length - 1) {
      await randomDelay(800, 1500);
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return allResults.filter((r) => {
    if (!r.domain || seen.has(r.domain)) return false;
    seen.add(r.domain);
    return true;
  });
}
