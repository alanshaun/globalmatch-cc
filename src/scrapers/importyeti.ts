/**
 * ImportYeti Scraper - Fetch-based (no Playwright)
 * Tries __NEXT_DATA__ extraction, falls back to regex
 */

import { COUNTRY_CODES } from "@/lib/constants";

export interface ImportYetiCompany {
  companyName: string;
  website: string;
  domain: string;
  shipmentCount: number;
  lastShipment: string | null;
  country: string;
  source: "importyeti";
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function extractDomain(url: string): string {
  try {
    const cleaned = url.startsWith("http") ? url : `https://${url}`;
    return new URL(cleaned).hostname.replace(/^www\./, "");
  } catch {
    return url.toLowerCase().replace(/^www\./, "");
  }
}

interface NextDataCompany {
  name?: string;
  companyName?: string;
  website?: string;
  domain?: string;
  shipmentCount?: number;
  lastShipmentDate?: string;
  lastShipment?: string;
}

function parseNextData(html: string): { companyName: string; website: string; shipmentCount: number; lastShipment: string | null }[] {
  try {
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) return [];
    const nextData = JSON.parse(match[1]);

    // Navigate common Next.js data paths
    const pageProps =
      nextData?.props?.pageProps ||
      nextData?.props?.initialProps ||
      {};

    // Try common keys where search results might live
    const candidates: NextDataCompany[] =
      pageProps?.searchResults ||
      pageProps?.companies ||
      pageProps?.results ||
      pageProps?.data?.companies ||
      pageProps?.data?.results ||
      [];

    if (!Array.isArray(candidates) || candidates.length === 0) return [];

    return candidates
      .filter((c) => c.companyName || c.name)
      .map((c) => ({
        companyName: (c.companyName || c.name || "").trim(),
        website: c.website || c.domain || "",
        shipmentCount: c.shipmentCount || 0,
        lastShipment: c.lastShipmentDate || c.lastShipment || null,
      }))
      .filter((c) => c.companyName);
  } catch {
    return [];
  }
}

function parseHtmlFallback(html: string): { companyName: string; website: string; shipmentCount: number; lastShipment: string | null }[] {
  const results: { companyName: string; website: string; shipmentCount: number; lastShipment: string | null }[] = [];

  // Look for JSON data blobs embedded in script tags
  const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
  for (const scriptMatch of scriptMatches) {
    const content = scriptMatch[1];
    if (!content.includes("companyName") && !content.includes("shipmentCount")) continue;
    try {
      // Try to extract array of objects
      const arrMatch = content.match(/\[[\s\S]{50,}\]/);
      if (!arrMatch) continue;
      const arr = JSON.parse(arrMatch[0]);
      if (!Array.isArray(arr)) continue;
      for (const item of arr) {
        if (item?.companyName || item?.name) {
          results.push({
            companyName: item.companyName || item.name || "",
            website: item.website || item.domain || "",
            shipmentCount: item.shipmentCount || item.count || 0,
            lastShipment: item.lastShipmentDate || item.lastShipment || null,
          });
        }
      }
      if (results.length > 0) break;
    } catch {
      continue;
    }
  }
  return results;
}

async function scrapeImportYeti(
  keyword: string,
  country: string
): Promise<ImportYetiCompany[]> {
  const countryCode = COUNTRY_CODES[country] || "US";
  const url = `https://www.importyeti.com/search?q=${encodeURIComponent(keyword)}&country=${countryCode}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    });

    if (!res.ok) return [];
    const html = await res.text();

    // Try __NEXT_DATA__ first
    let parsed = parseNextData(html);

    // Fall back to script tag JSON scanning
    if (parsed.length === 0) {
      parsed = parseHtmlFallback(html);
    }

    return parsed.map((c) => ({
      companyName: c.companyName,
      website: c.website,
      domain: c.website ? extractDomain(c.website) : "",
      shipmentCount: c.shipmentCount,
      lastShipment: c.lastShipment,
      country,
      source: "importyeti" as const,
    })).filter((c) => c.companyName && c.shipmentCount >= 1);
  } catch (err) {
    console.warn(
      `[ImportYeti] Failed for ${keyword} / ${country}:`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function scrapeImportYetiMultiCountry(
  keywords: string[],
  countries: string[]
): Promise<ImportYetiCompany[]> {
  const tasks = countries.flatMap((country) =>
    keywords.slice(0, 2).map((kw) => ({ keyword: kw, country }))
  );

  const results = await Promise.allSettled(
    tasks.map((t) => scrapeImportYeti(t.keyword, t.country))
  );

  const all: ImportYetiCompany[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }

  // Deduplicate by domain
  const seen = new Set<string>();
  return all.filter((c) => {
    if (!c.domain || seen.has(c.domain)) return false;
    seen.add(c.domain);
    return true;
  });
}
