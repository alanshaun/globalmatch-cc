/**
 * Buyer Analyzer - Deep analysis of each buyer company
 * Uses Kimi/Gemini to score fit, intent, reachability, confidence
 * Also generates personalized outreach emails
 */

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
  fitScore: 30,
  fitReason: "Limited data available",
  intentScore: 20,
  intentReason: "No recent signals detected",
  reachabilityScore: 40,
  reachabilityReason: "Contact information found",
  confidenceScore: 30,
  confidenceReason: "Data source reliability unknown",
  bestContactTiming: "Standard business hours, Tuesday-Thursday",
  redFlags: [],
  matchScore: 30,
};

async function scrapeWebsiteContent(domain: string): Promise<string> {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage();

    let content = "";
    const pages = [
      { url: `https://${domain}`, limit: 3000 },
      { url: `https://${domain}/about`, limit: 1000 },
      { url: `https://${domain}/products`, limit: 2000 },
    ];

    for (const { url, limit } of pages) {
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
        const text = await page.evaluate(() => document.body.innerText);
        content += `\n[${url}]\n${text.slice(0, limit)}`;
      } catch {
        // Skip
      }
    }

    await browser.close();
    return content;
  } catch {
    return "";
  }
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

Return this exact JSON:
{
  "buyerBusiness": "one sentence describing buyer's main business",
  "buyerProductKeywords": ["products they sell"],
  "whyTheyNeedUs": "specific reason referencing buyer's actual business",
  "currentSupplierWeakness": "inferred weakness from public information",
  "fitScore": 0-100,
  "fitReason": "cite specific data points",
  "intentScore": 0-100,
  "intentReason": "explain intent signals",
  "reachabilityScore": 0-100,
  "reachabilityReason": "contact accessibility",
  "confidenceScore": 0-100,
  "confidenceReason": "data source reliability",
  "bestContactTiming": "timing recommendation",
  "redFlags": ["any concerns if present"],
  "matchScore": computed as fitScore*0.3 + intentScore*0.25 + reachabilityScore*0.25 + confidenceScore*0.2
}`;

  return llmParseJSON<BuyerAnalysis>(
    prompt,
    "You are analyzing B2B buyers for export sales. Be specific, cite real data.",
    FALLBACK_ANALYSIS,
    { fallbackType: "buyerAnalysis" }
  );
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
