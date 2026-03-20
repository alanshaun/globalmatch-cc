/**
 * Background Job Runner
 * Executes search jobs server-side, independent of client connection.
 * Uses in-memory jobStore — works with or without DB.
 */

import { updateJob } from "./jobStore";
import { prisma } from "./db";
import { llmParseJSON } from "./llmClient";
import { searchViaSearXNG, buildSupplierQueries } from "@/scrapers/searxng";
import { COUNTRY_SEARCH_TERMS } from "./constants";
import { analyzeProduct } from "@/services/productAnalyzer";
import { runBuyerSearch } from "@/services/searchOrchestrator";

// Keep promise references alive so GC doesn't kill them
const activeJobs = new Map<string, Promise<void>>();

async function runBuyerJob(
  jobId: string,
  input: {
    productName: string;
    productDescription: string;
    targetCountries: string[];
    targetCount: number;
    userId: string;
  }
) {
  try {
    updateJob(jobId, { status: "running", progress: 5, message: "正在解析产品信息..." });

    const rawInput = [input.productName, input.productDescription].filter(Boolean).join("\n");
    const profile = await analyzeProduct(rawInput);

    await prisma.user
      .upsert({
        where: { id: input.userId },
        create: { id: input.userId, email: `${input.userId}@globalmatch.local`, name: "Demo User" },
        update: {},
      })
      .catch(() => {});

    const sellerProfile = await prisma.sellerProfile
      .create({
        data: {
          userId: input.userId,
          productName: profile.productName || input.productName,
          productDescription: profile.productDescription,
          hsCode: profile.hsCode,
          category: profile.category,
          pricePositioning: profile.pricePositioning,
          certifications: profile.certifications,
          coreAdvantages: profile.coreAdvantages,
          rawInputType: "text",
          rawInputContent: rawInput,
          searchKeywords: profile.searchKeywords,
        },
      })
      .catch(() => ({ id: `profile-${Date.now()}` }));

    const session = await prisma.searchSession
      .create({
        data: {
          userId: input.userId,
          sellerProfileId: sellerProfile.id,
          targetCountries: input.targetCountries,
          targetCount: input.targetCount,
          status: "pending",
        },
      })
      .catch(() => ({ id: `session-${Date.now()}` }));

    updateJob(jobId, {
      sessionId: session.id,
      progress: 10,
      message: "产品分析完成，开始全网搜索买家...",
    });

    let foundCount = 0;

    await runBuyerSearch(
      session.id,
      input.userId,
      profile,
      input.targetCountries,
      input.targetCount,
      (event) => {
        if (event.type === "progress") {
          updateJob(jobId, {
            progress: Math.max(10, Math.min(95, event.progress || 0)),
            message: event.message || "搜索中...",
          });
        } else if (event.type === "new_buyer") {
          foundCount = event.foundCount || foundCount + 1;
          updateJob(jobId, {
            progress: Math.max(10, Math.min(95, event.progress || 50)),
            message: `已找到 ${foundCount} 家买家，继续搜索...`,
          });
        } else if (event.type === "completed") {
          foundCount = event.foundCount || foundCount;
        }
      }
    ).catch((err) => {
      console.error("[JobRunner:buyer] runBuyerSearch error:", err);
    });

    updateJob(jobId, {
      status: "completed",
      progress: 100,
      message: `搜索完成，找到 ${foundCount} 家匹配买家`,
      output: { foundCount, sessionId: session.id },
      completedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[JobRunner:buyer]", err);
    updateJob(jobId, {
      status: "failed",
      error: String(err),
      message: "搜索遇到问题，请重试",
      completedAt: new Date().toISOString(),
    });
  }
}

async function runRadarJob(
  jobId: string,
  input: {
    capability: string;
    markets: string[];
    capacity?: string;
    priceRange?: string;
    certifications?: string[];
    exportExp?: string;
    competitors?: string;
  }
) {
  try {
    updateJob(jobId, { status: "running", progress: 10, message: "AI正在分析全球市场机会..." });

    const result = await llmParseJSON<{ recommendations: unknown[] }>(
      `You are a B2B export consultant. Analyze this factory and recommend export product categories.

Factory capability: "${input.capability}"
Target export markets: ${input.markets.join(", ")}
Monthly capacity: ${input.capacity || "Not specified"}
Price range: ${input.priceRange || "Not specified"}
Certifications: ${(input.certifications || []).join(", ") || "None"}
Export experience: ${input.exportExp || "Not specified"}
Competitors: ${input.competitors || "Not specified"}

Based on current market demand and competition, recommend 6-8 product categories.
Consider: market demand trends, competition intensity, entry barriers, margin potential.

Return ONLY this JSON (no markdown):
{
  "recommendations": [
    {
      "category": "product category name",
      "hsCode": "6-digit HS code",
      "stars": 1-5,
      "marketHeat": [6 monthly trend values 0-100 for last 6 months],
      "competitionLevel": "低|中|高",
      "recommendation": "值得做|太卷|时机未到",
      "analysis": "consultant-tone analysis paragraph, specific and actionable",
      "reasoning": "key data points supporting the recommendation",
      "entryBarrier": "main barrier to entry",
      "typicalBuyer": "typical buyer profile"
    }
  ]
}`,
      "You are an expert B2B export market analyst.",
      { recommendations: [] }
    );

    updateJob(jobId, {
      status: "completed",
      progress: 100,
      message: `分析完成，找到 ${result.recommendations?.length || 0} 个品类机会`,
      output: result,
      completedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[JobRunner:radar]", err);
    updateJob(jobId, {
      status: "failed",
      error: String(err),
      message: "分析遇到问题，请重试",
      completedAt: new Date().toISOString(),
    });
  }
}

async function runSupplyChainJob(
  jobId: string,
  input: {
    need: string;
    region: string;
    quantity?: string;
    budget?: string;
    certifications?: string[];
    count?: number;
  }
) {
  try {
    updateJob(jobId, { status: "running", progress: 10, message: "正在生成搜索关键词..." });

    const count = input.count || 10;

    const keywordsResult = await llmParseJSON<{ keywords: string[] }>(
      `Generate 5 English search queries to find suppliers/manufacturers for: "${input.need}"
      Region preference: ${input.region}
      Return JSON: { "keywords": ["query1", "query2", "query3", "query4", "query5"] }`,
      "You generate B2B supplier search queries.",
      { keywords: [input.need, `${input.need} manufacturer`, `${input.need} factory`, `${input.need} supplier`] }
    );
    const queries = (keywordsResult?.keywords ?? []).filter(Boolean).slice(0, 5);
    const safeQueries = queries.length > 0
      ? queries
      : [input.need, `${input.need} manufacturer`, `${input.need} supplier`, `${input.need} factory`];
    console.log(`[关键词生成] 状态：成功 | generatedBy：${keywordsResult.generatedBy} | 关键词数：${safeQueries.length} | 关键词：${JSON.stringify(safeQueries)}`);

    updateJob(jobId, { progress: 25, message: "正在全网搜索供应商..." });

    const regionTerm = COUNTRY_SEARCH_TERMS[input.region] || "China";
    // Build supplier-oriented queries (manufacturer / factory / OEM)
    const supplierQueries: string[] = [];
    for (const kw of safeQueries.slice(0, 3)) {
      supplierQueries.push(...buildSupplierQueries(kw, regionTerm));
    }
    console.log(`[搜索构建] region：${input.region} | regionTerm：${regionTerm} | queries：${JSON.stringify(supplierQueries.slice(0, 3))}`);

    const allDomains: string[] = [];
    try {
      const searxResults = await searchViaSearXNG(supplierQueries.slice(0, 10), true);
      console.log(`[SearXNG] 状态：成功 | 获取原始结果：${searxResults.length} 条 | 示例域名：${searxResults.slice(0,3).map(r=>r.domain).join(", ") || "无"}`);
      allDomains.push(...searxResults.map((r) => r.domain));
    } catch (err) {
      console.error(`[SearXNG] 状态：失败 | 原因：${err instanceof Error ? err.message : err}`);
      // Propagate to outer catch — zero silent failures
      throw err;
    }

    const uniqueDomains = Array.from(new Set(allDomains)).slice(0, count * 2);
    console.log(`[去重] 原始域名总数：${allDomains.length} | 去重后候选：${uniqueDomains.length} | 目标数量：${count}`);
    updateJob(jobId, { progress: 40, message: `找到 ${uniqueDomains.length} 个候选，开始AI评估...` });

    interface SupplierResult {
      companyName: string; website: string; domain: string; country: string;
      capability: string; complianceScore: number; capabilityScore: number;
      commercialScore: number; overallScore: number; summary: string;
      certifications: string[]; minOrderQty: string; leadTime: string;
    }

    const suppliers: SupplierResult[] = [];
    const batchSize = 5;

    if (uniqueDomains.length === 0) {
      console.log(`[LLM分析] 跳过：没有候选域名可分析，直接输出0家`);
    }
    for (let i = 0; i < Math.min(uniqueDomains.length, count * 2); i += batchSize) {
      const batch = uniqueDomains.slice(i, i + batchSize);
      console.log(`[LLM分析批次${Math.floor(i/batchSize)+1}] 分析域名：${JSON.stringify(batch)}`);
      await Promise.allSettled(
        batch.map(async (domain) => {
          const analysis = await llmParseJSON<SupplierResult>(
            `Analyze this potential supplier for: "${input.need}"
            Domain: ${domain}
            Requirements: quantity=${input.quantity}, budget=${input.budget}, certifications=${(input.certifications || []).join(",")}
            Return JSON: {
              "companyName":"company name or domain","website":"https://${domain}","domain":"${domain}",
              "country":"estimated country","capability":"what they manufacture",
              "complianceScore":50,"capabilityScore":50,"commercialScore":50,"overallScore":50,
              "summary":"2-sentence assessment","certifications":[],"minOrderQty":"TBD","leadTime":"TBD"
            }`,
            "You assess B2B suppliers.",
            { companyName: domain, website: `https://${domain}`, domain, country: "Unknown",
              capability: input.need, complianceScore: 50, capabilityScore: 50,
              commercialScore: 50, overallScore: 50, summary: "Pending", certifications: [],
              minOrderQty: "TBD", leadTime: "TBD" }
          );
          console.log(`[LLM分析] 域名：${domain} | generatedBy：${analysis.generatedBy} | overallScore：${analysis.overallScore} | companyName：${analysis.companyName}`);
          suppliers.push(analysis);
        })
      );
      updateJob(jobId, {
        progress: Math.min(90, 40 + Math.round(((i + batchSize) / (count * 2)) * 50)),
        message: `已分析 ${suppliers.length} 家供应商...`,
      });
      if (suppliers.length >= count) break;
    }

    suppliers.sort((a, b) => b.overallScore - a.overallScore);
    const final = suppliers.slice(0, count);
    console.log(`[最终输出] 分析总数：${suppliers.length} | 输出数量：${final.length} | 分数分布：${final.map(s=>s.overallScore).join(", ")}`);

    updateJob(jobId, {
      status: "completed",
      progress: 100,
      message: `搜索完成，找到 ${final.length} 家供应商`,
      output: { suppliers: final },
      completedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[JobRunner:supply-chain]", err);
    updateJob(jobId, {
      status: "failed",
      error: String(err),
      message: "搜索遇到问题，请重试",
      completedAt: new Date().toISOString(),
    });
  }
}

export function startJob(jobId: string, type: string, input: unknown) {
  let promise: Promise<void>;

  if (type === "buyer") {
    promise = runBuyerJob(jobId, input as Parameters<typeof runBuyerJob>[1]);
  } else if (type === "radar") {
    promise = runRadarJob(jobId, input as Parameters<typeof runRadarJob>[1]);
  } else if (type === "supply-chain") {
    promise = runSupplyChainJob(jobId, input as Parameters<typeof runSupplyChainJob>[1]);
  } else {
    return;
  }

  activeJobs.set(jobId, promise);
  promise
    .catch((err) => console.error(`[JobRunner] Job ${jobId} failed:`, err))
    .finally(() => activeJobs.delete(jobId));
}
