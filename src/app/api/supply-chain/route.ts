/**
 * POST /api/supply-chain — Find suppliers/manufacturers
 *
 * V2.0 改动:
 *   - [修复] 查询方向：强制使用 manufacturer / factory / OEM 后缀
 *   - [引入] SearXNG 替代 SerpAPI + DDG
 *   - [引入] Cheerio 抓取官网文本，LLM 基于真实内容打分（终结"看域名算命"）
 *   - [零静默失败] 搜索层失败时返回明确错误
 *   - [Zod] 校验 LLM 输出格式
 */

import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { z } from "zod";
import { llmParseJSON } from "@/lib/llmClient";
import { searchViaSearXNG, buildSupplierQueries } from "@/scrapers/searxng";
import { COUNTRY_SEARCH_TERMS } from "@/lib/constants";

export const dynamic = "force-dynamic";

// ── Zod Schema ────────────────────────────────────────────────────────────────

const SupplierResultSchema = z.object({
  companyName: z.string().min(1),
  website: z.string(),
  domain: z.string(),
  country: z.string(),
  capability: z.string(),
  complianceScore: z.number().min(0).max(100),
  capabilityScore: z.number().min(0).max(100),
  commercialScore: z.number().min(0).max(100),
  overallScore: z.number().min(0).max(100),
  summary: z.string(),
  certifications: z.array(z.string()),
  minOrderQty: z.string(),
  leadTime: z.string(),
});

type SupplierResult = z.infer<typeof SupplierResultSchema>;

const SUPPLIER_FALLBACK = (domain: string): SupplierResult => ({
  companyName: domain,
  website: `https://${domain}`,
  domain,
  country: "Unknown",
  capability: "Unknown",
  complianceScore: 40,
  capabilityScore: 40,
  commercialScore: 40,
  overallScore: 40,
  summary: "分析失败，请手动访问官网确认。",
  certifications: [],
  minOrderQty: "TBD",
  leadTime: "TBD",
});

// ── Cheerio Website Scraper ───────────────────────────────────────────────────

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

async function scrapeSupplierPage(domain: string): Promise<string> {
  const pages = [
    `https://${domain}`,
    `https://${domain}/about`,
    `https://${domain}/products`,
  ];

  let combined = "";
  for (const url of pages) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "text/html" },
        signal: AbortSignal.timeout(8000),
        redirect: "follow",
      });
      if (!res.ok) continue;
      const html = await res.text();
      const $ = cheerio.load(html);
      // Remove noise
      $("script, style, nav, footer, header, .cookie, #cookie").remove();
      const text = $("body").text().replace(/\s{2,}/g, " ").trim();
      combined += `\n[${url}]\n${text.slice(0, 2000)}`;
    } catch {
      // skip this page
    }
  }
  return combined.slice(0, 5000);
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      need,
      region = "中国",
      quantity,
      budget,
      certifications = [],
      count = 10,
    } = body;

    if (!need?.trim()) {
      return NextResponse.json({ error: "need 参数不能为空" }, { status: 400 });
    }

    // Generate supplier-oriented search keywords via LLM
    const keywordsResult = await llmParseJSON<{ keywords: string[] }>(
      `Generate 5 English search queries to find MANUFACTURERS/SUPPLIERS (not buyers) for: "${need}"
Region: ${region}
Return JSON: { "keywords": ["query1", "query2", "query3", "query4", "query5"] }
Each query must suggest a MANUFACTURER or FACTORY, not an importer or distributor.`,
      "You generate B2B manufacturer search queries.",
      { keywords: [need, `${need} manufacturer`, `${need} factory`, `${need} OEM`, `${need} supplier`] }
    );

    const regionTerm = COUNTRY_SEARCH_TERMS[region] ?? region;
    const baseKeywords = keywordsResult.keywords.slice(0, 3);

    // Build queries using the SUPPLIER template (manufacturer / factory / OEM)
    const queries: string[] = [];
    for (const kw of baseKeywords) {
      queries.push(...buildSupplierQueries(kw, regionTerm));
    }

    // Search via SearXNG — throws on total failure
    let searchResults;
    try {
      searchResults = await searchViaSearXNG(queries.slice(0, 10), true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "搜索引擎不可用";
      return NextResponse.json(
        { error: `搜索失败: ${msg}`, suppliers: [] },
        { status: 503 }
      );
    }

    if (searchResults.length === 0) {
      return NextResponse.json(
        { error: "未找到相关供应商，请调整搜索词或地区", suppliers: [] },
        { status: 200 }
      );
    }

    const uniqueDomains = Array.from(
      new Set(searchResults.map((r) => r.domain).filter(Boolean))
    ).slice(0, count * 2);

    // Analyze each supplier using real website content (Cheerio sniffing)
    const suppliers: SupplierResult[] = [];
    const batchSize = 5;

    for (let i = 0; i < Math.min(uniqueDomains.length, count * 2); i += batchSize) {
      const batch = uniqueDomains.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(async (domain) => {
          // Sniff real website content first
          const pageContent = await scrapeSupplierPage(domain);

          const raw = await llmParseJSON<SupplierResult>(
            `You are evaluating whether this company can supply: "${need}"
Requirements: quantity=${quantity ?? "unspecified"}, budget=${budget ?? "unspecified"}, certifications=${certifications.join(",") || "none"}

REAL WEBSITE CONTENT (base your entire analysis on this, do NOT guess from domain name):
${pageContent || "Could not retrieve website content — score lower on capability confidence."}

Domain: ${domain}

Score based on what you actually read above. If content is empty or irrelevant, give low scores.

Return JSON:
{
  "companyName": "exact name from website or domain",
  "website": "https://${domain}",
  "domain": "${domain}",
  "country": "country inferred from website",
  "capability": "what they actually manufacture based on website",
  "complianceScore": 0-100,
  "capabilityScore": 0-100,
  "commercialScore": 0-100,
  "overallScore": 0-100,
  "summary": "2-sentence assessment citing specific website evidence",
  "certifications": ["certifications found on website"],
  "minOrderQty": "MOQ found on website or TBD",
  "leadTime": "lead time found or TBD"
}`,
            "You evaluate B2B manufacturers based on their real website content.",
            SUPPLIER_FALLBACK(domain)
          );

          // Zod validation
          const validated = SupplierResultSchema.safeParse(raw);
          suppliers.push(validated.success ? validated.data : SUPPLIER_FALLBACK(domain));
        })
      );

      if (suppliers.length >= count) break;
    }

    suppliers.sort((a, b) => b.overallScore - a.overallScore);

    return NextResponse.json({ suppliers: suppliers.slice(0, count) });
  } catch (err) {
    console.error("[/api/supply-chain]", err);
    return NextResponse.json(
      { error: "服务器错误，请稍后重试", suppliers: [] },
      { status: 500 }
    );
  }
}
