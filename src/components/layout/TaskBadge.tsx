"use client";

import { useState } from "react";
import { useTask } from "@/contexts/TaskContext";

const TYPE_LABELS: Record<string, string> = {
  buyer: "找买家",
  radar: "验品雷达",
  "supply-chain": "找供应链",
};

const TYPE_ICONS: Record<string, string> = {
  buyer: "🎯",
  radar: "📡",
  "supply-chain": "🔗",
};

export function TaskBadge() {
  const { jobs, activeCount, networkOk } = useTask();
  const [open, setOpen] = useState(false);

  const recentJobs = jobs.slice(0, 10);

  return (
    <div className="flex items-center gap-2">
      {!networkOk && (
        <span className="text-xs text-danger bg-danger/10 border border-danger/20 px-2 py-1 rounded-lg">
          ⚠ 连接中断，重试中...
        </span>
      )}
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
          activeCount > 0
            ? "bg-primary text-white border-primary shadow-sm"
            : recentJobs.length === 0
            ? "hidden"
            : "bg-white text-foreground border-border hover:border-primary/50"
        }`}
      >
        {activeCount > 0 ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            {activeCount} 个任务进行中
          </>
        ) : (
          <>
            <span>✓</span>
            查看任务历史
          </>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-border rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">搜索任务</p>
              {activeCount > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                  {activeCount} 进行中
                </span>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-border/50">
              {recentJobs.map((job) => (
                <div key={job.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{TYPE_ICONS[job.type] || "🔍"}</span>
                      <span className="text-xs font-medium text-foreground">
                        {TYPE_LABELS[job.type] || job.type}
                      </span>
                    </div>
                    <StatusChip status={job.status} />
                  </div>

                  <p className="text-xs text-muted truncate">{job.message || "处理中..."}</p>

                  {(job.status === "pending" || job.status === "running") && (
                    <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  )}

                  <p className="text-[10px] text-muted/60 mt-1">
                    {new Date(job.createdAt).toLocaleTimeString("zh-CN")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "等待中", cls: "bg-gray-100 text-gray-500" },
    running: { label: "进行中", cls: "bg-primary/10 text-primary" },
    completed: { label: "已完成", cls: "bg-success/10 text-success" },
    failed: { label: "失败", cls: "bg-danger/10 text-danger" },
  };
  const { label, cls } = map[status] || { label: status, cls: "bg-gray-100 text-gray-500" };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>;
}
