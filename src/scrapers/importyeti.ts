/**
 * ImportYeti Scraper - Free, high-signal customs data
 * URL: https://www.importyeti.com/search?q={keyword}&country={country}
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

function extractDomain(url: string): string {
  try {
    const cleaned = url.startsWith("http") ? url : `https://${url}`;
    return new URL(cleaned).hostname.replace(/^www\./, "");
  } catch {
    return url.toLowerCase().replace(/^www\./, "");
  }
}

async function scrapeImportYeti(
  keyword: string,
  country: string
): Promise<ImportYetiCompany[]> {
  const countryCode = COUNTRY_CODES[country] || "US";
  const url = `https://www.importyeti.com/search?q=${encodeURIComponent(keyword)}&country=${countryCode}`;

  try {
    // Dynamic import to avoid edge runtime issues
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });

    // Wait for search results to load
    try {
      await page.waitForSelector("[class*='company']", { timeout: 8000 });
    } catch {
      // Results may use different selectors
    }

    const companies = await page.evaluate(() => {
      const results: {
        companyName: string;
        website: string;
        shipmentCount: number;
        lastShipment: string | null;
      }[] = [];

      // Try multiple selector patterns
      const rows =
        document.querySelectorAll(
          "[data-testid='company-row'], .company-row, [class*='CompanyRow'], [class*='company-item']"
        ) ||
        document.querySelectorAll("tr[class*='row']") ||
        document.querySelectorAll(".result-item");

      rows.forEach((row) => {
        const nameEl =
          row.querySelector("[class*='company-name'], h3, h4, .name, td:first-child") ||
          row.querySelector("a[href*='/company/']");
        const companyName = nameEl?.textContent?.trim() || "";

        const websiteEl = row.querySelector(
          "a[href^='http']:not([href*='importyeti'])"
        );
        const website = (websiteEl as HTMLAnchorElement)?.href || "";

        // Extract shipment count
        const shipmentText =
          row.querySelector("[class*='shipment'], [class*='count']")?.textContent ||
          "";
        const shipmentMatch = shipmentText.match(/(\d+(?:,\d+)*)/);
        const shipmentCount = shipmentMatch
          ? parseInt(shipmentMatch[1].replace(/,/g, ""))
          : 0;

        const lastShipmentEl = row.querySelector("[class*='date'], time");
        const lastShipment = lastShipmentEl?.textContent?.trim() || null;

        if (companyName && shipmentCount >= 2) {
          results.push({ companyName, website, shipmentCount, lastShipment });
        }
      });

      return results;
    });

    await browser.close();

    return companies.map((c) => ({
      ...c,
      domain: c.website ? extractDomain(c.website) : "",
      country,
      source: "importyeti" as const,
    }));
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
