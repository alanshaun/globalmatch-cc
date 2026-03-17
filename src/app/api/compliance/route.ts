/**
 * POST /api/compliance - Certification pathway
 */

import { NextRequest, NextResponse } from "next/server";
import { llmParseJSON } from "@/lib/llmClient";

export async function POST(req: NextRequest) {
  try {
    const { productCategory, targetCountries, existingCertifications } = await req.json();

    const result = await llmParseJSON<{
      summary: string;
      missingCount: number;
      totalCostMin: number;
      totalCostMax: number;
      totalMonths: number;
      certifications: {
        name: string;
        type: "mandatory" | "recommended";
        costMin: number;
        costMax: number;
        months: number;
        difficulty: "简单" | "中等" | "复杂";
        authority: string;
        authorityUrl: string;
        description: string;
        countries: string[];
      }[];
    }>(
      `You are a trade compliance expert. Provide certification requirements for:

Product category: ${productCategory}
Target markets: ${targetCountries.join(", ")}
Already have: ${(existingCertifications || []).join(", ") || "None"}

Provide practical, accurate certification guidance.

Return ONLY this JSON:
{
  "summary": "Top summary like: To enter US+EU markets, you need X certifications, estimated $X-X total, X months",
  "missingCount": number of certifications still needed,
  "totalCostMin": total minimum cost in USD,
  "totalCostMax": total maximum cost in USD,
  "totalMonths": realistic total months to obtain all,
  "certifications": [
    {
      "name": "certification name",
      "type": "mandatory|recommended",
      "costMin": cost min USD,
      "costMax": cost max USD,
      "months": typical months,
      "difficulty": "简单|中等|复杂",
      "authority": "issuing authority name",
      "authorityUrl": "official website URL",
      "description": "what it covers and why needed",
      "countries": ["applicable countries"]
    }
  ]
}
Sort by: mandatory first, then easiest first.`,
      "You are an international trade compliance expert with knowledge of global certifications.",
      {
        summary: "Certification analysis in progress",
        missingCount: 0,
        totalCostMin: 0,
        totalCostMax: 0,
        totalMonths: 0,
        certifications: [],
      }
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/compliance]", err);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
