"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import NearbyMap, {
  type NearbyMapItem,
} from "@/components/NearbyMap";
import { fetchNearbyComplaints } from "@/services/api";
import {
  CATEGORY_FILTERS,
  categoryOfIssue,
  formatDistance,
  PRESET_CENTERS,
  STATUS_CHIP,
  statusLabel,
} from "@/lib/nearby";

/** Radius presets (m). The default matches the backend default of 500 m. */
const RADIUS_CHOICES = [250, 500, 1000, 2000];

/** Used when the browser refuses geolocation, so the demo map still works. */
const FALLBACK_CENTER = PRESET_CENTERS[1]; // "Central Hyderabad"

function RadiusLabel(metres: number): string {
  return metres >= 1000 ? `${metres / 1000} km` : `${metres} m`;
}

export default function NearbyPage() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [areaLabel, setAreaLabel] = useState("");
  const [locating, setLocating] = useState(true);
  // Mirrors `locating` so the mount-effect bail-out timer can read the
  // CURRENT value instead of a stale closure (the demo-area <select> also
  // ends the locating state).
  const locatingRef = useRef(true);
  const [locationNote, setLocationNote] = useState("");
  const [radiusM, setRadiusM] = useState(500);
  // Every category selected by default; deselecting narrows the scan.
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    () => new Set(CATEGORY_FILTERS.map((c) => c.id))
  );
  const [items, setItems] = useState<NearbyMapItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);

  // Ask for the citizen's live location once on load; fall back to a demo
  // area when the browser is unwilling (permission denied / unavailable),
  // so the page never sits dead at a hackathon.
  useEffect(() => {
    let cancelled = false;
    const showDemoArea = (note: string) => {
      if (cancelled) return;
      locatingRef.current = false;
      setCoords({ lat: FALLBACK_CENTER.lat, lng: FALLBACK_CENTER.lng });
      setAreaLabel(FALLBACK_CENTER.name);
      setLocationNote(note);
      setLocating(false);
    };

    if (!("geolocation" in navigator)) {
      showDemoArea("Location is unavailable in this browser — showing a demo area.");
      return () => {
        cancelled = true;
      };
    }

    // Some embedded/iframe browsers never answer the permission query at
    // all - bail out to the demo area instead of spinning on "Locating…".
    const bailTimer = window.setTimeout(() => {
      if (locatingRef.current) {
        showDemoArea("Location is taking too long — showing a demo area instead.");
      }
    }, 12_000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        window.clearTimeout(bailTimer);
        locatingRef.current = false;
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setAreaLabel("your location");
        setLocationNote("");
        setLocating(false);
      },
      () => {
        if (cancelled) return;
        window.clearTimeout(bailTimer);
        showDemoArea(
          "We couldn't get your location — showing a demo area instead."
        );
      },
      { timeout: 10_000, maximumAge: 60_000 }
    );
    return () => {
      cancelled = true;
      window.clearTimeout(bailTimer);
    };
    // Runs once on mount - coords/location state is deliberately not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ask again (the "Use my location" button / after a denial).
  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocationNote("Location is unavailable in this browser.");
      return;
    }
    locatingRef.current = true;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        locatingRef.current = false;
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setAreaLabel("your location");
        setLocationNote("");
        setLocating(false);
      },
      () => {
        locatingRef.current = false;
        setLocationNote(
          "Location access was denied — pick a demo area below to explore the map."
        );
        setLocating(false);
      },
      { timeout: 8000, maximumAge: 60_000 }
    );
  };

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Scan whenever the centre, radius, or category filters change.
  useEffect(() => {
    if (!coords) return;
    const active = CATEGORY_FILTERS.filter((c) =>
      selectedCategories.has(c.id)
    );
    if (active.length === 0) {
      setItems([]);
      setError("");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const response = await fetchNearbyComplaints(
          coords.lat,
          coords.lng,
          {
            radiusM,
            categories: active.map((c) => c.label),
          }
        );
        if (controller.signal.aborted) return;
        // The backend skips rows without coordinates, so every row here has
        // a pin position.
        setItems(
          response.complaints.map((c) => ({
            tracking_id: c.tracking_id,
            issue_type: c.issue_type,
            severity: c.severity ?? null,
            status: c.status,
            lat: c.lat!,
            lng: c.lng!,
            distance_m: c.distance_m,
          }))
        );
      } catch (err) {
        if (controller.signal.aborted) return;
        setItems([]);
        setError(
          err instanceof Error
            ? err.message
            : "Could not scan for nearby complaints."
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [coords, radiusM, selectedCategories]);

  return (
    <main className="min-h-screen px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight">
              Nearby Activity
            </h1>
            <p className="mt-2 text-slate-400">
              Civic complaints reported around you — see what your neighbours
              have flagged and track it to resolution.
            </p>
          </div>
        </header>

        {/* Controls */}
        <section className="glass mt-8 rounded-2xl p-5">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            {/* Location */}
            <div className="min-w-[220px] flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Searching around
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={useMyLocation}
                  disabled={locating}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold transition hover:bg-blue-500 disabled:bg-slate-700"
                >
                  {locating ? "Locating…" : "📍 Use my location"}
                </button>
                <select
                  aria-label="Or pick a demo area"
                  value=""
                  onChange={(e) => {
                    const preset = PRESET_CENTERS.find(
                      (c) => c.name === e.target.value
                    );
                    if (preset) {
                      setCoords({ lat: preset.lat, lng: preset.lng });
                      setAreaLabel(preset.name);
                      setLocationNote(
                        "Showing a demo area — use your live location for real results."
                      );
                    }
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-500"
                >
                  <option value="">Demo area…</option>
                  {PRESET_CENTERS.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {locationNote && (
                <p className="mt-2 text-xs text-amber-400/90">{locationNote}</p>
              )}
            </div>

            {/* Radius */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Radius
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {RADIUS_CHOICES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRadiusM(r)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                      radiusM === r
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {RadiusLabel(r)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Category filters */}
          <div className="mt-5 border-t border-slate-800 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Categories
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORY_FILTERS.map((category) => {
                const on = selectedCategories.has(category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    aria-pressed={on}
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 transition ${
                      on
                        ? "bg-slate-100 text-slate-900 ring-transparent"
                        : "bg-slate-800/60 text-slate-500 ring-slate-700 hover:text-slate-300"
                    }`}
                  >
                    <span>{category.emoji}</span>
                    {category.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Status line */}
        <div className="mt-6 flex min-h-[24px] items-center justify-between text-sm">
          <p className="text-slate-400">
            {loading ? (
              <span className="inline-flex items-center gap-2 text-slate-300">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                Scanning within {RadiusLabel(radiusM)} of {areaLabel}…
              </span>
            ) : error ? (
              <span className="text-red-400">⚠️ {error}</span>
            ) : items.length > 0 ? (
              <>
                <span className="font-semibold text-white">
                  {items.length}
                </span>{" "}
                reported {items.length === 1 ? "issue" : "issues"} within{" "}
                {RadiusLabel(radiusM)} of {areaLabel}
              </>
            ) : (
              <span className="text-slate-500">
                No complaints within {RadiusLabel(radiusM)} of {areaLabel}.
              </span>
            )}
          </p>
          {!loading && items.length > 0 && (
            <span className="hidden text-xs text-slate-500 sm:block">
              Tap a pin or a card to focus it — pins are coloured by category,
              dimmed = resolved.
            </span>
          )}
        </div>

        {/* Map + results */}
        <section className="mt-4 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="relative h-[420px] overflow-hidden rounded-2xl border border-white/10 sm:h-[520px]">
            {coords ? (
              <NearbyMap
                center={coords}
                radiusM={radiusM}
                items={items}
                focusId={focusId}
              />
            ) : (
              <div className="grid h-full place-items-center text-slate-500">
                Requesting your location…
              </div>
            )}
          </div>

          {/* Result cards */}
          <aside className="max-h-[520px] overflow-y-auto pr-1 lg:order-first">
            {items.length === 0 && !loading && !error ? (
              <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
                <div className="text-3xl">🔍</div>
                <p className="mt-3 text-sm text-slate-400">
                  {selectedCategories.size === 0
                    ? "Pick at least one category to scan."
                    : "Nothing reported here yet. Try a wider radius or a nearby demo area — or be the first to report an issue."}
                </p>
                <Link
                  href="/report"
                  className="mt-4 inline-block text-sm font-semibold text-blue-400 transition hover:text-blue-300"
                >
                  📷 Report an issue →
                </Link>
              </div>
            ) : (
              <ul className="space-y-3">
                {items.map((item) => {
                  const category = categoryOfIssue(item.issue_type);
                  const resolved = item.status.toLowerCase() === "resolved";
                  return (
                    <li key={item.tracking_id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setFocusId(item.tracking_id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setFocusId(item.tracking_id);
                        }}
                        className={`glass rounded-2xl p-4 transition hover:border-chakra-400/60 ${
                          resolved ? "opacity-70" : ""
                        } ${focusId === item.tracking_id ? "ring-1 ring-blue-500" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg"
                              style={{ backgroundColor: `${category.color}26` }}
                            >
                              {category.emoji}
                            </span>
                            <div>
                              <p className="font-semibold leading-tight">
                                {item.issue_type}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {item.severity
                                  ? `${item.severity} severity`
                                  : "Severity unknown"}{" "}
                                · {formatDistance(item.distance_m)} away
                              </p>
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_CHIP[item.status] ?? ""}`}
                          >
                            {statusLabel(item.status)}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-2.5">
                          <code className="text-[11px] text-slate-500">
                            {item.tracking_id}
                          </code>
                          <Link
                            href={`/track?tracking=${encodeURIComponent(item.tracking_id)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs font-semibold text-blue-400 transition hover:text-blue-300"
                          >
                            Track →
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>
        </section>

        <footer className="mt-10 pb-4 text-center text-xs text-slate-600">
          Map data © OpenStreetMap contributors · Distances are straight-line
          (great-circle) from your position.
        </footer>
      </div>
    </main>
  );
}
