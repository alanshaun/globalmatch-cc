/**
 * GET /api/buyers - Get buyer matches for a session
 * PATCH /api/buyers/:id - Update buyer (favorite, etc.)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  const userId = searchParams.get("userId") || "demo-user";

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  try {
    const rows = await prisma.buyerMatch.findMany({
      where: { sessionId, userId },
      orderBy: { matchScore: "desc" },
    });

    // Normalize DB rows to match BuyerResult shape expected by the frontend
    const buyers = rows.map((b) => ({
      id: b.id,
      companyName: b.companyName,
      website: b.website || "",
      domain: b.domain,
      country: b.country || "",
      industry: b.industry || "",
      matchScore: b.matchScore,
      fitScore: b.fitScore,
      intentScore: b.intentScore,
      reachabilityScore: b.reachabilityScore,
      confidenceScore: b.confidenceScore,
      matchReason: b.matchReason || "",
      buyerBusiness: b.buyerBusiness || "",
      whyTheyNeedUs: b.whyTheyNeedUs || "",
      supplierWeakness: b.supplierWeakness || "",
      contacts: Array.isArray(b.contacts) ? b.contacts : [],
      intentSignals: Array.isArray(b.intentSignals) ? b.intentSignals : [],
      emailDraft: (b.emailDraft && typeof b.emailDraft === "object" && !Array.isArray(b.emailDraft))
        ? b.emailDraft
        : { subjectA: "", subjectB: "", body: "" },
      redFlags: [],
      bestContactTiming: "",
      dataSource: b.dataSource,
      fromCache: b.fromCache,
      shipmentCount: b.shipmentCount,
      lastShipment: b.lastShipment ? b.lastShipment.toISOString() : null,
      supplierWeaknessSignal: undefined,
    }));

    return NextResponse.json({ buyers });
  } catch {
    return NextResponse.json({ buyers: [] });
  }
}
