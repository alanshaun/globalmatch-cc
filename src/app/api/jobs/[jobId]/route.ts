/**
 * /api/jobs/[jobId] - Get job status and results
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const job = await prisma.searchJob.findUnique({
      where: { id: params.jobId },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (err) {
    console.error("[GET /api/jobs/[jobId]]", err);
    return NextResponse.json({ error: "Failed to get job" }, { status: 500 });
  }
}
