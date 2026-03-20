/**
 * POST /api/pricing - Price intelligence
 *
 * V2.0: Removed SerpAPI dependency — pure LLM analysis.
 * Page is hidden in V1.0 MVP; API kept for future use.
 */

import { NextRequest, NextResponse } from "next/server";
import { llmParseJSON } from "@/lib/llmClient";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { productName, myPrice, market } = await req.json();

    const result = await llmParseJSON<{
      marketMin: number;
      marketMax: number;
      marketMedian: number;
      trend: "up" | "down" | "stable";
      trendReason: string;
      distribution: number[];
      strategies: string[];
      positioning: string;
      myPriceAssessment: string;
    }>(
      `You are a B2B pricing consultant. Analyze market pricing for "${productName}" in ${market}.
My current price: ${myPrice || "Not specified"}

Return ONLY this JSON:
{
  "marketMin": minimum market price number,
  "marketMax": maximum market price number,
  "marketMedian": median market price number,
  "trend": "up|down|stable",
  "trendReason": "brief reason for trend",
  "distribution": [5 percentage values summing to 100],
  "strategies": ["3 specific pricing strategy recommendations"],
  "positioning": "high|premium|mid|budget|low",
  "myPriceAssessment": "assessment of my price vs market"
}`,
      "You analyze B2B export product pricing.",
      {
        marketMin: 10,
        marketMax: 50,
        marketMedian: 25,
        trend: "stable",
        trendReason: "Market analysis unavailable",
        distribution: [10, 25, 35, 20, 10],
        strategies: [
          "Position at market median for initial market entry",
          "Offer volume discounts for orders above MOQ",
          "Consider FOB vs CIF pricing transparency",
        ],
        positioning: "mid",
        myPriceAssessment: "Price comparison analysis unavailable",
      }
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/pricing]", err);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
