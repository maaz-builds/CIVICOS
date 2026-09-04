/**
 * GHMC (Greater Hyderabad Municipal Corporation) demo portal - the receiving
 * side of the CivicFix pipeline.
 *
 * NOT affiliated with GHMC. It reads REAL complaints that citizens filed via
 * CivicFix (GET /complaints) and lets the "department" advance their status
 * (PATCH /complaints/{id}/status). The citizen sees the change instantly on
 * /track - closing the loop: report on /report -> work it here -> watch on
 * /track.
 *
 * DEMO-GRADE: no login - anyone reaching this page can change statuses,
 * matching the anon-key RLS policies in backend/supabase/schema.sql.
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import {
  listComplaints,
  updateComplaintStatus,
  type ComplaintStatus,
  type StoredComplaint,
} from "@/services/api";

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  submitted: "New",
  assigned: "Assigned",
  "in progress": "In Progress",
  resolved: "Resolved",
};

const STATUS_ORDER: ComplaintStatus[] = [
  "submitted",
  "assigned",
  "in progress",
  "resolved",
];

const statusStyles: Record<ComplaintStatus, string> = {
  submitted: "bg-blue-50 text-blue-700 ring-blue-200",
  assigned: "bg-amber-50 text-amber-700 ring-amber-200",
  "in progress": "bg-violet-50 text-violet-700 ring-violet-200",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

function severityStyle(severity: string | null | undefined): string {
  const key = (severity ?? "").toLowerCase();
  if (key === "critical") return "text-rose-600";
  if (key === "high") return "text-orange-600";
  if (key === "medium") return "text-amber-600";
  if (key === "low") return "text-slate-500";
  return "text-slate-400";
}

function displayLocation(c: StoredComplaint): string {
  if (c.ward) return c.ward;
  if (typeof c.lat === "number" && typeof c.lng === "number") {
    return `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`;
  }
  return "—";
}

export default function GhmcPortalPage() {
  const [complaints, setComplaints] = useState<StoredComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await listComplaints(100);
      setComplaints(rows);
      setError("");
    } catch (err) {
      // Keep existing rows on a failed auto-refresh; only surface the error
      // when we have nothing to show yet.
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load]);

  const changeStatus = async (
    trackingId: string,
    status: ComplaintStatus
  ) => {
    // Optimistic update so the row feels instant; revert on failure.
    const previous = complaints;
    setNotice("");
    setError("");
    setSavingId(trackingId);
    setComplaints((rows) =>
      rows.map((c) => (c.tracking_id === trackingId ? { ...c, status } : c))
    );
    try {
      const updated = await updateComplaintStatus(trackingId, status);
      setComplaints((rows) =>
        rows.map((c) => (c.tracking_id === trackingId ? updated : c))
      );
      setNotice(
        `${trackingId} marked ${STATUS_LABELS[status].toLowerCase()} - the citizen can now see it on /track.`
      );
    } catch (err) {
      setComplaints(previous);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingId(null);
    }
  };

  const counts = {
    total: complaints.length,
    submitted: complaints.filter((c) => c.status === "submitted").length,
    inProgress: complaints.filter((c) => c.status === "in progress").length,
    resolved: complaints.filter((c) => c.status === "resolved").length,
  };

  const stats = [
    { label: "Total complaints", value: counts.total, color: "text-slate-900" },
    { label: "New", value: counts.submitted, color: "text-blue-600" },
    { label: "In progress", value: counts.inProgress, color: "text-violet-600" },
    { label: "Resolved", value: counts.resolved, color: "text-emerald-600" },
  ];

  return (
    <main className="min-h-screen bg-slate-100">
      {/* Demo notice */}
      <div className="bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-amber-950">
        ⚠️ DEMO PAGE — not affiliated with GHMC. Shows real CivicFix complaints
        and lets you advance their status (no login, demo-grade only).
      </div>

      {/* Government header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="grid size-12 place-items-center rounded-full bg-blue-700 text-center text-[10px] font-bold leading-tight text-white ring-2 ring-blue-200">
              GHMC
              <br />
              HYD
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Greater Hyderabad Municipal Corporation
              </h1>
              <p className="text-sm text-slate-500">
                Civic Complaint Portal · Citizen Grievance Cell
              </p>
            </div>
          </div>
          <span className="hidden rounded-full bg-slate-100 px-4 py-1.5 text-xs font-medium text-slate-600 sm:inline-block">
            Complaint No. {counts.total.toString().padStart(4, "0")}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Connection status + actions */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          {loading ? (
            <span className="flex items-center gap-2 rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
              Connecting to CivicFix backend…
            </span>
          ) : error ? (
            <span className="flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
              <span className="size-1.5 rounded-full bg-rose-500" />
              BACKEND OFFLINE — {error}
            </span>
          ) : (
            <span className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              LIVE — {counts.total} complaints from CivicFix
            </span>
          )}

          {!loading && (
            <div className="flex items-center gap-3">
              {notice && (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-200">
                  {notice}
                </span>
              )}
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                ⟳ Refresh
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className={`text-3xl font-extrabold ${s.color}`}>{s.value}</p>
              <p className="mt-1 text-sm text-slate-500">{s.label}</p>
            </div>
          ))}
        </section>

        {/* Live complaints feed */}
        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">
              Complaints received from CivicFix
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Change the status to advance a complaint — it updates the
              citizen&apos;s view on the Track page instantly.
            </p>
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
              Loading complaints…
            </div>
          ) : complaints.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              {error ? (
                <p className="text-sm text-rose-600">
                  Could not reach the backend. Is the FastAPI service running
                  (or are SUPABASE_URL/SUPABASE_ANON_KEY set on Vercel)?
                </p>
              ) : (
                <>
                  <p className="text-lg font-semibold text-slate-700">
                    No complaints yet
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    File one from the citizen side and it will appear here
                    within seconds.
                  </p>
                  <a
                    href="/report"
                    className="mt-4 inline-block rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    📷 Report an Issue
                  </a>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-semibold">Photo</th>
                    <th className="px-4 py-3 font-semibold">Tracking ID</th>
                    <th className="px-4 py-3 font-semibold">Issue</th>
                    <th className="px-4 py-3 font-semibold">Ward / Location</th>
                    <th className="px-4 py-3 font-semibold">Department</th>
                    <th className="px-4 py-3 font-semibold">Severity</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Reported</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {complaints.map((c) => (
                    <tr key={c.tracking_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        {c.image_url ? (
                          <img
                            src={c.image_url}
                            alt={`Photo of the ${c.issue_type}`}
                            className="h-12 w-16 rounded-lg object-cover ring-1 ring-slate-200"
                          />
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">
                        {c.tracking_id}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {c.issue_type}
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-3 text-slate-600">
                        {displayLocation(c)}
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-3 text-slate-600">
                        {c.department ?? "Unassigned"}
                      </td>
                      <td className={`px-4 py-3 font-semibold ${severityStyle(c.severity)}`}>
                        {c.severity ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <select
                            value={c.status}
                            disabled={savingId === c.tracking_id}
                            onChange={(e) =>
                              void changeStatus(
                                c.tracking_id,
                                e.target.value as ComplaintStatus
                              )
                            }
                            className={`rounded-full border-0 py-1 pl-3 pr-8 text-xs font-semibold ring-1 outline-none focus:ring-2 disabled:opacity-60 ${statusStyles[c.status as ComplaintStatus] ?? statusStyles.submitted}`}
                          >
                            {STATUS_ORDER.map((s) => (
                              <option key={s} value={s}>
                                {STATUS_LABELS[s]}
                              </option>
                            ))}
                          </select>
                          {savingId === c.tracking_id && (
                            <span className="text-xs text-slate-400">
                              saving…
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Demo explanation */}
        <section className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
          <p className="font-semibold">What you&apos;re looking at</p>
          <p className="mt-1 leading-relaxed">
            Real complaints filed through CivicFix&apos;s{" "}
            <code className="rounded bg-blue-100 px-1 py-0.5 font-mono text-xs">
              POST /complaints
            </code>{" "}
            endpoint (vision → location → routing handled by the LangGraph
            pipeline). Changing a row&apos;s status calls{" "}
            <code className="rounded bg-blue-100 px-1 py-0.5 font-mono text-xs">
              PATCH /complaints/{"{id}"}/status
            </code>
            , and the citizen sees the update immediately on the{" "}
            <a href="/track" className="font-semibold underline">
              Track page
            </a>
            .
          </p>
        </section>
      </div>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        Demo only · Not the official GHMC website · Made for the CivicFix
        hackathon demo
      </footer>
    </main>
  );
}
