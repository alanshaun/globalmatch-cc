/**
 * /api/jobs — Create and list search jobs
 * Uses in-memory store (always works, no DB required).
 * DB is synced best-effort for persistence.
 */

import { NextRequest, NextResponse } from "next/server";
import { createJob, listJobs } from "@/lib/jobStore";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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

  // Create job in memory — ALWAYS succeeds, no DB required
  const job = createJob(type, input, userId);

  // Dynamic import isolates jobRunner errors from this response.
  // Even if jobRunner crashes, the jobId is already returned to the client.
  import("@/lib/jobRunner")
    .then(({ startJob }) => startJob(job.id, type, input))
    .catch((err) => {
      console.error("[POST /api/jobs] Failed to start job:", err);
      // Mark job as failed so the client knows
      import("@/lib/jobStore").then(({ updateJob }) =>
        updateJob(job.id, { status: "failed", message: "启动失败，请重试" })
      ).catch(() => {});
    });

  return NextResponse.json({ jobId: job.id, status: "pending" });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || "demo-user";

  const jobs = listJobs(userId);
  return NextResponse.json({ jobs });
}
