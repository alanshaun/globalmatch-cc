/**
 * SearXNG Scraper — replaces SerpAPI + DDG + Bing
 *
 * 使用公开 SearXNG 节点，内置 3 次重试 + 指数退避。
 * 零静默失败原则：所有节点均失败时，必须抛出 Error，不允许返回 []。
 */

export interface SearXNGResult {
  domain: string;
  title: string;
  url: string;
  snippet: string;
  source: "searxng";
}

// Public SearXNG instances — ordered by reliability
// Rotate through them on retry
const PUBLIC_NODES = [
  "https://searx.be",
  "https://search.sapti.me",
  "https://searx.tiekoetter.com",
  "https://searxng.site",
  "https://search.bus-hit.me",
];

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Search one query against a single SearXNG node.
 * Returns raw results or throws.
 */
async function searchOneNode(
  baseUrl: string,
  query: string
): Promise<SearXNGResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    categories: "general",
    language: "en",
    safesearch: "0",
  });

  const res = await fetch(`${baseUrl}/search?${params}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    throw new Error(`SearXNG node ${baseUrl} returned HTTP ${res.status}`);
  }

  const data = await res.json();
  const results: SearXNGResult[] = [];

  for (const item of data.results ?? []) {
    const domain = extractDomain(item.url ?? "");
    if (domain) {
      results.push({
        domain,
        title: item.title ?? "",
        url: item.url ?? "",
        snippet: item.content ?? "",
        source: "searxng",
      });
    }
  }

  return results;
}

/**
 * Search one query with retry across multiple nodes.
 * Throws SearchAllNodesFailed if every attempt fails.
 */
export class SearchAllNodesFailed extends Error {
  constructor(query: string, causes: Error[]) {
    super(
      `[SearXNG] All nodes failed for query "${query}". ` +
        `Errors: ${causes.map((e) => e.message).join(" | ")}`
    );
    this.name = "SearchAllNodesFailed";
  }
}

async function searchWithRetry(query: string): Promise<SearXNGResult[]> {
  const errors: Error[] = [];

  for (let attempt = 0; attempt < PUBLIC_NODES.length; attempt++) {
    const node = PUBLIC_NODES[attempt % PUBLIC_NODES.length];
    try {
      const results = await searchOneNode(node, query);
      // At least 1 result = success
      if (results.length > 0) return results;
      // 0 results from this node: try next, but don't count as hard error
    } catch (err) {
      errors.push(err instanceof Error ? err : new Error(String(err)));
      // Exponential backoff: 1s, 2s, 4s
      if (attempt < PUBLIC_NODES.length - 1) {
        await sleep(1000 * Math.pow(2, attempt));
      }
    }
  }

  // All nodes either failed or returned 0 results
  if (errors.length > 0) {
    throw new SearchAllNodesFailed(query, errors);
  }

  // All nodes returned 0 results — not an error, just no data
  return [];
}

/**
 * Run multiple queries concurrently.
 *
 * @param queries - List of search queries
 * @param throwOnAllFail - If true, throws if ALL queries fail (default: true)
 */
export async function searchViaSearXNG(
  queries: string[],
  throwOnAllFail = true
): Promise<SearXNGResult[]> {
  if (queries.length === 0) return [];

  const settled = await Promise.allSettled(
    queries.map((q) => searchWithRetry(q))
  );

  const allResults: SearXNGResult[] = [];
  const errors: Error[] = [];

  for (const r of settled) {
    if (r.status === "fulfilled") {
      allResults.push(...r.value);
    } else {
      errors.push(r.reason instanceof Error ? r.reason : new Error(String(r.reason)));
    }
  }

  // Zero results AND all queries failed → throw
  if (throwOnAllFail && allResults.length === 0 && errors.length === queries.length) {
    throw new SearchAllNodesFailed(
      `${queries.length} queries`,
      errors
    );
  }

  // Deduplicate by domain
  const seen = new Set<string>();
  return allResults.filter((r) => {
    if (!r.domain || seen.has(r.domain)) return false;
    seen.add(r.domain);
    return true;
  });
}

/**
 * Build buyer-finding queries (importer / distributor / wholesaler)
 */
export function buildBuyerQueries(
  keyword: string,
  countryTerm: string
): string[] {
  return [
    `${keyword} importer distributor ${countryTerm}`,
    `${keyword} wholesale buyer ${countryTerm}`,
    `buy ${keyword} bulk ${countryTerm} company`,
    `${keyword} procurement ${countryTerm}`,
    `${keyword} B2B supplier wanted ${countryTerm}`,
  ];
}

/**
 * Build supplier-finding queries (manufacturer / factory / OEM)
 * NOTE: These are intentionally DIFFERENT from buyer queries.
 */
export function buildSupplierQueries(
  keyword: string,
  regionTerm: string
): string[] {
  return [
    `${keyword} manufacturer factory ${regionTerm}`,
    `${keyword} OEM supplier ${regionTerm}`,
    `${keyword} production company ${regionTerm}`,
    `${keyword} wholesale supplier ${regionTerm}`,
    `${keyword} B2B manufacturer China OEM`,
  ];
}
