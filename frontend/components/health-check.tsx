"use client";

import { useState } from "react";

import { API_BASE_URL, checkBackendHealth } from "@/services/api";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

/** Visual styling per connection phase. */
const INDICATORS: Record<Status["kind"], { dot: string; box: string }> = {
  idle: {
    dot: "bg-slate-300",
    box: "border-slate-200 bg-slate-50 text-slate-500",
  },
  loading: {
    dot: "animate-pulse bg-amber-400",
    box: "border-amber-200 bg-amber-50 text-amber-700",
  },
  success: {
    dot: "bg-emerald-500",
    box: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  error: {
    dot: "bg-rose-500",
    box: "border-rose-200 bg-rose-50 text-rose-600",
  },
};

export default function HealthCheck() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const busy = status.kind === "loading";
  const indicator = INDICATORS[status.kind];

  const message =
    status.kind === "idle"
      ? "Not checked yet. Press the button to ping the backend."
      : status.kind === "loading"
        ? "Checking the backend connection..."
        : status.message;

  async function handleCheck() {
    setStatus({ kind: "loading" });
    try {
      const health = await checkBackendHealth();
      setStatus({
        kind: "success",
        message: `Connected to "${health.service}" - it reports status "${health.status}".`,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setStatus({
        kind: "error",
        message: `Could not reach the backend (${reason}). Make sure it is running on port 8000, then try again.`,
      });
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div
        aria-live="polite"
        className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${indicator.box}`}
      >
        <span
          aria-hidden="true"
          className={`mt-1.5 size-2.5 shrink-0 rounded-full ${indicator.dot}`}
        />
        <p className="text-sm font-medium leading-relaxed">{message}</p>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-400">
          Calls{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
            {API_BASE_URL}/health
          </code>{" "}
          from the browser.
        </p>
        <button
          type="button"
          onClick={handleCheck}
          disabled={busy}
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Checking..." : "Check Backend"}
        </button>
      </div>
    </div>
  );
}
