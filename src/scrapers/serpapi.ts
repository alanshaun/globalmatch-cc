/**
 * SerpAPI Scraper - Paid, reliable Google search results
 */

import { COUNTRY_CODES } from "@/lib/constants";

export interface SerpResult {
  domain: string;
  title: string;
  url: string;
  snippet: string;
  source: "serpapi";
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function buildSearchQueries(
  productName: string,
  productKeywords: string[],
  country: string,
  countrySearchTerm: string
): string[] {
  const kw = productKeywords[0] || productName;
  return [
    `${kw} importer distributor ${countrySearchTerm}`,
    `${kw} wholesale buyer ${countrySearchTerm}`,
    `buy ${kw} bulk ${countrySearchTerm} company`,
    `${kw} procurement ${countrySearchTerm}`,
    `${kw} B2B supplier wanted ${countrySearchTerm}`,
    `site:linkedin.com ${kw} purchasing manager ${countrySearchTerm}`,
    `${kw} trade company ${countrySearchTerm} import`,
  ];
}

async function searchOneSerpQuery(
  query: string,
  gl: string
): Promise<SerpResult[]> {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) return [];

  const params = new URLSearchParams({
    api_key: apiKey,
    engine: "google",
    q: query,
    num: "20",
    gl,
    hl: "en",
  });

  const res = await fetch(`https://serpapi.com/search?${params}`, {
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    console.warn(`[SerpAPI] Failed query "${query}": ${res.status}`);
    return [];
  }

  const data = await res.json();
  const results: SerpResult[] = [];

  for (const item of data.organic_results || []) {
    const domain = extractDomain(item.link || "");
    if (domain) {
      results.push({
        domain,
        title: item.title || "",
        url: item.link || "",
        snippet: item.snippet || "",
        source: "serpapi",
      });
    }
  }

  return results;
}

export async function searchViaSerpAPI(
  productName: string,
  searchKeywords: string[],
  countries: string[],
  countrySearchTerms: Record<string, string>
): Promise<SerpResult[]> {
  const allResults: SerpResult[] = [];

  for (const country of countries.slice(0, 3)) {
    const gl = COUNTRY_CODES[country] || "US";
    const searchTerm = countrySearchTerms[country] || country;
    const queries = buildSearchQueries(
      productName,
      searchKeywords,
      country,
      searchTerm
    );

    // Run all queries concurrently
    const queryResults = await Promise.allSettled(
      queries.map((q) => searchOneSerpQuery(q, gl))
    );

    for (const r of queryResults) {
      if (r.status === "fulfilled") allResults.push(...r.value);
    }

    // Small delay between countries
    if (countries.indexOf(country) < countries.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Deduplicate by domain
  const seen = new Set<string>();
  return allResults.filter((r) => {
    if (!r.domain || seen.has(r.domain)) return false;
    seen.add(r.domain);
    return true;
  });
}
