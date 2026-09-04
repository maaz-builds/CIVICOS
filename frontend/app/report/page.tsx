"use client";

import { useEffect, useRef, useState } from "react";

import {
  analyzeComplaintImage,
  createComplaint,
  type AnalysisResult,
  type LocationResult,
  type StoredComplaint,
} from "@/services/api";

export default function ReportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [locationResult, setLocationResult] = useState<LocationResult | null>(null);
  const [saved, setSaved] = useState<StoredComplaint | null>(null);
  const [error, setError] = useState("");

  // Location: coords come from the browser; ward/area are editable.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationNote, setLocationNote] = useState("");
  const [ward, setWard] = useState("");
  const [area, setArea] = useState("");

  const abortRef = useRef<AbortController | null>(null);

  // Try to capture the user's location once when the page loads.
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocationNote("Location is unavailable in this browser — enter the area manually.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationNote("Using your current location for the report.");
      },
      () => {
        setLocationNote("Location permission denied — enter the area manually.");
      },
      { timeout: 8000, maximumAge: 300_000 }
    );
  }, []);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    abortRef.current?.abort();
    const img = e.target.files?.[0];
    if (!img) return;

    setFile(img);
    setPreview(URL.createObjectURL(img));
    setResult(null);
    setLocationResult(null);
    setWard("");
    setArea("");
    setSaved(null);
    setError("");
  };

  const analyze = async () => {
    if (!file) return;

    setAnalyzing(true);
    setError("");
    // The 72B vision model takes 30-60 s on a real call; give it 2.5 min
    // before failing, and let a new selection cancel the request.
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 150_000);
    try {
      const data = await analyzeComplaintImage(file, {
        lat: coords?.lat,
        lng: coords?.lng,
        signal: controller.signal,
      });
      setResult(data.analysis);
      // Location enrichment is best-effort; prefill the ward from it.
      setLocationResult(data.location);
      if (data.location) {
        setWard(data.location.ward);
        setArea(data.location.area_name);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Analysis timed out after 2.5 minutes. Try a smaller image.");
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      clearTimeout(timer);
      abortRef.current = null;
      setAnalyzing(false);
    }
  };

  const save = async () => {
    if (!result) return;

    setSaving(true);
    setError("");
    try {
      const stored = await createComplaint({
        issue_type: result.issue_type,
        description: result.description,
        confidence: result.confidence,
        severity: result.severity,
        ward: ward.trim() || undefined,
        lat: coords?.lat,
        lng: coords?.lng,
      });
      setSaved(stored);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    setFile(null);
    setPreview("");
    setResult(null);
    setLocationResult(null);
    setWard("");
    setArea("");
    setCoords(null);
    setSaved(null);
    setError("");
  };

  // The vision prompt returns confidence on a 0..1 scale.
  const confidencePct = result
    ? Math.round(
        result.confidence <= 1 ? result.confidence * 100 : result.confidence
      )
    : 0;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold">Report a Civic Issue</h1>
        <p className="mt-2 text-slate-400">
          Upload an image, let CivicFix AI analyze it, then save it with a
          tracking ID.
        </p>

        {/* Upload */}
        <label className="mt-8 flex h-72 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900">
          <input
            type="file"
            accept="image/*"
            onChange={handleSelect}
            className="hidden"
          />

          {preview ? (
            <img
              src={preview}
              alt="preview"
              className="h-full w-full rounded-2xl object-cover"
            />
          ) : (
            <div className="text-center">
              <p className="text-5xl">📷</p>
              <p className="mt-3 text-slate-300">Click to upload</p>
            </div>
          )}
        </label>

        {/* Location status */}
        {locationNote && !saved && (
          <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <span>📍</span> {locationNote}
            {coords && (
              <span className="font-mono text-slate-600">
                ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
              </span>
            )}
          </p>
        )}

        {/* Analyze */}
        <button
          onClick={analyze}
          disabled={!file || analyzing || !!saved}
          className="mt-6 w-full rounded-xl bg-blue-600 py-3 font-semibold disabled:bg-slate-700"
        >
          {analyzing ? "Analyzing... (30–60 s)" : "Analyze with AI"}
        </button>

        {analyzing && (
          <p className="mt-3 text-center text-xs text-slate-500">
            The AI vision model takes 30–60 seconds on a real image. You can
            pick a different photo to cancel.
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-xl border border-rose-800 bg-rose-950/50 p-4 text-sm text-rose-200">
            {error}
          </div>
        )}

        {/* Analysis result */}
        {result && !saved && (
          <div className="mt-8 rounded-2xl bg-slate-900 p-6">
            <h2 className="mb-4 text-2xl font-bold">AI Analysis</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-slate-400">Issue</p>
                <p className="text-xl font-bold">{result.issue_type}</p>
              </div>

              <div>
                <p className="text-slate-400">Confidence</p>
                <p className="text-xl font-bold">{confidencePct}%</p>
              </div>

              <div>
                <p className="text-slate-400">Severity</p>
                <p className="text-xl font-bold">{result.severity}</p>
              </div>

              <div>
                <p className="text-slate-400">Description</p>
                <p>{result.description}</p>
              </div>
            </div>

            {/* Location (from the Location Agent, editable) */}
            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-slate-400">Location</p>
              {locationResult ? (
                <>
                  <p className="mt-1 text-sm text-slate-300">
                    Detected area: <span className="font-semibold">{area || locationResult.area_name}</span>
                    {" · "}{locationResult.ward}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {locationResult.exact_address}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-slate-500">
                  {coords
                    ? "Location lookup didn't run — enter the ward manually below."
                    : "No GPS available — enter the ward manually below."}
                </p>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs text-slate-500">Ward / Zone</span>
                  <input
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    placeholder="e.g. Secunderabad"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">Area</span>
                  <input
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="e.g. Begumpet"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </label>
              </div>
            </div>

            <button
              onClick={save}
              disabled={saving}
              className="mt-6 w-full rounded-xl bg-emerald-600 py-3 font-semibold hover:bg-emerald-500 disabled:bg-slate-700"
            >
              {saving ? "Saving..." : "✅ Save & Get Tracking ID"}
            </button>
          </div>
        )}

        {/* Saved confirmation */}
        {saved && (
          <div className="mt-8 rounded-2xl bg-emerald-950/60 p-6 ring-1 ring-emerald-700">
            <h2 className="text-2xl font-bold text-emerald-300">
              ✅ Complaint saved
            </h2>

            <p className="mt-3 text-sm text-slate-300">
              Your tracking ID — keep it to follow this complaint:
            </p>
            <p className="mt-2 font-mono text-3xl font-bold tracking-wider text-emerald-300">
              {saved.tracking_id}
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Status:{" "}
              <span className="font-semibold text-emerald-300">
                {saved.status}
              </span>
              {" · "}Reported:{" "}
              {new Date(saved.created_at).toLocaleDateString()}
              {saved.ward ? (
                <>
                  {" · "}
                  <span className="font-semibold text-slate-300">
                    {saved.ward}
                  </span>
                </>
              ) : null}
            </p>

            <button
              onClick={reset}
              className="mt-6 rounded-xl border border-emerald-700 px-6 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-900/40"
            >
              Report another issue
            </button>
          </div>
        )}
      </div>
    </main>
  );
}