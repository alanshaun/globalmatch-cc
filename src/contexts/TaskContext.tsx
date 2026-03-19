"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

export interface TaskJob {
  id: string;
  type: "buyer" | "radar" | "supply-chain";
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
  trackJob: (jobId: string) => void;
  getJob: (jobId: string) => TaskJob | undefined;
  refreshJobs: () => void;
}

const TaskContext = createContext<TaskContextValue>({
  jobs: [],
  activeCount: 0,
  trackJob: () => {},
  getJob: () => undefined,
  refreshJobs: () => {},
});

const USER_ID = "demo-user";
const POLL_INTERVAL = 3000;

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<TaskJob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs?userId=${USER_ID}`);
      if (!res.ok) return;
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch {
      // silently ignore
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Poll while there are active jobs
  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === "pending" || j.status === "running");

    if (hasActive && !intervalRef.current) {
      intervalRef.current = setInterval(fetchJobs, POLL_INTERVAL);
    } else if (!hasActive && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [jobs, fetchJobs]);

  const trackJob = useCallback(
    (jobId: string) => {
      // Immediately refresh to pick up the new job
      fetchJobs();
      // Ensure polling starts
      if (!intervalRef.current) {
        intervalRef.current = setInterval(fetchJobs, POLL_INTERVAL);
      }
    },
    [fetchJobs]
  );

  const getJob = useCallback(
    (jobId: string) => jobs.find((j) => j.id === jobId),
    [jobs]
  );

  const activeCount = jobs.filter(
    (j) => j.status === "pending" || j.status === "running"
  ).length;

  return (
    <TaskContext.Provider value={{ jobs, activeCount, trackJob, getJob, refreshJobs: fetchJobs }}>
      {children}
    </TaskContext.Provider>
  );
}

export const useTask = () => useContext(TaskContext);
