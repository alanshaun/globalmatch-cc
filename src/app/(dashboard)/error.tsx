"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="max-w-sm w-full mx-4 bg-white border border-border rounded-xl p-6 text-center">
        <div className="text-3xl mb-3">⚠️</div>
        <h3 className="text-sm font-semibold text-foreground mb-1">页面加载出错</h3>
        <p className="text-xs text-muted mb-4">{error?.message || "请刷新重试"}</p>
        <button
          onClick={reset}
          className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-primary/90"
        >
          重试
        </button>
      </div>
    </div>
  );
}
