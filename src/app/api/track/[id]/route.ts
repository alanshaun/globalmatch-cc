/**
 * GET /api/track/:id - Email open tracking pixel
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const trackingId = params.id;

  // Update email open record
  try {
    const record = await prisma.emailOutreach.findFirst({
      where: { trackingPixelId: trackingId },
    });

    if (record) {
      await prisma.emailOutreach.update({
        where: { id: record.id },
        data: {
          status: record.status === "sent" ? "opened" : record.status,
          openedAt: record.openedAt || new Date(),
          openCount: { increment: 1 },
        },
      });
    }
  } catch {
    // Tracking non-critical
  }

  return new NextResponse(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}
