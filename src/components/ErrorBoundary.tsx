"use client";

/**
 * ErrorBoundary
 *
 * React class-based error boundary. Catches any rendering error inside its
 * children and shows a graceful fallback instead of crashing the entire page.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeComponent />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary fallback={<p>自定义错误提示</p>}>
 *     <SomeComponent />
 *   </ErrorBoundary>
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Custom fallback UI. Defaults to a minimal card with retry button. */
  fallback?: ReactNode;
  /** Label shown in the default fallback (e.g. "买家卡片") */
  label?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || "未知错误",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production, send to error tracking (Sentry etc.)
    if (process.env.NODE_ENV === "development") {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: "" });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 text-center">
          <p className="text-sm text-slate-500 mb-2">
            {this.props.label ? `${this.props.label}加载失败` : "内容加载失败"}
          </p>
          <p className="text-xs text-slate-400 mb-3 font-mono">
            {this.state.errorMessage}
          </p>
          <button
            onClick={this.handleRetry}
            className="text-xs text-primary hover:underline"
          >
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * DrawerErrorBoundary
 *
 * Specialized boundary for the detail drawer — if the drawer itself crashes,
 * show an inline error inside the drawer rather than closing it or crashing
 * the whole page.
 */
export class DrawerErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error?.message || "未知错误" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV === "development") {
      console.error("[DrawerErrorBoundary]", error, info.componentStack);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: "" });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" />
          <div className="w-[580px] bg-white shadow-2xl flex flex-col items-center justify-center gap-4 h-screen">
            <span className="text-4xl">⚠</span>
            <p className="text-base font-semibold text-slate-700">详情加载失败</p>
            <p className="text-xs text-slate-400 font-mono px-8 text-center">
              {this.state.errorMessage}
            </p>
            <button
              onClick={this.handleRetry}
              className="mt-2 px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-600 transition-colors"
            >
              重新加载
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
