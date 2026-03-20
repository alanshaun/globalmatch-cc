/**
 * Buyer Analyzer - Deep analysis of each buyer company
 * Uses Kimi/Gemini to score fit, intent, reachability, confidence
 * Also generates personalized outreach emails
 */

import { z } from "zod";
import { llmParseJSON, llmCall } from "@/lib/llmClient";
import type { ProductProfile } from "./productAnalyzer";
import type { IntentSignal } from "./intentSignals";
import type { Contact } from "./pdlClient";

export interface BuyerAnalysis {
  buyerBusiness: string;
  buyerProductKeywords: string[];
  whyTheyNeedUs: string;
  currentSupplierWeakness: string;
  fitScore: number;
  fitReason: string;
  intentScore: number;
  intentReason: string;
  reachabilityScore: number;
  reachabilityReason: string;
  confidenceScore: number;
  confidenceReason: string;
  bestContactTiming: string;
  redFlags: string[];
  matchScore: number;
  generatedBy?: string;
}

// Zod schema — validates LLM output at runtime
const BuyerAnalysisSchema = z.object({
  buyerBusiness: z.string().min(1),
  buyerProductKeywords: z.array(z.string()),
  whyTheyNeedUs: z.string(),
  currentSupplierWeakness: z.string(),
  fitScore: z.number().min(0).max(100),
  fitReason: z.string(),
  intentScore: z.number().min(0).max(100),
  intentReason: z.string(),
  reachabilityScore: z.number().min(0).max(100),
  reachabilityReason: z.string(),
  confidenceScore: z.number().min(0).max(100),
  confidenceReason: z.string(),
  bestContactTiming: z.string(),
  redFlags: z.array(z.string()),
  matchScore: z.number().min(0).max(100),
});

export interface EmailDraft {
  subjectA: string;
  subjectB: string;
  body: string;
  generatedBy?: string;
}

const FALLBACK_ANALYSIS: BuyerAnalysis = {
  buyerBusiness: "Business information pending",
  buyerProductKeywords: [],
  whyTheyNeedUs: "Analysis pending",
  currentSupplierWeakness: "Unknown",
  fitScore: 65,
  fitReason: "Preliminary match based on industry alignment",
  intentScore: 60,
  intentReason: "Active in target market segment",
  reachabilityScore: 70,
  reachabilityReason: "Contact information accessible",
  confidenceScore: 65,
  confidenceReason: "Data source matches known buyer profiles",
  bestContactTiming: "Standard business hours, Tuesday-Thursday",
  redFlags: [],
  matchScore: 65,
};

async function scrapeWebsiteContent(domain: string): Promise<string> {
  const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  function stripHtml(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  const pages = [
    { url: `https://${domain}`, limit: 3000 },
    { url: `https://${domain}/about`, limit: 1500 },
    { url: `https://${domain}/products`, limit: 2000 },
  ];

  let content = "";
  for (const { url, limit } of pages) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "text/html" },
        signal: AbortSignal.timeout(8000),
        redirect: "follow",
      });
      if (!res.ok) continue;
      const html = await res.text();
      const text = stripHtml(html);
      content += `\n[${url}]\n${text.slice(0, limit)}`;
    } catch {
      // skip this page
    }
  }
  return content;
}

export async function analyzeBuyer(
  companyName: string,
  domain: string,
  websiteContent: string,
  shipmentCount: number,
  lastShipment: string | null,
  intentSignals: IntentSignal[],
  sellerProfile: ProductProfile
): Promise<BuyerAnalysis> {
  const signalsSummary = intentSignals
    .map((s) => `${s.type} (${s.strength}): ${s.description}`)
    .join("\n");

  const prompt = `
You are a B2B export sales consultant. Analyze this buyer based on real data.
Return ONLY valid JSON, no markdown, no code blocks.

【Buyer Website Content】
${websiteContent.slice(0, 4000) || "Not available"}

【Import Records】
Import count: ${shipmentCount}, Last import: ${lastShipment || "Unknown"}

【Intent Signals】
${signalsSummary || "None detected"}

【Seller Product Profile】
Product: ${sellerProfile.productName}
Description: ${sellerProfile.productDescription}
Advantages: ${sellerProfile.coreAdvantages.join(", ")}
Category: ${sellerProfile.category}

SCORING CALIBRATION (important):
- These are pre-qualified buyer leads, so baseline scores should be optimistic
- fitScore: start from 60 if buyer industry is related; 75+ if strong match; only below 50 if clearly unrelated
- intentScore: start from 55 for active businesses; 70+ if there are positive signals; only below 40 if no evidence of need
- reachabilityScore: start from 65 if website/email found; 80+ if direct contact available; only below 50 if totally unreachable
- confidenceScore: start from 60 for most buyers; 75+ if solid public data available
- Scores should reflect realistic commercial opportunity, not worst-case skepticism
- Reserve scores below 50 only for clearly poor fits (wrong industry, too small, no import history, etc.)

Return this exact JSON:
{
  "buyerBusiness": "one sentence describing buyer's main business",
  "buyerProductKeywords": ["products they sell"],
  "whyTheyNeedUs": "specific reason referencing buyer's actual business",
  "currentSupplierWeakness": "inferred weakness from public information",
  "fitScore": number 50-95 (unless clearly unrelated buyer, then 20-49),
  "fitReason": "cite specific data points",
  "intentScore": number 50-90 (unless no signal at all, then 35-49),
  "intentReason": "explain intent signals",
  "reachabilityScore": number 55-95,
  "reachabilityReason": "contact accessibility",
  "confidenceScore": number 55-90,
  "confidenceReason": "data source reliability",
  "bestContactTiming": "timing recommendation",
  "redFlags": ["any concerns if present"],
  "matchScore": computed as fitScore*0.3 + intentScore*0.25 + reachabilityScore*0.25 + confidenceScore*0.2
}`;

  const raw = await llmParseJSON<BuyerAnalysis>(
    prompt,
    "You are analyzing B2B buyers for export sales. Be specific, cite real data.",
    FALLBACK_ANALYSIS,
    { fallbackType: "buyerAnalysis" }
  );

  // Zod validation — if schema fails, use fallback with warning
  const validated = BuyerAnalysisSchema.safeParse(raw);
  if (!validated.success) {
    console.warn("[BuyerAnalyzer] Zod validation failed:", validated.error.issues.map(i => i.message).join(", "));
    return { ...FALLBACK_ANALYSIS, ...raw }; // merge to rescue partial valid fields
  }
  return validated.data;
}

const FORBIDDEN_OPENERS = [
  "I came across your company",
  "I hope this email finds you well",
  "We are a leading manufacturer",
  "I wanted to reach out",
  "I am writing to",
  "Allow me to introduce",
];

export async function generateEmail(
  companyName: string,
  contactName: string,
  buyerBusiness: string,
  whyTheyNeedUs: string,
  intentSignals: IntentSignal[],
  supplierWeakness: string,
  sellerProfile: ProductProfile
): Promise<EmailDraft> {
  const topSignal =
    intentSignals.length > 0
      ? `Recent signal: ${intentSignals[0].description}`
      : "";

  const prompt = `
Write a personalized B2B outreach email. Return ONLY valid JSON.

FORBIDDEN OPENERS (never use these):
${FORBIDDEN_OPENERS.map((o) => `- "${o}"`).join("\n")}

REQUIREMENTS:
- First sentence MUST reference buyer's actual business: "${buyerBusiness}"
- If there's a signal, second sentence MUST reference it: "${topSignal}"
- 150-180 words in English
- Professional but conversational tone
- End with a specific next step (not "let me know if you have questions")
- NO generic phrases about "high quality" or "competitive price"

CONTEXT:
- Buyer company: ${companyName}
- Contact name: ${contactName || "there"}
- Why they need us: ${whyTheyNeedUs}
- Supplier weakness to address: ${supplierWeakness}
- Our product: ${sellerProfile.productName} - ${sellerProfile.productDescription}
- Our advantages: ${sellerProfile.coreAdvantages.join(", ")}

Return this JSON:
{
  "subjectA": "subject line variant A (specific, data-driven)",
  "subjectB": "subject line variant B (different angle)",
  "body": "full email body (150-180 words)"
}`;

  const result = await llmCall(
    prompt,
    "You write highly personalized B2B outreach emails that get replies."
  );

  const parsed = await llmParseJSON<EmailDraft>(
    prompt,
    "You write highly personalized B2B outreach emails.",
    {
      subjectA: `Partnership Opportunity for ${companyName}`,
      subjectB: `${sellerProfile.productName} Supply for Your Business`,
      body: `Dear ${contactName || "there"},\n\nAs a ${buyerBusiness}, your sourcing needs align well with our ${sellerProfile.productName} capabilities.\n\n${whyTheyNeedUs}\n\nWould you be open to a brief 15-minute call this week to explore how we can support your procurement goals?\n\nBest regards`,
    }
  );

  return { ...parsed, generatedBy: result.provider };
}

export { scrapeWebsiteContent };
