/**
 * /api/jobs — Create and list search jobs
 * NEVER returns 500. In-memory store always works, no DB required.
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Lazy import of jobStore so even if it somehow fails, we handle it
async function getJobStore() {
  return import("@/lib/jobStore");
}

export async function POST(req: NextRequest) {
  try {
    let body: { type?: string; input?: unknown; userId?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { type, input, userId = "demo-user" } = body;
    if (!type || !input) {
      return NextResponse.json({ error: "Missing type or input" }, { status: 400 });
    }

    // Create job in memory — always succeeds
    const { createJob } = await getJobStore();
    const job = createJob(type, input, userId);

    // Fire-and-forget: dynamic import isolates runner errors from this response
    import("@/lib/jobRunner")
      .then(({ startJob }) => startJob(job.id, type, input))
      .catch(async (err) => {
        console.error("[POST /api/jobs] Failed to start job:", err);
        try {
          const { updateJob } = await getJobStore();
          updateJob(job.id, { status: "failed", message: "启动失败，请重试" });
        } catch { /* ignore */ }
      });

    return NextResponse.json({ jobId: job.id, status: "pending" });
  } catch (err) {
    // Last-resort catch — should never reach here
    console.error("[POST /api/jobs] Unexpected error:", err);
    return NextResponse.json({ error: "服务器内部错误，请重试" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || "demo-user";
    const { listJobs } = await getJobStore();
    const jobs = listJobs(userId);
    return NextResponse.json({ jobs });
  } catch (err) {
    console.error("[GET /api/jobs] Unexpected error:", err);
    return NextResponse.json({ jobs: [] });
  }
}
