/**
 * Search Orchestrator - 5-layer fallback system (V1.0 MVP)
 * [REMOVED L1: ImportYeti — 极易因HTML变动崩溃，Phase 2 用 SearXNG 替代]
 * L2: SerpAPI → L3: DDG → L4: Bing → L5: Cache
 * Never returns empty, never shows "search failed"
 */

import { prisma } from "@/lib/db";
// [V1.0 REMOVED] import { scrapeImportYetiMultiCountry } from "@/scrapers/importyeti";
import { searchViaSerpAPI } from "@/scrapers/serpapi";
import { searchViaDDG } from "@/scrapers/ddg";
import { searchViaBing } from "@/scrapers/bing";
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
  // Intelligence Agent fields
  competitorData?: CompetitorData;
  socialDynamics?: SocialDynamics;
  outreachHook?: string;
  reachabilityStatus?: { email: boolean; whatsapp: boolean; linkedin: boolean };
  funnelStage?: string;
}

interface AuditLog {
  // l1_importyeti removed in V1.0 MVP
  l2_serpapi?: number;
  l3_ddg?: number;
  l4_bing?: number;
  l5_cache?: number;
  after_dedup?: number;
  after_user_filter?: number;
  after_competitor_filter?: number;
  pdl_enriched?: number;
  no_contact?: number;
  after_analysis?: number;
  final_output?: number;
  avg_score?: number;
}

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

function buildSearchQueries(
  profile: ProductProfile,
  countries: string[]
): string[] {
  const queries: string[] = [];
  const kw = profile.searchKeywords[0] || profile.productName;

  for (const country of countries.slice(0, 2)) {
    const term = COUNTRY_SEARCH_TERMS[country] || country;
    queries.push(
      `${kw} importer distributor ${term}`,
      `${kw} wholesale buyer ${term}`,
      `buy ${kw} bulk ${term} company`
    );
  }
  return queries;
}

async function getFromCache(
  cacheKey: string
): Promise<{ domain: string; companyName: string }[]> {
  try {
    const cache = await prisma.searchCache.findFirst({
      where: {
        cacheKey,
        expiresAt: { gt: new Date() },
      },
    });
    if (cache) return cache.results as { domain: string; companyName: string }[];
  } catch {
    // DB not available
  }
  return [];
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
  existingKeywords: string[]
): Promise<string[]> {
  const result = await llmCall(
    `Generate 10 diverse English search keywords for finding importers/buyers of "${profile.productName}".
    Avoid these already-used keywords: ${existingKeywords.join(", ")}.
    Include industry-specific terms, trade jargon, and regional variations.
    Return as JSON array only: ["kw1", "kw2", ...]`,
    "You generate diverse B2B buyer search keywords."
  );

  try {
    const parsed = JSON.parse(result.content.match(/\[[\s\S]*\]/)?.[0] || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return existingKeywords.map((kw) => `${kw} supplier wanted`);
  }
}

export interface SearchProgress {
  type: "progress" | "new_buyer" | "completed" | "error";
  message?: string;
  foundCount?: number;
  progress?: number;
  data?: BuyerResult;
  isFallback?: boolean;
  fallbackReason?: string;
}

export async function runBuyerSearch(
  sessionId: string,
  userId: string,
  profile: ProductProfile,
  targetCountries: string[],
  targetCount: number,
  onProgress: (event: SearchProgress) => void
): Promise<void> {
  const audit: AuditLog = {};
  const allCandidates: {
    domain: string;
    companyName: string;
    website: string;
    country: string;
    source: string;
    shipmentCount: number;
    lastShipment: string | null;
  }[] = [];

  onProgress({ type: "progress", message: "正在解析产品信息...", foundCount: 0, progress: 5 });

  // L5: Get cache as baseline (async)
  const cacheKey = `${profile.category}-${targetCountries.sort().join(",")}`;
  const cachedResults = await getFromCache(cacheKey);
  audit.l5_cache = cachedResults.length;

  // [V1.0 REMOVED] L1: ImportYeti — 依赖HTML结构解析，易崩溃
  // Phase 2 将用 SearXNG 替代

  // L2: SerpAPI + L3: DDG + L4: Bing (concurrent)
  onProgress({ type: "progress", message: "正在检索全球买家数据...", foundCount: 0, progress: 20 });

  const queries = buildSearchQueries(profile, targetCountries);
  const [serpResults, ddgResults, bingResults] = await Promise.allSettled([
    searchViaSerpAPI(profile.productName, profile.searchKeywords, targetCountries, COUNTRY_SEARCH_TERMS),
    searchViaDDG(queries),
    searchViaBing(queries),
  ]);

  if (serpResults.status === "fulfilled") {
    audit.l2_serpapi = serpResults.value.length;
    for (const r of serpResults.value) {
      if (r.domain && !allCandidates.some((c) => c.domain === r.domain)) {
        allCandidates.push({
          domain: r.domain,
          companyName: r.title.split("|")[0].split("-")[0].trim(),
          website: r.url,
          country: targetCountries[0] || "Unknown",
          source: "serpapi",
          shipmentCount: 0,
          lastShipment: null,
        });
      }
    }
  }

  if (ddgResults.status === "fulfilled") {
    audit.l3_ddg = ddgResults.value.length;
    for (const r of ddgResults.value) {
      if (r.domain && !allCandidates.some((c) => c.domain === r.domain)) {
        allCandidates.push({
          domain: r.domain,
          companyName: r.title.split("|")[0].split("-")[0].trim(),
          website: r.url,
          country: targetCountries[0] || "Unknown",
          source: "ddg",
          shipmentCount: 0,
          lastShipment: null,
        });
      }
    }
  }

  if (bingResults.status === "fulfilled") {
    audit.l4_bing = bingResults.value.length;
    for (const r of bingResults.value) {
      if (r.domain && !allCandidates.some((c) => c.domain === r.domain)) {
        allCandidates.push({
          domain: r.domain,
          companyName: r.title.split("|")[0].split("-")[0].trim(),
          website: r.url,
          country: targetCountries[0] || "Unknown",
          source: "bing",
          shipmentCount: 0,
          lastShipment: null,
        });
      }
    }
  }

  audit.after_dedup = allCandidates.length;

  // Filter user-seen domains
  const seenDomains = await getUserSeenDomains(userId);
  const freshCandidates = allCandidates.filter(
    (c) => !seenDomains.has(c.domain)
  );
  audit.after_user_filter = freshCandidates.length;

  // Filter blacklisted domains
  const filteredCandidates = freshCandidates.filter(
    (c) => !isBlacklisted(c.domain)
  );
  audit.after_competitor_filter = filteredCandidates.length;

  // If not enough candidates, trigger deep search
  const needed = targetCount * 3;
  if (filteredCandidates.length < needed) {
    onProgress({ type: "progress", message: "正在深度搜索更多买家...", foundCount: 0, progress: 35 });
    const deepKeywords = await generateDeepSearchKeywords(
      profile,
      profile.searchKeywords
    );
    const [deepSerp, deepDDG] = await Promise.allSettled([
      searchViaSerpAPI(
        profile.productName,
        deepKeywords,
        targetCountries,
        COUNTRY_SEARCH_TERMS
      ),
      searchViaDDG(deepKeywords.slice(0, 5).map((kw) => `${kw} importer buyer`)),
    ]);

    for (const results of [deepSerp, deepDDG]) {
      if (results.status === "fulfilled") {
        for (const r of results.value) {
          if (r.domain && !filteredCandidates.some((c) => c.domain === r.domain) && !isBlacklisted(r.domain)) {
            filteredCandidates.push({
              domain: r.domain,
              companyName: r.title.split("|")[0].split("-")[0].trim(),
              website: r.url,
              country: targetCountries[0] || "Unknown",
              source: r.source,
              shipmentCount: 0,
              lastShipment: null,
            });
          }
        }
      }
    }
  }

  // Add cache as fallback if still not enough
  let isFallback = false;
  if (filteredCandidates.length < targetCount && cachedResults.length > 0) {
    isFallback = true;
    for (const cached of cachedResults) {
      if (!filteredCandidates.some((c) => c.domain === cached.domain)) {
        filteredCandidates.push({
          ...cached,
          website: `https://${cached.domain}`,
          country: targetCountries[0] || "Unknown",
          source: "cache",
          shipmentCount: 0,
          lastShipment: null,
        });
      }
    }
  }

  // Take top candidates for analysis
  const toAnalyze = filteredCandidates.slice(0, Math.min(targetCount * 2, 60));

  onProgress({
    type: "progress",
    message: "正在分析买家匹配度...",
    foundCount: 0,
    progress: 40,
  });

  // Batch get contacts
  const domains = toAnalyze.map((c) => c.domain).filter(Boolean);
  const contactMap = await getContactsBatch(domains, 5);
  audit.pdl_enriched = Array.from(contactMap.values()).filter((c) => c.length > 0).length;
  audit.no_contact = Array.from(contactMap.values()).filter((c) => c.length === 0).length;

  // Analyze each buyer
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
          // Scrape website + detect signals + supplier weakness + intelligence agent concurrently
          const [websiteContent, intentSignals, weaknessResult, intelResult] = await Promise.allSettled([
            scrapeWebsiteContent(candidate.domain),
            detectIntentSignals(candidate.companyName, candidate.domain),
            detectSupplierWeakness(candidate.companyName, candidate.domain),
            runIntelligenceAgent(
              candidate.companyName,
              candidate.domain,
              profile.searchKeywords ?? [],
              profile.productName,
              "", // whyTheyNeedUs filled in after analysis
              contactMap.get(candidate.domain)?.[0]?.name
            ),
          ]);

          const content =
            websiteContent.status === "fulfilled" ? websiteContent.value : "";
          const signals =
            intentSignals.status === "fulfilled" ? intentSignals.value : [];
          const supplierWeakness =
            weaknessResult.status === "fulfilled" ? weaknessResult.value : undefined;
          const intel =
            intelResult.status === "fulfilled" ? intelResult.value : undefined;

          // Analyze buyer
          const analysis = await analyzeBuyer(
            candidate.companyName,
            candidate.domain,
            content,
            candidate.shipmentCount,
            candidate.lastShipment,
            signals,
            profile
          );

          const contacts = contactMap.get(candidate.domain) || [];

          // Generate personalized email
          const emailDraft = await generateEmail(
            candidate.companyName,
            contacts[0]?.name || "",
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
            supplierWeaknessSignal:
              supplierWeakness?.hasWeaknessSignal ? supplierWeakness : undefined,
            competitorData: intel?.competitorData,
            socialDynamics: intel?.socialDynamics,
            outreachHook: intel?.outreachHook || "",
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

            // Mark as seen
            await prisma.userSeenCompany.upsert({
              where: { userId_companyDomain: { userId, companyDomain: buyer.domain } },
              create: { userId, companyDomain: buyer.domain },
              update: {},
            });
          } catch {
            // DB insert failed, continue without saving
          }

          buyers.push(buyer);

          // Push to frontend via SSE
          buyers.sort((a, b) => b.matchScore - a.matchScore);
          onProgress({
            type: "new_buyer",
            foundCount: buyers.length,
            progress,
            data: buyer,
          });
        } catch (err) {
          console.warn("[SearchOrchestrator] Buyer analysis failed:", err);
        }
      })
    );

    if (buyers.length >= targetCount) break;
  }

  audit.after_analysis = buyers.length;
  audit.final_output = Math.min(buyers.length, targetCount);
  audit.avg_score =
    buyers.length > 0
      ? Math.round(buyers.reduce((s, b) => s + b.matchScore, 0) / buyers.length)
      : 0;

  // Log audit
  console.log("[Audit]", JSON.stringify(audit));

  // Update session
  try {
    await prisma.searchSession.update({
      where: { id: sessionId },
      data: {
        status: "completed",
        resultCount: Math.min(buyers.length, targetCount),
        isFallback,
        auditLog: JSON.parse(JSON.stringify(audit)),
        completedAt: new Date(),
      },
    });

    // Save cache
    await prisma.searchCache.upsert({
      where: { cacheKey },
      create: {
        cacheKey,
        results: filteredCandidates.slice(0, 100).map((c) => ({
          domain: c.domain,
          companyName: c.companyName,
        })),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      update: {
        results: filteredCandidates.slice(0, 100).map((c) => ({
          domain: c.domain,
          companyName: c.companyName,
        })),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  } catch {
    // DB not available
  }

  onProgress({
    type: "completed",
    foundCount: Math.min(buyers.length, targetCount),
    isFallback,
    fallbackReason: isFallback ? "部分结果来自历史缓存" : undefined,
    progress: 100,
  });
}
