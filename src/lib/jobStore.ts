/**
 * In-memory job store — NEVER fails, works without any database.
 * DB sync is completely optional and lazy — loaded only when needed.
 * If Prisma/DB is unavailable, in-memory operations still succeed.
 */

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

// Lazy DB accessor — never throws at module load time
function getDB() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./db").prisma as import("@prisma/client").PrismaClient;
  } catch {
    return null;
  }
}

function syncCreate(job: JobState, input: unknown) {
  try {
    const db = getDB();
    if (!db) return;
    db.searchJob
      .create({
        data: {
          id: job.id,
          type: job.type,
          input: input as object,
          userId: job.userId,
          status: "pending",
          message: job.message,
        },
      })
      .catch(() => {});
  } catch {
    // DB unavailable — in-memory works fine
  }
}

function syncUpdate(jobId: string, updates: Partial<JobState>) {
  try {
    const db = getDB();
    if (!db) return;
    db.searchJob
      .update({ where: { id: jobId }, data: updates as Record<string, unknown> })
      .catch(() => {});
  } catch {
    // DB unavailable — ignore
  }
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
  syncCreate(job, input);
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
  syncUpdate(jobId, updates);
}

/**
 * On startup: load recent jobs from DB into memory (optional).
 * Safe to call even when DB is unavailable.
 */
export async function hydrateFromDB(): Promise<void> {
  try {
    const db = getDB();
    if (!db) return;
    const jobs = await db.searchJob.findMany({
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
