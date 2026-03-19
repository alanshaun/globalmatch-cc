/**
 * /api/jobs — Create and list search jobs
 * Uses in-memory store (always works, no DB required).
 * DB is synced best-effort for persistence.
 */

import { NextRequest, NextResponse } from "next/server";
import { createJob, listJobs } from "@/lib/jobStore";
import { startJob } from "@/lib/jobRunner";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, input, userId = "demo-user" } = body;

    if (!type || !input) {
      return NextResponse.json({ error: "Missing type or input" }, { status: 400 });
    }

    // Create job in memory FIRST — always succeeds
    const job = createJob(type, input, userId);

    // Start background processing — fire and forget
    startJob(job.id, type, input);

    return NextResponse.json({ jobId: job.id, status: "pending" });
  } catch (err) {
    console.error("[POST /api/jobs]", err);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || "demo-user";

  const jobs = listJobs(userId);
  return NextResponse.json({ jobs });
}
