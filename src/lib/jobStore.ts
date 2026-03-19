/**
 * In-memory job store — works even without a database.
 * Jobs are persisted to DB when available (best-effort), but the
 * in-memory store is always the source of truth for the current process.
 */

import { prisma } from "./db";

export interface JobState {
  id: string;
  type: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  message: string;
  output?: unknown;
  error?: string;
  sessionId?: string;
  userId: string;
  createdAt: string;
  completedAt?: string;
}

// Module-level singleton — survives multiple HTTP requests
const store = new Map<string, JobState>();

function cuid(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `job_${ts}_${rand}`;
}

export function createJob(type: string, input: unknown, userId: string): JobState {
  const job: JobState = {
    id: cuid(),
    type,
    status: "pending",
    progress: 0,
    message: "任务已创建，准备开始...",
    userId,
    createdAt: new Date().toISOString(),
  };
  store.set(job.id, job);

  // Persist to DB (fire-and-forget — if it fails, in-memory still works)
  prisma.searchJob
    .create({ data: { id: job.id, type, input: input as object, userId, status: "pending", message: job.message } })
    .catch(() => {});

  return job;
}

export function getJob(jobId: string): JobState | undefined {
  return store.get(jobId);
}

export function listJobs(userId: string): JobState[] {
  return [...store.values()]
    .filter((j) => j.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 30);
}

export function updateJob(jobId: string, updates: Partial<JobState>): void {
  const job = store.get(jobId);
  if (!job) return;
  Object.assign(job, updates);

  // Sync to DB best-effort
  prisma.searchJob
    .update({ where: { id: jobId }, data: updates as Record<string, unknown> })
    .catch(() => {});
}

/**
 * On startup: load recent jobs from DB into memory so jobs survive
 * a server restart (when DB is available).
 */
export async function hydrateFromDB(): Promise<void> {
  try {
    const jobs = await prisma.searchJob.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    for (const j of jobs) {
      if (!store.has(j.id)) {
        store.set(j.id, {
          id: j.id,
          type: j.type,
          status: j.status as JobState["status"],
          progress: j.progress,
          message: j.message,
          output: j.output ?? undefined,
          error: j.error ?? undefined,
          sessionId: j.sessionId ?? undefined,
          userId: j.userId,
          createdAt: j.createdAt.toISOString(),
          completedAt: j.completedAt?.toISOString(),
        });
      }
    }
  } catch {
    // DB not available — in-memory only, that's fine
  }
}
