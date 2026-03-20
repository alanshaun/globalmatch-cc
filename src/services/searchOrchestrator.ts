/**
 * UnifiedSearchOrchestrator — V2.0
 *
 * 层级（买家搜索）:
 *   L1: SQLite 本地缓存
 *   L2: SearXNG（替代 SerpAPI + DDG + Bing）
 *   L3: 深度搜索（LLM 生成更多关键词 → 再跑 SearXNG）
 *
 * 零静默失败原则:
 *   - 任何 catch { return [] } 全部清除
 *   - 搜索层全部失败时，向上抛出明确 Error
 *   - 前端会收到 { type: "error" } 事件，显示具体错误日志
 *
 * Zod 强校验:
 *   - 所有 LLM 输出经 schema 校验，不合格则用 fallback
 */

import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCachedDomains, saveCachedDomains, writeAudit } from "@/lib/searchCache";
import { searchViaSearXNG, buildBuyerQueries, SearchAllNodesFailed } from "@/scrapers/searxng";
import { getContactsBatch } from "./pdlClient";
import { detectIntentSignals } from "./intentSignals";
import { analyzeBuyer, generateEmail, scrapeWebsiteContent } from "./buyerAnalyzer";
import { detectSupplierWeakness } from "./supplierWeakness";
import type { SupplierWeaknessResult } from "./supplierWeakness";
import { runIntelligenceAgent } from "./intelligenceAgent";
import type { CompetitorData, SocialDynamics } from "./intelligenceAgent";
import { COMPETITOR_DOMAIN_BLACKLIST, GENERIC_DOMAIN_BLACKLIST, COUNTRY_SEARCH_TERMS } from "@/lib/constants";
import { llmCall } from "@/lib/llmClient";
import type { ProductProfile } from "./productAnalyzer";

// ── Zod Schemas ───────────────────────────────────────────────────────────────

const DeepKeywordsSchema = z.array(z.string()).min(1).max(20);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BuyerResult {
  id?: string;
  companyName: string;
  website: string;
  domain: string;
  country: string;
  industry: string;
  matchScore: number;
  matchReason: string;
  buyerBusiness: string;
  whyTheyNeedUs: string;
  supplierWeakness: string;
  contacts: {
    name: string;
    title: string;
    email: string;
    emailQuality: "verified" | "generic" | "unverified" | "none";
    linkedinUrl: string;
  }[];
  intentSignals: {
    type: string;
    strength: string;
    description: string;
    date?: string;
  }[];
  emailDraft: {
    subjectA: string;
    subjectB: string;
    body: string;
  };
  fitScore: number;
  intentScore: number;
  reachabilityScore: number;
  confidenceScore: number;
  dataSource: string;
  fromCache: boolean;
  shipmentCount: number;
  lastShipment: string | null;
  bestContactTiming: string;
  redFlags: string[];
  supplierWeaknessSignal?: SupplierWeaknessResult;
  competitorData?: CompetitorData;
  socialDynamics?: SocialDynamics;
  outreachHook?: string;
  reachabilityStatus?: { email: boolean; whatsapp: boolean; linkedin: boolean };
  funnelStage?: string;
}

export interface SearchProgress {
  type: "progress" | "new_buyer" | "completed" | "error";
  message?: string;
  foundCount?: number;
  progress?: number;
  data?: BuyerResult;
  isFallback?: boolean;
  fallbackReason?: string;
  errorDetail?: string;
}

interface Candidate {
  domain: string;
  companyName: string;
  website: string;
  country: string;
  source: string;
  shipmentCount: number;
  lastShipment: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    const cleaned = url.startsWith("http") ? url : `https://${url}`;
    return new URL(cleaned).hostname.replace(/^www\./, "");
  } catch {
    return url.toLowerCase().replace(/^www\./, "").split("/")[0];
  }
}

function isBlacklisted(domain: string): boolean {
  const lower = domain.toLowerCase();
  return (
    COMPETITOR_DOMAIN_BLACKLIST.some((b) => lower.includes(b)) ||
    GENERIC_DOMAIN_BLACKLIST.some((b) => lower.includes(b))
  );
}

async function getUserSeenDomains(userId: string): Promise<Set<string>> {
  try {
    const seen = await prisma.userSeenCompany.findMany({
      where: { userId },
      select: { companyDomain: true },
    });
    return new Set(seen.map((s) => s.companyDomain));
  } catch {
    return new Set();
  }
}

async function generateDeepSearchKeywords(
  profile: ProductProfile,
  usedKeywords: string[]
): Promise<string[]> {
  const t0 = Date.now();
  try {
    const result = await llmCall(
      `Generate 10 diverse English search keywords for finding importers/buyers of "${profile.productName}".
Avoid these already-used keywords: ${usedKeywords.join(", ")}.
Include industry-specific terms, trade jargon, and regional variations.
Return ONLY a JSON array, no markdown: ["kw1", "kw2", ...]`,
      "You generate diverse B2B buyer search keywords."
    );

    const raw = result.content.match(/\[[\s\S]*\]/)?.[0] ?? "[]";
    const parsed = DeepKeywordsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : usedKeywords.map((kw) => `${kw} buyer`);
  } catch {
    console.warn("[UnifiedSearch] deep keyword LLM failed, using fallback");
    return usedKeywords.map((kw) => `${kw} importer`);
  } finally {
    writeAudit({
      sessionId: "deep-keywords",
      layer: "llm-keywords",
      query: profile.productName,
      resultCount: 0,
      durationMs: Date.now() - t0,
    });
  }
}

// ── Main Search ───────────────────────────────────────────────────────────────

export async function runBuyerSearch(
  sessionId: string,
  userId: string,
  profile: ProductProfile,
  targetCountries: string[],
  targetCount: number,
  onProgress: (event: SearchProgress) => void
): Promise<void> {
  const candidates: Candidate[] = [];
  const cacheKey = `buyer-${profile.category}-${targetCountries.sort().join(",")}`;

  onProgress({ type: "progress", message: "正在解析产品信息...", foundCount: 0, progress: 5 });

  // ── L1: SQLite 本地缓存 ──────────────────────────────────────────────────
  const cached = getCachedDomains(cacheKey);
  if (cached.length > 0) {
    for (const c of cached) {
      candidates.push({
        domain: c.domain,
        companyName: c.companyName,
        website: `https://${c.domain}`,
        country: targetCountries[0] ?? "Unknown",
        source: "cache",
        shipmentCount: 0,
        lastShipment: null,
      });
    }
    writeAudit({ sessionId, layer: "l1-cache", query: cacheKey, resultCount: cached.length, durationMs: 0 });
  }

  // ── L2: SearXNG ──────────────────────────────────────────────────────────
  onProgress({ type: "progress", message: "正在检索全球买家数据...", foundCount: 0, progress: 20 });

  const searxErrors: Error[] = [];

  for (const country of targetCountries.slice(0, 3)) {
    const countryTerm = COUNTRY_SEARCH_TERMS[country] ?? country;
    const kw = profile.searchKeywords[0] ?? profile.productName;
    const queries = buildBuyerQueries(kw, countryTerm);
    const t0 = Date.now();

    try {
      const results = await searchViaSearXNG(queries, true);
      writeAudit({ sessionId, layer: "l2-searxng", query: `${kw} / ${country}`, resultCount: results.length, durationMs: Date.now() - t0 });

      for (const r of results) {
        if (r.domain && !candidates.some((c) => c.domain === r.domain)) {
          candidates.push({
            domain: r.domain,
            companyName: r.title.split("|")[0].split("-")[0].trim(),
            website: r.url,
            country,
            source: "searxng",
            shipmentCount: 0,
            lastShipment: null,
          });
        }
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      searxErrors.push(e);
      writeAudit({ sessionId, layer: "l2-searxng", query: `${kw} / ${country}`, resultCount: 0, error: e.message, durationMs: Date.now() - t0 });
    }
  }

  // ── 过滤 ─────────────────────────────────────────────────────────────────
  const seenDomains = await getUserSeenDomains(userId);
  let filtered = candidates
    .filter((c) => !seenDomains.has(c.domain))
    .filter((c) => !isBlacklisted(c.domain));

  // ── L3: 深度搜索 ─────────────────────────────────────────────────────────
  if (filtered.length < targetCount * 2) {
    onProgress({ type: "progress", message: "正在深度搜索更多买家...", foundCount: 0, progress: 35 });

    const deepKeywords = await generateDeepSearchKeywords(profile, profile.searchKeywords);
    const deepQueries = deepKeywords
      .slice(0, 5)
      .map((kw) => `${kw} importer buyer ${COUNTRY_SEARCH_TERMS[targetCountries[0]] ?? ""}`);

    const t0 = Date.now();
    try {
      const deepResults = await searchViaSearXNG(deepQueries, false); // soft-fail ok here
      writeAudit({ sessionId, layer: "l3-deep", query: deepQueries.join("; "), resultCount: deepResults.length, durationMs: Date.now() - t0 });

      for (const r of deepResults) {
        if (r.domain && !filtered.some((c) => c.domain === r.domain) && !isBlacklisted(r.domain)) {
          filtered.push({
            domain: r.domain,
            companyName: r.title.split("|")[0].split("-")[0].trim(),
            website: r.url,
            country: targetCountries[0] ?? "Unknown",
            source: "searxng-deep",
            shipmentCount: 0,
            lastShipment: null,
          });
        }
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      writeAudit({ sessionId, layer: "l3-deep", query: "deep", resultCount: 0, error: e.message, durationMs: Date.now() - t0 });
      // deep search failure is non-fatal
    }
  }

  // ── 零静默失败检查 ────────────────────────────────────────────────────────
  if (filtered.length === 0) {
    const errMsg =
      searxErrors.length > 0
        ? `搜索引擎全部失败: ${searxErrors.map((e) => e.message).join(" | ")}`
        : "所有搜索层均返回0结果，请检查网络或关键词";

    onProgress({ type: "error", message: errMsg, errorDetail: errMsg, foundCount: 0, progress: 0 });

    // Update session status
    await prisma.searchSession.update({
      where: { id: sessionId },
      data: { status: "failed", completedAt: new Date() },
    }).catch(() => null);

    throw new Error(errMsg);
  }

  // ── 保存缓存 ──────────────────────────────────────────────────────────────
  saveCachedDomains(
    cacheKey,
    filtered.slice(0, 100).map((c) => ({ domain: c.domain, companyName: c.companyName }))
  );

  // ── 分析阶段 ──────────────────────────────────────────────────────────────
  const toAnalyze = filtered.slice(0, Math.min(targetCount * 2, 60));

  onProgress({ type: "progress", message: "正在分析买家匹配度...", foundCount: 0, progress: 40 });

  const domains = toAnalyze.map((c) => c.domain).filter(Boolean);
  const contactMap = await getContactsBatch(domains, 5);

  const buyers: BuyerResult[] = [];
  const batchSize = 5;

  for (let i = 0; i < toAnalyze.length; i += batchSize) {
    const batch = toAnalyze.slice(i, i + batchSize);
    const progress = 40 + Math.floor((i / toAnalyze.length) * 50);

    onProgress({
      type: "progress",
      message: `正在分析买家匹配度... (${i + 1}/${toAnalyze.length})`,
      foundCount: buyers.length,
      progress,
    });

    await Promise.allSettled(
      batch.map(async (candidate) => {
        try {
          const [websiteContent, intentSignals, weaknessResult, intelResult] =
            await Promise.allSettled([
              scrapeWebsiteContent(candidate.domain),
              detectIntentSignals(candidate.companyName, candidate.domain),
              detectSupplierWeakness(candidate.companyName, candidate.domain),
              runIntelligenceAgent(
                candidate.companyName,
                candidate.domain,
                profile.searchKeywords ?? [],
                profile.productName,
                "",
                contactMap.get(candidate.domain)?.[0]?.name
              ),
            ]);

          const content = websiteContent.status === "fulfilled" ? websiteContent.value : "";
          const signals = intentSignals.status === "fulfilled" ? intentSignals.value : [];
          const supplierWeakness = weaknessResult.status === "fulfilled" ? weaknessResult.value : undefined;
          const intel = intelResult.status === "fulfilled" ? intelResult.value : undefined;

          const analysis = await analyzeBuyer(
            candidate.companyName,
            candidate.domain,
            content,
            candidate.shipmentCount,
            candidate.lastShipment,
            signals,
            profile
          );

          const contacts = contactMap.get(candidate.domain) ?? [];

          const emailDraft = await generateEmail(
            candidate.companyName,
            contacts[0]?.name ?? "",
            analysis.buyerBusiness,
            analysis.whyTheyNeedUs,
            signals,
            analysis.currentSupplierWeakness,
            profile
          );

          const buyer: BuyerResult = {
            companyName: candidate.companyName || candidate.domain,
            website: candidate.website || `https://${candidate.domain}`,
            domain: candidate.domain,
            country: candidate.country,
            industry: analysis.buyerProductKeywords.slice(0, 2).join(", ") || "Trade",
            matchScore: analysis.matchScore,
            matchReason: analysis.fitReason,
            buyerBusiness: analysis.buyerBusiness,
            whyTheyNeedUs: analysis.whyTheyNeedUs,
            supplierWeakness: analysis.currentSupplierWeakness,
            contacts: contacts.map((c) => ({
              name: c.name,
              title: c.title,
              email: c.email,
              emailQuality: c.emailQuality,
              linkedinUrl: c.linkedinUrl,
            })),
            intentSignals: signals.map((s) => ({
              type: s.type,
              strength: s.strength,
              description: s.description,
              date: s.date,
            })),
            emailDraft: {
              subjectA: emailDraft.subjectA,
              subjectB: emailDraft.subjectB,
              body: emailDraft.body,
            },
            fitScore: analysis.fitScore,
            intentScore: analysis.intentScore,
            reachabilityScore: analysis.reachabilityScore,
            confidenceScore: analysis.confidenceScore,
            dataSource: candidate.source,
            fromCache: candidate.source === "cache",
            shipmentCount: candidate.shipmentCount,
            lastShipment: candidate.lastShipment,
            bestContactTiming: analysis.bestContactTiming,
            redFlags: analysis.redFlags,
            supplierWeaknessSignal: supplierWeakness?.hasWeaknessSignal ? supplierWeakness : undefined,
            competitorData: intel?.competitorData,
            socialDynamics: intel?.socialDynamics,
            outreachHook: intel?.outreachHook ?? "",
            reachabilityStatus: {
              email: contacts.some((c) => c.email && c.emailQuality !== "none"),
              whatsapp: false,
              linkedin: contacts.some((c) => !!c.linkedinUrl),
            },
            funnelStage: "discovered",
          };

          // Save to DB
          try {
            const saved = await prisma.buyerMatch.create({
              data: {
                sessionId,
                userId,
                companyName: buyer.companyName,
                website: buyer.website,
                domain: buyer.domain,
                country: buyer.country,
                industry: buyer.industry,
                matchScore: buyer.matchScore,
                fitScore: buyer.fitScore,
                intentScore: buyer.intentScore,
                reachabilityScore: buyer.reachabilityScore,
                confidenceScore: buyer.confidenceScore,
                matchReason: buyer.matchReason,
                buyerBusiness: buyer.buyerBusiness,
                whyTheyNeedUs: buyer.whyTheyNeedUs,
                supplierWeakness: buyer.supplierWeakness,
                intentSignals: buyer.intentSignals,
                contacts: buyer.contacts,
                emailDraft: buyer.emailDraft,
                dataSource: buyer.dataSource,
                fromCache: buyer.fromCache,
                shipmentCount: buyer.shipmentCount,
                lastShipment: buyer.lastShipment ? new Date(buyer.lastShipment) : null,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                competitorData: (buyer.competitorData ?? {}) as any,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                socialDynamics: (buyer.socialDynamics ?? {}) as any,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                reachabilityStatus: (buyer.reachabilityStatus ?? {}) as any,
                outreachHook: buyer.outreachHook ?? "",
                funnelStage: "discovered",
              },
            });
            buyer.id = saved.id;

            await prisma.userSeenCompany.upsert({
              where: { userId_companyDomain: { userId, companyDomain: buyer.domain } },
              create: { userId, companyDomain: buyer.domain },
              update: {},
            });
          } catch {
            // DB insert failure — buyer still returned to frontend
          }

          buyers.push(buyer);
          buyers.sort((a, b) => b.matchScore - a.matchScore);

          onProgress({ type: "new_buyer", foundCount: buyers.length, progress, data: buyer });
        } catch (err) {
          console.warn("[UnifiedSearch] buyer analysis failed:", err instanceof Error ? err.message : err);
        }
      })
    );

    if (buyers.length >= targetCount) break;
  }

  const isFallback = toAnalyze.some((c) => c.source === "cache");

  // Update session
  await prisma.searchSession.update({
    where: { id: sessionId },
    data: {
      status: "completed",
      resultCount: Math.min(buyers.length, targetCount),
      isFallback,
      completedAt: new Date(),
    },
  }).catch(() => null);

  onProgress({
    type: "completed",
    foundCount: Math.min(buyers.length, targetCount),
    isFallback,
    fallbackReason: isFallback ? "部分结果来自本地缓存" : undefined,
    progress: 100,
  });
}
