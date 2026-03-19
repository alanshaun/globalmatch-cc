/**
 * Resilient API client — used by ALL frontend fetch calls.
 *
 * Features:
 * - Configurable timeout (default 30s)
 * - Automatic retry with exponential backoff
 * - Never throws — always returns { data, error }
 * - AbortController cleanup on unmount
 */

export interface ApiResult<T> {
  data: T | null;
  error: string | null;
  status: number;
  ok: boolean;
}

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;        // default 30_000
  retries?: number;          // default 2
  retryDelayMs?: number;     // default 800 (doubles each attempt)
  signal?: AbortSignal;      // pass component's AbortController signal
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function apiFetch<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<ApiResult<T>> {
  const {
    timeoutMs = 30_000,
    retries = 2,
    retryDelayMs = 800,
    signal: externalSignal,
    ...fetchOptions
  } = options;

  let lastError = "";
  let lastStatus = 0;

  for (let attempt = 0; attempt <= retries; attempt++) {
    // Abort if the caller's signal fired
    if (externalSignal?.aborted) {
      return { data: null, error: "请求已取消", status: 0, ok: false };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Combine caller signal + timeout signal
    const combinedSignal = externalSignal
      ? AbortSignal.any
        ? AbortSignal.any([externalSignal, controller.signal])
        : controller.signal
      : controller.signal;

    try {
      const res = await fetch(url, { ...fetchOptions, signal: combinedSignal });
      clearTimeout(timeoutId);
      lastStatus = res.status;

      if (res.ok) {
        const data = (await res.json().catch(() => null)) as T;
        return { data, error: null, status: res.status, ok: true };
      }

      // Non-2xx: try to parse error message
      const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      lastError = errBody?.error || errBody?.message || `HTTP ${res.status}`;

      // Don't retry 4xx (client errors)
      if (res.status >= 400 && res.status < 500) {
        return { data: null, error: lastError, status: res.status, ok: false };
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (externalSignal?.aborted) {
        return { data: null, error: "请求已取消", status: 0, ok: false };
      }
      lastError = err instanceof Error
        ? err.name === "AbortError" ? "请求超时，请重试" : err.message
        : "网络错误";
      lastStatus = 0;
    }

    // Wait before retry (skip on last attempt)
    if (attempt < retries) {
      await sleep(retryDelayMs * Math.pow(2, attempt));
    }
  }

  return { data: null, error: lastError || "请求失败，请重试", status: lastStatus, ok: false };
}

/** POST convenience wrapper */
export function apiPost<T = unknown>(url: string, body: unknown, opts?: FetchOptions) {
  return apiFetch<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...opts,
  });
}
