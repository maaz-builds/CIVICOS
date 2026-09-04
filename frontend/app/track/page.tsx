"use client";

import { useEffect, useState } from "react";

import {
  getComplaintByTrackingId,
  type StoredComplaint,
} from "@/services/api";

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-blue-500/15 text-blue-300 ring-blue-500/40",
  assigned: "bg-amber-500/15 text-amber-300 ring-amber-500/40",
  "in progress": "bg-violet-500/15 text-violet-300 ring-violet-500/40",
  resolved: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40",
};

function statusStyle(status: string): string {
  return STATUS_STYLES[status.toLowerCase()] ?? "bg-slate-500/15 text-slate-300 ring-slate-500/40";
}

export default function TrackPage() {
  const [trackingId, setTrackingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StoredComplaint | null>(null);
  const [error, setError] = useState("");

  const lookup = async (id: string) => {
    if (!id.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult(await getComplaintByTrackingId(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const track = async (e: React.FormEvent) => {
    e.preventDefault();
    await lookup(trackingId.trim());
  };

  // When arriving from the report page's duplicate notice (?tracking=CF-…),
  // look the existing complaint up straight away so the citizen doesn't have
  // to type the ID again.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("tracking");
    if (id) void lookup(id);
    // Intentionally runs once on mount - no state participates in the lookup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-4xl font-bold tracking-tight">
          Track a Complaint
        </h1>
        <p className="mt-2 text-slate-400">
          Enter the CF- tracking ID you got when you reported the issue.
        </p>

        <form onSubmit={track} className="mt-8 flex gap-3">
          <input
            type="text"
            value={trackingId}
            onChange={(e) => setTrackingId(e.target.value)}
            placeholder="CF-2026-XXXXXX"
            className="flex-1 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 font-mono text-sm text-white placeholder-slate-500 outline-none focus:border-chakra-400"
          />
          <button
            type="submit"
            disabled={loading || !trackingId.trim()}
            className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500 disabled:bg-slate-700"
          >
            {loading ? "Looking up..." : "Track"}
          </button>
        </form>

        {error && (
          <div className="mt-6 rounded-xl border border-rose-800 bg-rose-950/50 p-4 text-sm text-rose-200">
            {error}
          </div>
        )}

        {result && (
          <div className="glass mt-8 rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-400">Tracking ID</p>
                <p className="font-mono text-xl font-bold text-blue-300">
                  {result.tracking_id}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1.5 text-sm font-semibold capitalize ring-1 ${statusStyle(result.status)}`}
              >
                {result.status}
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-slate-400">Issue</p>
                <p className="text-lg font-bold">{result.issue_type}</p>
              </div>

              {result.severity && (
                <div>
                  <p className="text-slate-400">Severity</p>
                  <p className="text-lg font-bold">{result.severity}</p>
                </div>
              )}

              {result.ward && (
                <div>
                  <p className="text-slate-400">Area</p>
                  <p className="text-lg font-bold">{result.ward}</p>
                </div>
              )}

              {result.department && (
                <div>
                  <p className="text-slate-400">Assigned department</p>
                  <p className="text-lg font-bold">{result.department}</p>
                </div>
              )}
            </div>

            {result.description && (
              <div className="mt-4">
                <p className="text-slate-400">Description</p>
                <p className="mt-1 text-slate-200">{result.description}</p>
              </div>
            )}

            {result.image_url &&
              (/\\.(mp4|webm|mov)(\?|$)/i.test(result.image_url) ? (
                <video
                  src={result.image_url}
                  controls
                  muted
                  playsInline
                  className="mt-5 max-h-96 w-full rounded-xl bg-black object-contain ring-1 ring-slate-700"
                />
              ) : (
                <img
                  src={result.image_url}
                  alt={`Photo of the ${result.issue_type} reported`}
                  className="mt-5 max-h-96 w-full rounded-xl object-cover ring-1 ring-slate-700"
                />
              ))}

            <p className="mt-6 text-xs text-slate-500">
              Reported {new Date(result.created_at).toLocaleString()}
            </p>

            {result.whatsapp_link && (
              <div className="mt-4 rounded-xl border border-emerald-800/60 bg-emerald-900/30 p-4">
                <a
                  href={result.whatsapp_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-6 py-3 font-semibold text-slate-950 transition hover:bg-[#1fbd56]"
                >
                  📲 Send grievance to GHMC on WhatsApp
                </a>
                <p className="mt-2 text-center text-xs text-emerald-200/70">
                  Opens WhatsApp with this grievance pre-filled for GHMC's
                  official channel (MyCUREApp) — issue, ward, photo link and
                  tracking ID included.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}