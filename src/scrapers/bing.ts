/**
 * Bing Search API - Free 1000/month
 */

export interface BingResult {
  domain: string;
  title: string;
  url: string;
  snippet: string;
  source: "bing";
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function searchBingQuery(query: string): Promise<BingResult[]> {
  const apiKey = process.env.BING_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch(
      `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=20&mkt=en-US`,
      {
        headers: {
          "Ocp-Apim-Subscription-Key": apiKey,
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) return [];
    const data = await res.json();

    return (data.webPages?.value || []).map(
      (item: { url: string; name: string; snippet: string }) => ({
        domain: extractDomain(item.url),
        title: item.name || "",
        url: item.url || "",
        snippet: item.snippet || "",
        source: "bing" as const,
      })
    );
  } catch (err) {
    console.warn(
      "[Bing] Query failed:",
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function searchViaBing(queries: string[]): Promise<BingResult[]> {
  const allResults: BingResult[] = [];

  // Run queries with concurrency limit
  const batchSize = 3;
  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(searchBingQuery));
    for (const r of results) {
      if (r.status === "fulfilled") allResults.push(...r.value);
    }
  }

  const seen = new Set<string>();
  return allResults.filter((r) => {
    if (!r.domain || seen.has(r.domain)) return false;
    seen.add(r.domain);
    return true;
  });
}
