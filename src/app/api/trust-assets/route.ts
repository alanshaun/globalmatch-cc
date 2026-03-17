/**
 * POST /api/trust-assets - Generate buyer trust content
 */

import { NextRequest, NextResponse } from "next/server";
import { llmParseJSON } from "@/lib/llmClient";

export async function POST(req: NextRequest) {
  try {
    const { companyName, companyNameEn, products, certifications, yearsEstablished, markets } = await req.json();

    const result = await llmParseJSON<{
      aboutUs: string;
      linkedinBio: string;
      productTemplate: string;
      caseStudies: { title: string; framework: string }[];
      emailSignature: string;
      tagline: string;
    }>(
      `Generate professional B2B trust content for this export company.
Be specific, credible, and buyer-focused. Avoid generic claims.

Company: ${companyName} / ${companyNameEn}
Products: ${products}
Certifications: ${(certifications || []).join(", ")}
Years established: ${yearsEstablished || "Established"}
Target markets: ${(markets || []).join(", ")}

Return ONLY this JSON:
{
  "aboutUs": "200-word English About Us for company website (credible, specific, buyer-focused)",
  "linkedinBio": "150-word LinkedIn company description (professional, achievement-focused)",
  "productTemplate": "English product introduction template with [PRODUCT], [SPEC], [BENEFIT] placeholders",
  "caseStudies": [
    { "title": "Case study 1 title", "framework": "Problem → Solution → Result framework, 100 words" },
    { "title": "Case study 2 title", "framework": "..." },
    { "title": "Case study 3 title", "framework": "..." }
  ],
  "emailSignature": "Professional email signature HTML",
  "tagline": "One-sentence English company positioning tagline"
}`,
      "You create professional B2B export company branding content.",
      {
        aboutUs: `${companyNameEn} is a specialized manufacturer of ${products}, serving buyers across ${(markets || []).join(", ")} since ${yearsEstablished || "its founding"}.`,
        linkedinBio: `Leading manufacturer of ${products} with proven track record in international trade.`,
        productTemplate: "[PRODUCT] - [SPEC] | Key benefit: [BENEFIT]",
        caseStudies: [
          { title: "Case Study 1", framework: "Challenge: [Problem]. Solution: [How we helped]. Result: [Measurable outcome]." }
        ],
        emailSignature: `<b>${companyNameEn}</b> | ${products}`,
        tagline: `Quality ${products} for global buyers`,
      }
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/trust-assets]", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
