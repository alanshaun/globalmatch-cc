"use client";

import type { JobStatus } from "@/hooks/useJobPoller";

interface Props {
  jobStatus: JobStatus;
  progress: number;
  message: string;
  errorMsg: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  idleLabel?: string;
}

export function JobProgressCard({
  jobStatus,
  progress,
  message,
  errorMsg,
  onRetry,
  onDismiss,
  idleLabel = "处理中...",
}: Props) {
  if (jobStatus === "idle" || jobStatus === "completed") return null;

  if (jobStatus === "error") {
    return (
      <div className="bg-danger/5 border border-danger/20 rounded-xl p-5 mb-4">
        <div className="flex items-start gap-3">
          <span className="text-danger text-lg shrink-0">⚠</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-danger">搜索遇到问题</p>
            <p className="text-xs text-danger/80 mt-0.5 break-words">{errorMsg}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-xs px-3 py-1.5 bg-danger text-white rounded-lg font-medium hover:bg-danger/90 transition-colors"
            >
              重试
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-xs px-3 py-1.5 border border-danger/30 text-danger rounded-lg hover:bg-danger/5 transition-colors"
            >
              关闭
            </button>
          )}
        </div>
      </div>
    );
  }

  // starting or running
  const displayMsg = message || idleLabel;
  const isIndeterminate = jobStatus === "starting" || progress === 0;

  return (
    <div className="bg-white border border-border rounded-xl p-5 mb-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
        <span className="text-sm text-primary font-medium flex-1 truncate">{displayMsg}</span>
        {progress > 0 && (
          <span className="text-xs text-muted shrink-0">{progress}%</span>
        )}
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        {isIndeterminate ? (
          <div className="h-full bg-primary/40 rounded-full animate-pulse" style={{ width: "30%" }} />
        ) : (
          <div
            className="h-full bg-primary rounded-full transition-all duration-700"
            style={{ width: `${Math.min(progress, 99)}%` }}
          />
        )}
      </div>
      <p className="text-xs text-muted mt-2">
        你可以切换到其他页面，任务在后台自动继续
      </p>
    </div>
  );
}
