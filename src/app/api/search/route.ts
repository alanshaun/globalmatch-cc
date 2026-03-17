/**
 * POST /api/search - Start a buyer search session
 * Returns session ID for SSE polling
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzeProduct } from "@/services/productAnalyzer";
import { z } from "zod";

const SearchRequestSchema = z.object({
  productName: z.string().min(2),
  productDescription: z.string().optional().default(""),
  websiteUrl: z.string().url().optional(),
  targetCountries: z.array(z.string()).min(1),
  targetCount: z.number().min(5).max(50).default(20),
  hsCode: z.string().optional(),
  priceRange: z.string().optional(),
  moq: z.string().optional(),
  buyerTypes: z.array(z.string()).optional(),
  excludeKeywords: z.array(z.string()).optional(),
  userId: z.string().default("demo-user"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = SearchRequestSchema.parse(body);

    // Analyze product to build profile
    const rawInput = [
      validated.productName,
      validated.productDescription,
      validated.hsCode ? `HS Code: ${validated.hsCode}` : "",
      validated.priceRange ? `Price: ${validated.priceRange}` : "",
      validated.moq ? `MOQ: ${validated.moq}` : "",
      validated.buyerTypes?.length
        ? `Buyer types: ${validated.buyerTypes.join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const profile = await analyzeProduct(rawInput);

    // Ensure user exists
    const user = await prisma.user.upsert({
      where: { id: validated.userId },
      create: {
        id: validated.userId,
        email: `${validated.userId}@globalmatch.local`,
        name: "Demo User",
      },
      update: {},
    }).catch(() => ({ id: validated.userId }));

    // Create seller profile
    const sellerProfile = await prisma.sellerProfile.create({
      data: {
        userId: user.id,
        productName: profile.productName || validated.productName,
        productDescription: profile.productDescription,
        hsCode: profile.hsCode || validated.hsCode,
        category: profile.category,
        pricePositioning: profile.pricePositioning,
        certifications: profile.certifications,
        coreAdvantages: profile.coreAdvantages,
        rawInputType: "text",
        rawInputContent: rawInput,
        searchKeywords: profile.searchKeywords,
      },
    }).catch(async () => {
      // DB not available, create minimal profile
      return { id: `profile-${Date.now()}` };
    });

    // Create search session
    const session = await prisma.searchSession.create({
      data: {
        userId: user.id,
        sellerProfileId: sellerProfile.id,
        targetCountries: validated.targetCountries,
        targetCount: validated.targetCount,
        status: "pending",
      },
    }).catch(() => ({
      id: `session-${Date.now()}`,
      status: "pending",
    }));

    return NextResponse.json({
      sessionId: session.id,
      profile,
      message: "Search session created",
    });
  } catch (err) {
    console.error("[/api/search]", err);
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to start search" },
      { status: 500 }
    );
  }
}
