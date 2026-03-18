"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IntentEvent {
  id: string;
  companyName: string;
  event: "profile_viewed" | "email_opened" | "link_clicked" | "new_buyer_found";
  detail?: string;
  timestamp: Date;
}

interface PopupToast {
  event: IntentEvent;
  visible: boolean;
}

// ── Hook for managing intent events ──────────────────────────────────────────

/**
 * useIntentEvents — call this in a parent component.
 * Push a new event via pushEvent(), which triggers a 5s auto-dismiss toast.
 */
export function useIntentEvents() {
  const [toasts, setToasts] = useState<PopupToast[]>([]);

  const pushEvent = useCallback((event: Omit<IntentEvent, "id" | "timestamp">) => {
    const full: IntentEvent = {
      ...event,
      id: Math.random().toString(36).slice(2),
      timestamp: new Date(),
    };
    setToasts((prev) => [{ event: full, visible: true }, ...prev].slice(0, 5));

    // Auto-dismiss after 5s
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.event.id === full.id ? { ...t, visible: false } : t))
      );
      // Remove from DOM after fade
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.event.id !== full.id));
      }, 400);
    }, 5000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.event.id === id ? { ...t, visible: false } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.event.id !== id));
    }, 400);
  }, []);

  return { toasts, pushEvent, dismiss };
}

// ── Event config ──────────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<
  IntentEvent["event"],
  { icon: string; label: string; color: string; bg: string; border: string }
> = {
  profile_viewed: {
    icon: "👁",
    label: "查看了你的资料",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  email_opened: {
    icon: "📬",
    label: "打开了开发信",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  link_clicked: {
    icon: "🔗",
    label: "点击了链接",
    color: "text-violet-700",
    bg: "bg-violet-50",
    border: "border-violet-200",
  },
  new_buyer_found: {
    icon: "🎯",
    label: "新买家匹配",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "刚刚";
  if (seconds < 60) return `${seconds}秒前`;
  return `${Math.floor(seconds / 60)}分钟前`;
}

// ── Single Toast ──────────────────────────────────────────────────────────────

function Toast({
  toast,
  onDismiss,
}: {
  toast: PopupToast;
  onDismiss: () => void;
}) {
  const cfg = EVENT_CONFIG[toast.event.event];
  const [timeLabel, setTimeLabel] = useState(timeAgo(toast.event.timestamp));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLabel(timeAgo(toast.event.timestamp));
    }, 5000);
    return () => clearInterval(interval);
  }, [toast.event.timestamp]);

  return (
    <div
      className={`
        flex items-start gap-3 w-72 p-3 rounded-2xl border shadow-lg shadow-slate-200/60
        ${cfg.bg} ${cfg.border}
        transition-all duration-400 ease-out
        ${toast.visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full"}
      `}
      style={{ transition: "opacity 0.35s ease, transform 0.35s ease" }}
    >
      {/* Icon */}
      <div className="text-xl flex-shrink-0 mt-0.5">{cfg.icon}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold ${cfg.color} leading-snug`}>
          {toast.event.companyName}
        </p>
        <p className="text-xs text-slate-600 mt-0.5">{cfg.label}</p>
        {toast.event.detail && (
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">{toast.event.detail}</p>
        )}
        <p className="text-[10px] text-slate-400 mt-1">{timeLabel}</p>
      </div>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors text-xs"
      >
        ×
      </button>
    </div>
  );
}

// ── Container (fixed top-right) ───────────────────────────────────────────────

interface IntentPopupProps {
  toasts: PopupToast[];
  onDismiss: (id: string) => void;
}

export function IntentPopupContainer({ toasts, onDismiss }: IntentPopupProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 items-end"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.event.id}
          toast={toast}
          onDismiss={() => onDismiss(toast.event.id)}
        />
      ))}
    </div>
  );
}
