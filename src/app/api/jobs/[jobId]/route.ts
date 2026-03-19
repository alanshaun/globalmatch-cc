/**
 * /api/jobs/[jobId] — Get job status and results
 * Reads from in-memory store first, falls back to DB.
 */

import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobStore";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  // Check in-memory store first (fast path)
  const memJob = getJob(params.jobId);
  if (memJob) {
    return NextResponse.json({ job: memJob });
  }

  // Fall back to DB (e.g. after server restart)
  try {
    const dbJob = await prisma.searchJob.findUnique({ where: { id: params.jobId } });
    if (dbJob) {
      return NextResponse.json({
        job: {
          id: dbJob.id, type: dbJob.type, status: dbJob.status,
          progress: dbJob.progress, message: dbJob.message,
          output: dbJob.output, error: dbJob.error,
          sessionId: dbJob.sessionId, userId: dbJob.userId,
          createdAt: dbJob.createdAt.toISOString(),
          completedAt: dbJob.completedAt?.toISOString(),
        },
      });
    }
  } catch {
    // DB not available
  }

  return NextResponse.json({ error: "Job not found" }, { status: 404 });
}
