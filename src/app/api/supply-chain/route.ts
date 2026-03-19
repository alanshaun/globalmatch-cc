/**
 * POST /api/supply-chain - Find suppliers
 */

import { NextRequest, NextResponse } from "next/server";
import { llmParseJSON } from "@/lib/llmClient";
import { searchViaSerpAPI } from "@/scrapers/serpapi";
import { searchViaDDG } from "@/scrapers/ddg";
import { COUNTRY_SEARCH_TERMS } from "@/lib/constants";

export const dynamic = "force-dynamic";

interface SupplierResult {
  companyName: string;
  website: string;
  domain: string;
  country: string;
  capability: string;
  complianceScore: number;
  capabilityScore: number;
  commercialScore: number;
  overallScore: number;
  summary: string;
  certifications: string[];
  minOrderQty: string;
  leadTime: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { need, region = "中国优先", quantity, budget, certifications = [], count = 10 } = body;

    // Generate search keywords
    const keywordsResult = await llmParseJSON<{ keywords: string[] }>(
      `Generate 5 English search queries to find suppliers/manufacturers for: "${need}"
      Region preference: ${region}
      Return JSON: { "keywords": ["query1", "query2", "query3", "query4", "query5"] }`,
      "You generate B2B supplier search queries.",
      { keywords: [need, `${need} manufacturer`, `${need} factory`, `${need} supplier`] }
    );

    const queries = keywordsResult.keywords.slice(0, 5);
    const regionTerm = COUNTRY_SEARCH_TERMS[region] || "China";
    const fullQueries = queries.map((q) => `${q} ${regionTerm} manufacturer`);

    // Search
    const [serpResults, ddgResults] = await Promise.allSettled([
      searchViaSerpAPI(need, queries, [region], COUNTRY_SEARCH_TERMS),
      searchViaDDG(fullQueries.slice(0, 3)),
    ]);

    const allDomains: string[] = [];
    if (serpResults.status === "fulfilled") {
      allDomains.push(...serpResults.value.map((r) => r.domain));
    }
    if (ddgResults.status === "fulfilled") {
      allDomains.push(...ddgResults.value.map((r) => r.domain));
    }

    const uniqueDomains = Array.from(new Set(allDomains)).slice(0, count * 2);

    // Analyze each supplier
    const suppliers: SupplierResult[] = [];
    const batchSize = 5;

    for (let i = 0; i < Math.min(uniqueDomains.length, count * 2); i += batchSize) {
      const batch = uniqueDomains.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(async (domain) => {
          const analysis = await llmParseJSON<SupplierResult>(
            `Analyze this potential supplier for: "${need}"
            Domain: ${domain}
            Requirements: quantity=${quantity}, budget=${budget}, certifications=${certifications.join(",")}

            Return JSON:
            {
              "companyName": "company name or domain",
              "website": "https://${domain}",
              "domain": "${domain}",
              "country": "estimated country",
              "capability": "what they can manufacture",
              "complianceScore": 0-100,
              "capabilityScore": 0-100,
              "commercialScore": 0-100,
              "overallScore": 0-100,
              "summary": "2-sentence assessment",
              "certifications": ["likely certifications"],
              "minOrderQty": "estimated MOQ",
              "leadTime": "estimated lead time"
            }`,
            "You assess B2B suppliers for export businesses.",
            {
              companyName: domain,
              website: `https://${domain}`,
              domain,
              country: "Unknown",
              capability: need,
              complianceScore: 50,
              capabilityScore: 50,
              commercialScore: 50,
              overallScore: 50,
              summary: "Supplier analysis pending",
              certifications: [],
              minOrderQty: "TBD",
              leadTime: "TBD",
            }
          );
          suppliers.push(analysis);
        })
      );

      if (suppliers.length >= count) break;
    }

    suppliers.sort((a, b) => b.overallScore - a.overallScore);

    return NextResponse.json({ suppliers: suppliers.slice(0, count) });
  } catch (err) {
    console.error("[/api/supply-chain]", err);
    return NextResponse.json({ error: "Search failed", suppliers: [] }, { status: 500 });
  }
}
