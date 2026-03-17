/**
 * BullMQ Queues - handles concurrent task processing
 * Falls back to inline execution if Redis is unavailable
 */

import { Queue, Worker, Job, QueueEvents } from "bullmq";

let redisConnection: { host: string; port: number; password?: string } | null =
  null;

function parseRedisUrl(url: string) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || "6379"),
      password: parsed.password || undefined,
    };
  } catch {
    return { host: "localhost", port: 6379 };
  }
}

function getRedisConnection() {
  if (!redisConnection) {
    const url = process.env.REDIS_URL || "redis://localhost:6379";
    redisConnection = parseRedisUrl(url);
  }
  return redisConnection;
}

// Queue names
export const QUEUE_NAMES = {
  SEARCH: "search-tasks",
  ANALYSIS: "analysis-tasks",
  EMAIL: "email-tasks",
} as const;

// Inline fallback executor (no Redis needed)
const inlineSlots = { count: 0, max: 50 };

export async function executeInline<T>(
  fn: () => Promise<T>
): Promise<T> {
  while (inlineSlots.count >= inlineSlots.max) {
    await new Promise((r) => setTimeout(r, 100));
  }
  inlineSlots.count++;
  try {
    return await fn();
  } finally {
    inlineSlots.count--;
  }
}

// Queue factory with Redis fallback
let searchQueue: Queue | null = null;
let analysisQueue: Queue | null = null;
let emailQueue: Queue | null = null;

export function getSearchQueue(): Queue | null {
  if (!searchQueue) {
    try {
      searchQueue = new Queue(QUEUE_NAMES.SEARCH, {
        connection: getRedisConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      });
    } catch (err) {
      console.warn("[Queue] Redis unavailable, using inline execution:", err);
      return null;
    }
  }
  return searchQueue;
}

export function getAnalysisQueue(): Queue | null {
  if (!analysisQueue) {
    try {
      analysisQueue = new Queue(QUEUE_NAMES.ANALYSIS, {
        connection: getRedisConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      });
    } catch (err) {
      console.warn("[Queue] Analysis queue unavailable:", err);
      return null;
    }
  }
  return analysisQueue;
}

export function getEmailQueue(): Queue | null {
  if (!emailQueue) {
    try {
      emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
        connection: getRedisConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      });
    } catch (err) {
      console.warn("[Queue] Email queue unavailable:", err);
      return null;
    }
  }
  return emailQueue;
}

// Add job to queue with inline fallback
export async function enqueueJob<T>(
  queueFn: () => Queue | null,
  jobName: string,
  data: T,
  inlineFn?: () => Promise<unknown>
): Promise<string> {
  const queue = queueFn();
  if (queue) {
    const job = await queue.add(jobName, data);
    return job.id || "unknown";
  }

  // Inline fallback
  if (inlineFn) {
    void executeInline(inlineFn);
  }
  return `inline-${Date.now()}`;
}

// Concurrent batch processor
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency = 5
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(processor));
    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      }
    }
  }
  return results;
}

export type { Queue, Worker, Job, QueueEvents };
