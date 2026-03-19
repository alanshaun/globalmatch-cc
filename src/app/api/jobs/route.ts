/**
 * /api/jobs - Create and list search jobs
 * POST: Create a new background job (returns jobId immediately)
 * GET: List all jobs for a user
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startJob } from "@/lib/jobRunner";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, input, userId = "demo-user" } = body;

    if (!type || !input) {
      return NextResponse.json({ error: "Missing type or input" }, { status: 400 });
    }

    // Create job record
    const job = await prisma.searchJob.create({
      data: { type, input, userId, status: "pending", progress: 0, message: "任务已创建，准备开始..." },
    });

    // Fire and forget - runs in background even after response is sent
    startJob(job.id, type, input);

    return NextResponse.json({ jobId: job.id, status: "pending" });
  } catch (err) {
    console.error("[POST /api/jobs]", err);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || "demo-user";

    const jobs = await prisma.searchJob.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        type: true,
        status: true,
        progress: true,
        message: true,
        sessionId: true,
        createdAt: true,
        completedAt: true,
        error: true,
      },
    });

    return NextResponse.json({ jobs });
  } catch (err) {
    console.error("[GET /api/jobs]", err);
    return NextResponse.json({ jobs: [] });
  }
}
