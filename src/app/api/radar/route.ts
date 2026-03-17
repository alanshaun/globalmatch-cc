/**
 * POST /api/radar - Product selection radar
 */

import { NextRequest, NextResponse } from "next/server";
import { llmParseJSON } from "@/lib/llmClient";

interface ProductRecommendation {
  category: string;
  hsCode: string;
  stars: number;
  marketHeat: number[];
  competitionLevel: "低" | "中" | "高";
  recommendation: "值得做" | "太卷" | "时机未到";
  analysis: string;
  reasoning: string;
  entryBarrier: string;
  typicalBuyer: string;
}

export async function POST(req: NextRequest) {
  try {
    const { capability, markets, qualifications } = await req.json();

    const result = await llmParseJSON<{ recommendations: ProductRecommendation[] }>(
      `You are a B2B export consultant. Analyze this factory and recommend export product categories.

Factory capability: "${capability}"
Target export markets: ${markets.join(", ")}
Qualifications: ${qualifications || "Not specified"}

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

    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/radar]", err);
    return NextResponse.json({ recommendations: [] }, { status: 500 });
  }
}
