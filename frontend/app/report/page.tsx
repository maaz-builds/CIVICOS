"use client";

import { useEffect, useRef, useState } from "react";

import {
  analyzeComplaintImage,
  createComplaint,
  type AnalysisResult,
  type AnalyzeStage,
  type LocationResult,
  type RoutingResult,
  type StoredComplaint,
} from "@/services/api";

// Same cap as the backend (POST /complaints/analyze): 30 MB.
const MAX_MEDIA_BYTES = 30 * 1024 * 1024;

// The 72B vision model takes 30-60 s on one image; a video is sampled into
// 3 frames, so allow more time for video uploads.
const IMAGE_TIMEOUT_MS = 150_000;
const VIDEO_TIMEOUT_MS = 300_000;

/** Human copy for each pipeline stage, driven by real SSE events from the backend. */
const STAGE_COPY: Record<AnalyzeStage, { label: string; note: string }> = {
  starting: {
    label: "Starting the AI agents…",
    note: "Uploading your media to the analyzer",
  },
  vision: {
    label: "Analyzing the media…",
    note: "Identifying the issue, severity & confidence",
  },
  location: {
    label: "Locating the area…",
    note: "Detecting your ward from the GPS position",
  },
  routing: {
    label: "Routing the complaint…",
    note: "Assigning the responsible GHMC department",
  },
};

/** The three agent steps, in pipeline order - lit up as each one finishes. */
const PIPELINE_STEPS = ["vision", "location", "routing"] as const;

function pillState(
  stepIndex: number,
  stage: AnalyzeStage
): "done" | "active" | "upcoming" {
  const activeIndex = stage === "starting" ? -1 : PIPELINE_STEPS.indexOf(stage);
  if (stepIndex < activeIndex) return "done";
  if (stepIndex === activeIndex) return "active";
  return "upcoming";
}

function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/");
}

export default function ReportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [preview, setPreview] = useState("");
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [locationResult, setLocationResult] = useState<LocationResult | null>(null);
  const [routingResult, setRoutingResult] = useState<RoutingResult | null>(null);
  const [saved, setSaved] = useState<StoredComplaint | null>(null);
  const [error, setError] = useState("");

  // Location: coords come from the browser; ward/area are editable.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationNote, setLocationNote] = useState("");
  const [ward, setWard] = useState("");
  const [area, setArea] = useState("");

  // Seconds since the analysis started - live feedback while the vision
  // model works (it genuinely takes 30-60 s on a real image).
  const [elapsed, setElapsed] = useState(0);
  // Active LangGraph stage ("starting" until the first SSE event arrives).
  const [stage, setStage] = useState<AnalyzeStage>("starting");

  const abortRef = useRef<AbortController | null>(null);
  // True when the in-flight request was cancelled by picking new media or
  // resetting - suppress the misleading "timed out" error in that case.
  const canceledRef = useRef(false);

  // Tick a second counter while analyzing.
  useEffect(() => {
    if (!analyzing) return;
    setElapsed(0);
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [analyzing]);

  // Try to capture the user's location once when the page loads.
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocationNote("Location is unavailable in this browser — enter the area manually.");
      return;
    }

    // High accuracy + no caching gives the tightest fix; retry once in
    // case the first lock times out (but never after a hard denial).
    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    };
    let attempts = 0;
    const request = () => {
      attempts += 1;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          const meters = Math.round(pos.coords.accuracy || 0);
          setLocationNote(
            meters > 0
              ? `Using your current location (±${meters} m).`
              : "Using your current location for the report."
          );
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setLocationNote("Location permission denied — enter the area manually.");
          } else if (attempts < 2) {
            request();
          } else {
            setLocationNote("Couldn't get a GPS fix — enter the area manually.");
          }
        },
        options
      );
    };
    request();
  }, []);

  // Validate + accept a selected/dropped file (image or video).
  const acceptFile = (candidate: File | undefined | null) => {
    abortRef.current?.abort();
    canceledRef.current = true;
    if (!candidate) return;

    // Unsupported format check (client-side, before upload).
    const isImage = candidate.type.startsWith("image/");
    const isVideoType = candidate.type.startsWith("video/");
    if (!isImage && !isVideoType) {
      setFile(null);
      setPreview("");
      setFileName("");
      setIsVideo(false);
      setError(
        "Unsupported format. Upload a JPG, PNG, or WEBP image, or an MP4, MOV, or WEBM video."
      );
      return;
    }

    // Size check - matches the backend's 30 MB cap.
    if (candidate.size > MAX_MEDIA_BYTES) {
      setFile(null);
      setPreview("");
      setFileName("");
      setIsVideo(false);
      setError(
        `File too large (max ${MAX_MEDIA_BYTES / (1024 * 1024)} MB). Choose a smaller image or video.`
      );
      return;
    }

    setFile(candidate);
    setIsVideo(isVideoType);
    setFileName(candidate.name);
    setPreview(URL.createObjectURL(candidate));
    setResult(null);
    setLocationResult(null);
    setRoutingResult(null);
    setWard("");
    setArea("");
    setSaved(null);
    setError("");
  };

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    acceptFile(e.target.files?.[0]);
    // Allow re-selecting the same file after a reset.
    e.target.value = "";
  };

  // Drag-and-drop support on the upload area.
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    acceptFile(e.dataTransfer.files?.[0]);
  };

  const analyze = async () => {
    if (!file) return;

    setAnalyzing(true);
    setError("");
    setStage("starting");
    canceledRef.current = false;
    // Images need ~2.5 min; videos (3 sampled frames) need longer.
    const timeoutMs = isVideo ? VIDEO_TIMEOUT_MS : IMAGE_TIMEOUT_MS;
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // Stage events arrive as each LangGraph agent starts (vision ->
      // location -> routing) - the chip text updates on the real pipeline.
      const data = await analyzeComplaintImage(file, {
        lat: coords?.lat,
        lng: coords?.lng,
        signal: controller.signal,
        onStage: (s) => setStage(s),
      });
      setResult(data.analysis);
      // Location enrichment is best-effort; prefill the ward from it.
      setLocationResult(data.location);
      if (data.location) {
        setWard(data.location.ward);
        setArea(data.location.area_name);
      }
      setRoutingResult(data.routing);
    } catch (err) {
      // Cancelled by picking new media or resetting - nothing to report.
      if (canceledRef.current) return;
      if (err instanceof DOMException && err.name === "AbortError") {
        setError(
          `Analysis timed out after ${Math.round(timeoutMs / 60000)} minutes. Try a smaller or shorter file.`
        );
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
      const stored = await createComplaint(
        {
          issue_type: result.issue_type,
          description: result.description,
          confidence: result.confidence,
          severity: result.severity,
          ward: ward.trim() || undefined,
          lat: coords?.lat,
          lng: coords?.lng,
          department: routingResult?.department || undefined,
          routing_notes: routingResult?.notes || undefined,
        },
        // Send the original media too - the backend uploads it to
        // Supabase Storage and links it via image_url (images AND videos).
        file ?? undefined
      );
      setSaved(stored);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    canceledRef.current = true;
    abortRef.current?.abort();
    setFile(null);
    setIsVideo(false);
    setPreview("");
    setFileName("");
    setDragging(false);
    setResult(null);
    setLocationResult(null);
    setRoutingResult(null);
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

  // Show the analysis timer as "42s", then "1:05" past a minute.
  const formatElapsed = (s: number) =>
    s >= 60
      ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
      : `${s}s`;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold">Report a Civic Issue</h1>
        <p className="mt-2 text-slate-400">
          Upload a photo or video, let CivicFix AI analyze it, then save it
          with a tracking ID.
        </p>

        {/* Media uploader: click or drag-and-drop (image or video) */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`mt-8 flex h-72 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors ${
            dragging
              ? "border-blue-400 bg-blue-950/40"
              : "border-slate-700 bg-slate-900 hover:border-slate-500"
          }`}
        >
          <label className="flex h-full w-full cursor-pointer items-center justify-center">
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleSelect}
              className="hidden"
            />

            {preview ? (
              <div className="relative h-full w-full">
                {isVideo ? (
                  <video
                    src={preview}
                    controls
                    muted
                    playsInline
                    className="h-full w-full rounded-2xl bg-black object-contain"
                  />
                ) : (
                  <img
                    src={preview}
                    alt="preview"
                    className="h-full w-full rounded-2xl object-cover"
                  />
                )}

                {/* Media type badge */}
                <span className="absolute left-3 top-3 z-10 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                  {isVideo ? "🎥 Video" : "📷 Image"}
                </span>

                {/* Animated state while the AI agents analyze the media. */}
                {analyzing && (
                  <>
                    {/* Dim the preview so the scanner reads clearly. */}
                    <div className="absolute inset-0 rounded-2xl bg-slate-950/60" />

                    {/* Scanner sweep travelling down the preview. */}
                    <div className="animate-civicfix-scan absolute inset-x-4 h-16 rounded-full bg-gradient-to-b from-transparent via-blue-400/60 to-transparent" />

                    {/* Viewfinder corner brackets. */}
                    <span className="pointer-events-none absolute left-3 top-3 z-10 h-5 w-5 rounded-tl-lg border-l-2 border-t-2 border-blue-300/90" />
                    <span className="pointer-events-none absolute right-3 top-3 z-10 h-5 w-5 rounded-tr-lg border-r-2 border-t-2 border-blue-300/90" />
                    <span className="pointer-events-none absolute bottom-3 left-3 z-10 h-5 w-5 rounded-bl-lg border-b-2 border-l-2 border-blue-300/90" />
                    <span className="pointer-events-none absolute bottom-3 right-3 z-10 h-5 w-5 rounded-br-lg border-b-2 border-r-2 border-blue-300/90" />

                    {/* Live status chip: copy advances with the real pipeline. */}
                    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
                      <div className="flex flex-col items-center text-center">
                        <div className="relative size-16">
                          <span className="absolute inset-0 rounded-full border-4 border-blue-400/20" />
                          <span className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-blue-400" />
                          <span className="absolute inset-0 grid place-items-center text-2xl">
                            🤖
                          </span>
                        </div>
                        <p className="mt-4 text-lg font-bold text-white drop-shadow">
                          {STAGE_COPY[stage].label}
                        </p>
                        <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-blue-300">
                          {formatElapsed(elapsed)}
                        </p>
                        <p className="mt-1 text-xs text-slate-300">
                          {STAGE_COPY[stage].note}
                        </p>

                        {/* Pipeline steps - light up as each agent finishes. */}
                        <div className="mt-4 flex items-center gap-2">
                          {PIPELINE_STEPS.map((step, i) => {
                            const state = pillState(i, stage);
                            const className =
                              state === "done"
                                ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40"
                                : state === "active"
                                  ? "bg-blue-500/15 text-blue-200 ring-blue-400/60 animate-pulse"
                                  : "bg-slate-800/80 text-slate-500 ring-slate-700";
                            const marker =
                              state === "done" ? "✓" : state === "active" ? "●" : String(i + 1);
                            return (
                              <span
                                key={step}
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${className}`}
                              >
                                {marker} {step}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="text-center">
                <p className="text-5xl">📁</p>
                <p className="mt-3 text-slate-300">
                  {dragging ? "Drop it here!" : "Click or drag & drop"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Image (JPG, PNG, WEBP) or video (MP4, MOV, WEBM) · up to 30 MB
                </p>
              </div>
            )}
          </label>
        </div>

        {/* Selected filename */}
        {fileName && !saved && (
          <p className="mt-2 truncate text-center text-xs text-slate-400">
            {isVideo ? "🎥" : "📷"} {fileName}
          </p>
        )}

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
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-500 disabled:bg-slate-700"
        >
          {analyzing ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Analyzing... (1–3 min)
            </>
          ) : (
            "Analyze Media"
          )}
        </button>

        {analyzing && (
          <p className="mt-3 text-center text-xs text-slate-500">
            {isVideo
              ? "The AI samples a few frames from your video — this takes 1–3 minutes. You can pick different media to cancel."
              : "The AI vision model takes 30–60 seconds on a real image. You can pick different media to cancel."}
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
            </div>

            <div>
              <p className="text-slate-400">Description</p>
              <p>{result.description}</p>
            </div>

            {/* Routing (from the Routing Agent) */}
            {routingResult && (
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-xs text-emerald-400">Assigned department</p>
                <p className="mt-1 font-semibold">
                  {routingResult.department}
                </p>
                {routingResult.notes ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {routingResult.notes}
                  </p>
                ) : null}
              </div>
            )}

            {/* Location (from the Location Agent, editable) */}
            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-slate-400">Location</p>
              {locationResult ? (
                <>
                  <p className="mt-1 text-sm text-slate-300">
                    Detected area: <span className="font-semibold">{area || locationResult.area_name}</span>
                    {" · "}
                    {locationResult.zone
                      ? locationResult.zone
                      : locationResult.ward}
                  </p>
                  {locationResult.zone && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      {locationResult.ward}
                    </p>
                  )}
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

            {saved.image_url &&
              (/\.(mp4|webm|mov)(\?|$)/i.test(saved.image_url) ? (
                <video
                  src={saved.image_url}
                  controls
                  muted
                  playsInline
                  className="mt-5 max-h-72 w-full rounded-xl bg-black object-contain ring-1 ring-emerald-700/50"
                />
              ) : (
                <img
                  src={saved.image_url}
                  alt="Reported issue photo"
                  className="mt-5 max-h-72 w-full rounded-xl object-cover ring-1 ring-emerald-700/50"
                />
              ))}

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