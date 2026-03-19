"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { apiFetch } from "@/lib/apiClient";

export interface TaskJob {
  id: string;
  type: "buyer" | "radar" | "supply-chain" | string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  message: string;
  sessionId?: string | null;
  createdAt: string;
  completedAt?: string | null;
  error?: string | null;
}

interface TaskContextValue {
  jobs: TaskJob[];
  activeCount: number;
  networkOk: boolean;          // false = polling is failing
  trackJob: (jobId: string) => void;
  getJob: (jobId: string) => TaskJob | undefined;
  refreshJobs: () => void;
}

const TaskContext = createContext<TaskContextValue>({
  jobs: [],
  activeCount: 0,
  networkOk: true,
  trackJob: () => {},
  getJob: () => undefined,
  refreshJobs: () => {},
});

const USER_ID = "demo-user";
const POLL_INTERVAL_ACTIVE = 3_000;   // 3s while jobs are running
const POLL_INTERVAL_IDLE = 15_000;    // 15s when idle
const MAX_CONSECUTIVE_ERRORS = 5;     // back off after this many failures
const BACKOFF_DELAY_MS = 10_000;      // wait 10s after too many errors

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<TaskJob[]>([]);
  const [networkOk, setNetworkOk] = useState(true);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const consecutiveErrors = useRef(0);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const fetchJobs = useCallback(async () => {
    const { data, ok } = await apiFetch<{ jobs: TaskJob[] }>(
      `/api/jobs?userId=${USER_ID}`,
      { timeoutMs: 8_000, retries: 1 }
    );

    if (!isMounted.current) return;

    if (ok && data) {
      setJobs(data.jobs || []);
      consecutiveErrors.current = 0;
      setNetworkOk(true);
    } else {
      consecutiveErrors.current += 1;
      if (consecutiveErrors.current >= MAX_CONSECUTIVE_ERRORS) {
        setNetworkOk(false);
        // Back off: stop polling for a bit
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setTimeout(() => {
          if (isMounted.current) {
            consecutiveErrors.current = 0;
            setNetworkOk(true);
            schedulePolling();
          }
        }, BACKOFF_DELAY_MS);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const schedulePolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    const hasActive = jobs.some(
      (j) => j.status === "pending" || j.status === "running"
    );
    const delay = hasActive ? POLL_INTERVAL_ACTIVE : POLL_INTERVAL_IDLE;
    intervalRef.current = setInterval(fetchJobs, delay);
  }, [jobs, fetchJobs]);

  // Initial load
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Re-schedule polling when job list changes
  useEffect(() => {
    schedulePolling();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [schedulePolling]);

  const trackJob = useCallback(() => {
    // Immediately refresh and ensure fast polling
    fetchJobs();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchJobs, POLL_INTERVAL_ACTIVE);
  }, [fetchJobs]);

  const getJob = useCallback(
    (jobId: string) => jobs.find((j) => j.id === jobId),
    [jobs]
  );

  const activeCount = jobs.filter(
    (j) => j.status === "pending" || j.status === "running"
  ).length;

  return (
    <TaskContext.Provider
      value={{ jobs, activeCount, networkOk, trackJob, getJob, refreshJobs: fetchJobs }}
    >
      {children}
    </TaskContext.Provider>
  );
}

export const useTask = () => useContext(TaskContext);
