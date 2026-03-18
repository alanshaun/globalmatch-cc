/**
 * normalizeBuyer
 *
 * Sanitizes any buyer object from ANY source (SSE stream, DB query, cache)
 * before it enters React state. Guarantees every field has a safe default.
 *
 * This is the single source of truth for defensive data normalization.
 * Call this at every data ingestion point, NOT inside render functions.
 */

import type { BuyerResult } from "@/app/(dashboard)/buyers/page";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeBuyer(raw: any): BuyerResult {
  if (!raw || typeof raw !== "object") {
    return emptyBuyer();
  }

  return {
    id: str(raw.id),
    companyName: str(raw.companyName) || "Unknown Company",
    website: str(raw.website),
    domain: str(raw.domain),
    country: str(raw.country),
    industry: str(raw.industry),
    matchScore: clamp(raw.matchScore),
    fitScore: clamp(raw.fitScore),
    intentScore: clamp(raw.intentScore),
    reachabilityScore: clamp(raw.reachabilityScore),
    confidenceScore: clamp(raw.confidenceScore),
    matchReason: str(raw.matchReason),
    buyerBusiness: str(raw.buyerBusiness),
    whyTheyNeedUs: str(raw.whyTheyNeedUs),
    supplierWeakness: str(raw.supplierWeakness),
    bestContactTiming: str(raw.bestContactTiming),
    dataSource: str(raw.dataSource) || "unknown",
    fromCache: Boolean(raw.fromCache),
    shipmentCount: num(raw.shipmentCount),
    lastShipment: raw.lastShipment ? str(raw.lastShipment) : null,

    // Array fields — the most common source of crashes
    contacts: normalizeArray(raw.contacts).map(normalizeContact),
    intentSignals: normalizeArray(raw.intentSignals).map(normalizeSignal),
    redFlags: normalizeArray(raw.redFlags).map(str).filter(Boolean),

    // Object fields
    emailDraft: normalizeEmailDraft(raw.emailDraft),
    supplierWeaknessSignal: normalizeSupplierWeaknessSignal(raw.supplierWeaknessSignal),

    // Intelligence Agent fields
    competitorData: raw.competitorData && typeof raw.competitorData === "object" ? raw.competitorData : undefined,
    socialDynamics: raw.socialDynamics && typeof raw.socialDynamics === "object" ? raw.socialDynamics : undefined,
    outreachHook: raw.outreachHook ? str(raw.outreachHook) : undefined,
    reachabilityStatus: raw.reachabilityStatus && typeof raw.reachabilityStatus === "object"
      ? {
          email: Boolean(raw.reachabilityStatus.email),
          whatsapp: Boolean(raw.reachabilityStatus.whatsapp),
          linkedin: Boolean(raw.reachabilityStatus.linkedin),
        }
      : undefined,
    funnelStage: str(raw.funnelStage) || "discovered",
  };
}

export function normalizeBuyerArray(arr: unknown): BuyerResult[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(normalizeBuyer);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function num(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function clamp(v: unknown): number {
  const n = num(v);
  return Math.max(0, Math.min(100, n));
}

function normalizeArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  return [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeContact(c: any): BuyerResult["contacts"][number] {
  if (!c || typeof c !== "object") {
    return { name: "", title: "", email: "", emailQuality: "none", linkedinUrl: "" };
  }
  const quality = c.emailQuality;
  const validQualities = ["verified", "generic", "unverified", "none"];
  return {
    name: str(c.name),
    title: str(c.title),
    email: str(c.email),
    emailQuality: validQualities.includes(quality) ? quality : "none",
    linkedinUrl: str(c.linkedinUrl),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeSignal(s: any): BuyerResult["intentSignals"][number] {
  if (!s || typeof s !== "object") {
    return { type: "unknown", strength: "low", description: "" };
  }
  return {
    type: str(s.type) || "unknown",
    strength: str(s.strength) || "low",
    description: str(s.description),
    date: s.date ? str(s.date) : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeEmailDraft(d: any): BuyerResult["emailDraft"] {
  if (!d || typeof d !== "object" || Array.isArray(d)) {
    return { subjectA: "", subjectB: "", body: "" };
  }
  return {
    subjectA: str(d.subjectA),
    subjectB: str(d.subjectB),
    body: str(d.body),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeSupplierWeaknessSignal(s: any): BuyerResult["supplierWeaknessSignal"] {
  if (!s || typeof s !== "object") return undefined;
  return {
    hasWeaknessSignal: Boolean(s.hasWeaknessSignal),
    signals: normalizeArray(s.signals).map((sig: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const x = sig as any;
      return {
        type: (str(x?.type) || "quality") as "quality" | "delivery" | "price" | "service" | "compliance",
        source: (str(x?.source) || "google") as "google" | "news" | "hiring",
        confidence: (str(x?.confidence) || "low") as "high" | "medium" | "low",
        description: str(x?.description),
      };
    }),
    opportunitySummary: str(s.opportunitySummary),
  };
}

function emptyBuyer(): BuyerResult {
  return {
    companyName: "Unknown Company",
    website: "", domain: "", country: "", industry: "",
    matchScore: 0, fitScore: 0, intentScore: 0, reachabilityScore: 0, confidenceScore: 0,
    matchReason: "", buyerBusiness: "", whyTheyNeedUs: "", supplierWeakness: "",
    bestContactTiming: "", dataSource: "unknown", fromCache: false,
    shipmentCount: 0, lastShipment: null,
    contacts: [], intentSignals: [], redFlags: [],
    emailDraft: { subjectA: "", subjectB: "", body: "" },
    supplierWeaknessSignal: undefined,
    competitorData: undefined,
    socialDynamics: undefined,
    outreachHook: undefined,
    reachabilityStatus: undefined,
    funnelStage: "discovered",
  };
}
