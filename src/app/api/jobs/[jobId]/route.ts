/**
 * /api/jobs/[jobId] — Get job status and results
 * All imports are dynamic/lazy — never causes 500 from missing modules.
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    // Check in-memory store first (fast path, always works)
    const { getJob } = await import("@/lib/jobStore");
    const memJob = getJob(params.jobId);
    if (memJob) {
      return NextResponse.json({ job: memJob });
    }

    // Fall back to DB (e.g. after server restart)
    try {
      const { prisma } = await import("@/lib/db");
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
      // DB not available — in-memory only
    }

    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  } catch (err) {
    console.error("[GET /api/jobs/[jobId]] Unexpected error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
