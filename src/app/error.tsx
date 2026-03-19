"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-4 bg-white border border-border rounded-2xl p-8 text-center shadow-sm">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-lg font-semibold text-foreground mb-2">页面遇到问题</h2>
        <p className="text-sm text-muted mb-6">
          {error?.message || "发生了意外错误，请刷新重试"}
        </p>
        <button
          onClick={reset}
          className="bg-primary text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          重新加载
        </button>
      </div>
    </div>
  );
}
