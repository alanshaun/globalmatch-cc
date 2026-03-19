import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || "demo-user";

  try {
    const [buyerCount, emailStats, repliedCount] = await Promise.all([
      // Total unique buyers found
      prisma.buyerMatch.count({ where: { userId } }),

      // Email stats: sent + opened + replied
      prisma.emailOutreach.groupBy({
        by: ["status"],
        where: { userId },
        _count: { id: true },
      }),

      // Replied count
      prisma.emailOutreach.count({
        where: { userId, status: "replied" },
      }),
    ]);

    // Build email counts by status
    const emailByStatus: Record<string, number> = {};
    for (const row of emailStats) {
      emailByStatus[row.status] = row._count.id;
    }

    const sentCount =
      (emailByStatus["sent"] || 0) +
      (emailByStatus["opened"] || 0) +
      (emailByStatus["replied"] || 0);

    const openedCount =
      (emailByStatus["opened"] || 0) + (emailByStatus["replied"] || 0);

    const openRate =
      sentCount > 0 ? Math.round((openedCount / sentCount) * 100) : 0;

    return NextResponse.json({
      buyerCount,
      sentCount,
      openRate,
      repliedCount,
    });
  } catch (err) {
    console.error("[dashboard/metrics]", err);
    return NextResponse.json(
      { buyerCount: 0, sentCount: 0, openRate: 0, repliedCount: 0 },
      { status: 200 }
    );
  }
}
