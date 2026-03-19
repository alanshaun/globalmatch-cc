/**
 * POST /api/trade-show - Trade show intelligence package
 */

import { NextRequest, NextResponse } from "next/server";
import { llmParseJSON } from "@/lib/llmClient";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { showName, productCategory, buyerTypes } = await req.json();

    const result = await llmParseJSON<{
      showOverview: {
        scale: string;
        exhibitorStructure: string;
        typicalBuyerTypes: string[];
        bestForProducts: string[];
      };
      buyerPersona: {
        title: string;
        company: string;
        painPoints: string[];
        decisionCriteria: string[];
      }[];
      pitch30s: string;
      commonQuestions: { question: string; answer: string }[];
      competitorDisplay: string;
      prepChecklist: string[];
    }>(
      `You are a trade show expert. Create an intelligence package for:

Show: ${showName}
Our products: ${productCategory}
Target buyer types: ${(buyerTypes || []).join(", ")}

Return ONLY this JSON:
{
  "showOverview": {
    "scale": "show size and importance",
    "exhibitorStructure": "typical exhibitor mix",
    "typicalBuyerTypes": ["buyer type 1", "buyer type 2"],
    "bestForProducts": ["product types that do well here"]
  },
  "buyerPersona": [
    {
      "title": "buyer job title",
      "company": "type of company",
      "painPoints": ["pain point 1", "pain point 2"],
      "decisionCriteria": ["criteria 1", "criteria 2"]
    }
  ],
  "pitch30s": "30-second booth pitch in English (natural, conversational, not salesy)",
  "commonQuestions": [
    { "question": "typical buyer question", "answer": "ideal answer" }
  ],
  "competitorDisplay": "how competitors typically present at this show and differentiation tactics",
  "prepChecklist": ["prep item 1", "prep item 2", "prep item 3"]
}`,
      "You are an international trade show strategy expert.",
      {
        showOverview: {
          scale: "International trade exhibition",
          exhibitorStructure: "Mix of manufacturers and distributors",
          typicalBuyerTypes: ["importers", "distributors", "retailers"],
          bestForProducts: [productCategory],
        },
        buyerPersona: [],
        pitch30s: `We manufacture ${productCategory} with [key advantage]. Our products are used by buyers in [market] who need [benefit]. Can I show you our latest samples?`,
        commonQuestions: [],
        competitorDisplay: "Standard booth setup with product displays",
        prepChecklist: [
          "Prepare product samples",
          "Business cards in English",
          "Price list ready",
          "Follow-up email template prepared"
        ],
      }
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/trade-show]", err);
    return NextResponse.json({ error: "Intelligence generation failed" }, { status: 500 });
  }
}
