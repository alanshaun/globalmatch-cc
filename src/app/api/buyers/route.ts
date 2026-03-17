/**
 * GET /api/buyers - Get buyer matches for a session
 * PATCH /api/buyers/:id - Update buyer (favorite, etc.)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  const userId = searchParams.get("userId") || "demo-user";

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  try {
    const buyers = await prisma.buyerMatch.findMany({
      where: { sessionId, userId },
      orderBy: { matchScore: "desc" },
    });
    return NextResponse.json({ buyers });
  } catch {
    return NextResponse.json({ buyers: [] });
  }
}
