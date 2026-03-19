/**
 * GET /api/sessions?userId=xxx
 * Returns past search sessions for history panel
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || "demo-user";

  try {
    const sessions = await prisma.searchSession.findMany({
      where: { userId, status: "completed" },
      include: {
        sellerProfile: { select: { productName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        productName: s.sellerProfile.productName,
        targetCountries: s.targetCountries,
        resultCount: s.resultCount,
        createdAt: s.createdAt,
      })),
    });
  } catch {
    return NextResponse.json({ sessions: [] });
  }
}
