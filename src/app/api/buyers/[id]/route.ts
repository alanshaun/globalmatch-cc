import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const buyer = await prisma.buyerMatch.update({
      where: { id: params.id },
      data: {
        isFavorited:
          body.isFavorited !== undefined ? body.isFavorited : undefined,
        funnelStage:
          body.funnelStage !== undefined ? body.funnelStage : undefined,
      },
    });
    return NextResponse.json({ buyer });
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
