/**
 * Product Analyzer - Extracts structured product profile from any input type
 */

import { llmParseJSON } from "@/lib/llmClient";

export interface ProductProfile {
  productName: string;
  productDescription: string;
  hsCode: string;
  category: string;
  targetBuyerTypes: string[];
  pricePositioning: "high" | "mid" | "low";
  certifications: string[];
  coreAdvantages: string[];
  searchKeywords: string[];
  generatedBy?: string;
}

const SYSTEM_PROMPT = `You are a professional B2B trade consultant specializing in export product analysis.
Extract a precise product profile from the given information. Be specific and factual.`;

const PROFILE_PROMPT = (input: string) => `
Analyze the following product information and extract a structured profile.
Return ONLY valid JSON, no markdown, no code blocks.

INPUT:
${input}

Return this exact JSON structure:
{
  "productName": "specific product name",
  "productDescription": "core functions and advantages in 200 words or less",
  "hsCode": "6-digit HS code (infer if not provided)",
  "category": "industry category",
  "targetBuyerTypes": ["importer", "distributor", "retailer", "brand", "procurement"],
  "pricePositioning": "high|mid|low",
  "certifications": ["list of existing certifications"],
  "coreAdvantages": ["specific differentiating advantages, NOT generic quality claims"],
  "searchKeywords": ["8-10 English search keywords for finding buyers"]
}`;

const FALLBACK: ProductProfile = {
  productName: "Product",
  productDescription: "General product",
  hsCode: "",
  category: "General",
  targetBuyerTypes: ["importer", "distributor"],
  pricePositioning: "mid",
  certifications: [],
  coreAdvantages: [],
  searchKeywords: [],
};

export async function analyzeProduct(input: string): Promise<ProductProfile> {
  return llmParseJSON<ProductProfile>(
    PROFILE_PROMPT(input),
    SYSTEM_PROMPT,
    FALLBACK,
    { fallbackType: "productProfile" }
  );
}

export async function extractFromFile(
  fileContent: string,
  fileType: "pdf" | "docx" | "image"
): Promise<string> {
  const prompt = `Extract all product-related information from this ${fileType} content.
Include: product name, features, specifications, pricing, certifications, target markets.
Content: ${fileContent.slice(0, 8000)}`;

  const { llmCall } = await import("@/lib/llmClient");
  const result = await llmCall(prompt, "You are extracting product information from documents.");
  return result.content;
}

export async function extractFromUrl(url: string): Promise<string> {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage();

    const pagesToFetch = [url, `${url}/products`, `${url}/about`];
    let combined = "";

    for (const pageUrl of pagesToFetch.slice(0, 3)) {
      try {
        await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
        const text = await page.evaluate(() => document.body.innerText);
        combined += `\n\n[Page: ${pageUrl}]\n${text.slice(0, 3000)}`;
      } catch {
        // Skip inaccessible pages
      }
    }

    await browser.close();
    return combined.slice(0, 8000);
  } catch (err) {
    console.warn("[URLExtract] Failed:", err instanceof Error ? err.message : err);
    return "";
  }
}
