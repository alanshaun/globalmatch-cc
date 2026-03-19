/**
 * GET /api/debug — Check system status (dev only)
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const results: Record<string, string> = {};

  // Test DB
  try {
    const { prisma } = await import("@/lib/db");
    await prisma.$queryRaw`SELECT 1`;
    results.db = "ok";
  } catch (e) {
    results.db = `error: ${e}`;
  }

  // Test jobStore
  try {
    const { createJob, getJob } = await import("@/lib/jobStore");
    const j = createJob("test", {}, "debug");
    results.jobStore = getJob(j.id) ? "ok" : "error: job not found";
  } catch (e) {
    results.jobStore = `error: ${e}`;
  }

  // Test jobRunner import
  try {
    await import("@/lib/jobRunner");
    results.jobRunner = "ok";
  } catch (e) {
    results.jobRunner = `error: ${e}`;
  }

  // Env vars
  results.anthropicKey = process.env.ANTHROPIC_API_KEY ? "set" : "MISSING";
  results.serpApiKey = process.env.SERPAPI_KEY ? "set" : "missing (optional)";
  results.databaseUrl = process.env.DATABASE_URL ? "set" : "MISSING";
  results.nodeEnv = process.env.NODE_ENV || "unknown";

  return NextResponse.json(results);
}
