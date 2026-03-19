"use client";

/**
 * useJobPoller — shared hook for all 3 search pages.
 *
 * Guarantees:
 * - Loading state NEVER disappears without user seeing either results or an error
 * - Network errors → auto-reconnect (up to MAX_RETRIES)
 * - Job failure → shows error with a retry button
 * - No flash-exit under any circumstance
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { apiFetch, apiPost } from "@/lib/apiClient";
import { useTask } from "@/contexts/TaskContext";

export type JobStatus = "idle" | "starting" | "running" | "completed" | "error";

export interface JobPollerState {
  jobStatus: JobStatus;
  progress: number;
  message: string;
  errorMsg: string;
  jobId: string | null;
}

export interface UseJobPollerOptions {
  jobType: string;
  userId?: string;
  pollIntervalMs?: number;
  onCompleted?: (output: unknown, jobId: string) => void;
  onFailed?: (error: string) => void;
}

const POLL_MS = 3_000;
const MAX_POLL_ERRORS = 6;   // ~18s of consecutive failures before giving up

export function useJobPoller(opts: UseJobPollerOptions) {
  const { jobType, userId = "demo-user", onCompleted, onFailed } = opts;

  const [state, setState] = useState<JobPollerState>({
    jobStatus: "idle",
    progress: 0,
    message: "",
    errorMsg: "",
    jobId: null,
  });

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const pollErrors = useRef(0);
  const latestJobId = useRef<string | null>(null);
  const isMounted = useRef(true);
  const { trackJob } = useTask();

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      stopPolling();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function set(partial: Partial<JobPollerState>) {
    if (isMounted.current) setState((s) => ({ ...s, ...partial }));
  }

  const pollOnce = useCallback(async (jobId: string) => {
    const { data, ok } = await apiFetch<{ job: JobPollerState & { output?: unknown; error?: string; status: string } }>(
      `/api/jobs/${jobId}`,
      { timeoutMs: 8_000, retries: 1 }
    );

    if (!isMounted.current) return;

    if (!ok || !data?.job) {
      pollErrors.current += 1;
      if (pollErrors.current >= MAX_POLL_ERRORS) {
        stopPolling();
        set({
          jobStatus: "error",
          errorMsg: "连接中断，请检查网络后重试",
        });
      }
      // Otherwise keep polling silently (transient network error)
      return;
    }

    pollErrors.current = 0;
    const job = data.job;

    set({
      progress: job.progress ?? 0,
      message: (job as unknown as { message?: string }).message ?? "",
    });

    if (job.status === "completed") {
      stopPolling();
      set({ jobStatus: "completed", progress: 100 });
      onCompleted?.(job.output, jobId);
    } else if (job.status === "failed") {
      stopPolling();
      const errMsg = (job as unknown as { error?: string }).error || "搜索失败，请重试";
      set({ jobStatus: "error", errorMsg: errMsg });
      onFailed?.(errMsg);
    }
  }, [onCompleted, onFailed]);

  function startPolling(jobId: string) {
    stopPolling();
    pollErrors.current = 0;
    latestJobId.current = jobId;
    pollOnce(jobId);
    pollRef.current = setInterval(() => pollOnce(jobId), POLL_MS);
  }

  /** Start a new job. Input = body sent to POST /api/jobs */
  const startJob = useCallback(async (input: unknown) => {
    set({ jobStatus: "starting", progress: 0, message: "正在启动...", errorMsg: "", jobId: null });

    const { data, ok, error } = await apiPost<{ jobId: string }>(
      "/api/jobs",
      { type: jobType, input, userId },
      { timeoutMs: 15_000, retries: 3 }   // generous retries for job creation
    );

    if (!isMounted.current) return;

    if (!ok || !data?.jobId) {
      set({
        jobStatus: "error",
        errorMsg: error || "启动失败，请重试",
      });
      return;
    }

    const jobId = data.jobId;
    set({ jobStatus: "running", jobId });
    trackJob(jobId);
    startPolling(jobId);
  }, [jobType, userId, trackJob, pollOnce]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Resume polling for an existing job (e.g. after navigation) */
  const resumeJob = useCallback((jobId: string, currentProgress = 0, currentMessage = "") => {
    set({ jobStatus: "running", jobId, progress: currentProgress, message: currentMessage, errorMsg: "" });
    startPolling(jobId);
  }, [pollOnce]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback(() => {
    stopPolling();
    set({ jobStatus: "idle", progress: 0, message: "", errorMsg: "", jobId: null });
  }, []);

  return { ...state, startJob, resumeJob, reset, stopPolling };
}
