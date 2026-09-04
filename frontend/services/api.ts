/**
 * API client for the CivicFix FastAPI backend.
 *
 * Used by client components (see components/health-check.tsx).
 *
 * The base URL is resolved in this order:
 *   1. NEXT_PUBLIC_API_URL (set it in frontend/.env.local to override)
 *   2. In production builds, /api/backend - the same-origin path that
 *      vercel.json rewrites to the FastAPI service (see /vercel.json).
 *   3. Locally, the default FastAPI dev server on port 8000.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production"
    ? "/api/backend"
    : "http://localhost:8000");

/** Shape of the response returned by GET /health. */
export interface HealthResponse {
  status: string;
  service: string;
}

/**
 * Ping the backend health endpoint.
 * Throws if the backend is unreachable or returns an error status.
 */
export async function checkBackendHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as HealthResponse;
}

/** Shape of the vision agent's analysis output. */
export interface AnalysisResult {
  issue_type: string;
  confidence: number;
  severity: string;
  description: string;
}

/** Location enrichment produced by the Location Agent (POST /complaints/analyze). */
export interface LocationResult {
  lat: number;
  lng: number;
  exact_address: string;
  area_name: string;
  /** Precise GHMC ward when known (e.g. "Ward 104 Kondapur"), else the zone/area. */
  ward: string;
  /** GHMC zone circle (e.g. "West Zone"), empty when unknown. */
  zone?: string;
  infrastructure_type: string;
  /** Real counts from stored complaints within ~2 km; null when the DB is unreachable. */
  nearby_incidents?: number | null;
  unresolved_incidents?: number | null;
  /** True when the Featherless model interpreted the address; false on rules fallback. */
  ai_used?: boolean;
}

/** Routing enrichment produced by the Routing Agent (POST /complaints/analyze). */
export interface RoutingResult {
  department: string;
  priority: string | null;
  notes: string | null;
  ai_used: boolean;
}

/** Full response of POST /complaints/analyze. */
export interface AnalyzeResponse {
  success: boolean;
  analysis: AnalysisResult;
  location: LocationResult | null;
  routing: RoutingResult | null;
}

/**
 * Stage of the LangGraph pipeline, announced via SSE as each agent runs:
 * the backend emits these in order - vision -> location -> routing.
 */
export type AnalyzeStage = "starting" | "vision" | "location" | "routing";

/** Payload accepted by POST /complaints (see ComplaintCreate on the backend). */
export interface ComplaintCreatePayload {
  issue_type: string;
  description?: string;
  confidence?: number;
  severity?: string;
  ward?: string;
  /** Nullable: the DB stores null when the reporter had no GPS fix. */
  lat?: number | null;
  lng?: number | null;
  department?: string;
  routing_notes?: string;
  image_url?: string;
}

/** A stored complaint row (Supabase adds id, tracking_id, status, created_at). */
export interface StoredComplaint extends ComplaintCreatePayload {
  id: string;
  tracking_id: string;
  status: string;
  created_at: string;
  /**
   * One-tap wa.me deep link with the grievance pre-filled for GHMC's
   * official WhatsApp channel (MyCUREApp). Present only when the backend
   * has WHATSAPP_NUMBER configured; otherwise null/absent and the UI hides
   * the button.
   */
  whatsapp_link?: string | null;
}

/** Lifecycle of a complaint - mirrors the backend's ComplaintStatus Literal. */
export type ComplaintStatus =
  | "submitted"
  | "assigned"
  | "in progress"
  | "resolved";

/** Shape of the existing complaint attached to a 409 duplicate response. */
export interface DuplicateComplaint {
  tracking_id: string;
  issue_type: string;
  severity: string | null;
  status: string | null;
  ward: string | null;
  created_at: string | null;
}

/**
 * Thrown by createComplaint when the backend refuses the report (HTTP 409):
 * the same issue type already has an open complaint within 50 m, so no new
 * record was created. `duplicate` carries the existing tracking ID.
 */
export class DuplicateComplaintError extends Error {
  readonly duplicate: DuplicateComplaint;

  constructor(message: string, duplicate: DuplicateComplaint) {
    super(message);
    this.name = "DuplicateComplaintError";
    this.duplicate = duplicate;
  }
}

/** Extract a readable message from a failed API response. */
async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body?.detail) return String(body.detail);
  } catch {
    // not JSON - fall through
  }
  return `HTTP ${response.status} ${response.statusText}`;
}

/**
 * Upload a photo OR video and analyze it, streaming live pipeline-stage
 * updates.
 *
 * The backend answers with Server-Sent Events: a `stage` event fires as
 * each LangGraph agent starts (vision -> location -> routing) - delivered
 * through `opts.onStage` - then a `done` event resolves with the full
 * response. Videos are sampled into frames server-side; the response shape
 * is identical for both media types. Falls back to plain JSON when a proxy
 * buffers the stream, so this also works behind buffering infrastructure.
 */
export async function analyzeComplaintImage(
  file: File,
  opts?: {
    lat?: number;
    lng?: number;
    signal?: AbortSignal;
    onStage?: (stage: AnalyzeStage) => void;
  }
): Promise<AnalyzeResponse> {
  const formData = new FormData();
  formData.append("file", file);
  if (opts?.lat !== undefined && opts?.lng !== undefined) {
    formData.append("lat", String(opts.lat));
    formData.append("lng", String(opts.lng));
  }

  const response = await fetch(`${API_BASE_URL}/complaints/analyze`, {
    method: "POST",
    body: formData,
    signal: opts?.signal,
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    // Non-streaming fallback (buffering proxy or a mock server).
    return (await response.json()) as AnalyzeResponse;
  }
  return readAnalyzeStream(response, opts?.onStage);
}

/** Parse the SSE analyze response: stage events + one final `done`/`error`. */
async function readAnalyzeStream(
  response: Response,
  onStage?: (stage: AnalyzeStage) => void
): Promise<AnalyzeResponse> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Streaming is not supported in this browser.");

  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "";
  let dataLines: string[] = [];

  const dispatch = (): void => {
    const data = JSON.parse(dataLines.join("\n"));
    if (eventName === "done") {
      doneResolve(data as AnalyzeResponse);
    } else if (eventName === "error") {
      doneReject(new Error(data?.message ?? "AI analysis failed."));
    } else if (eventName === "stage" && onStage) {
      onStage(data.stage as AnalyzeStage);
    }
    eventName = "";
    dataLines = [];
  };

  let doneResolve!: (value: AnalyzeResponse) => void;
  let doneReject!: (reason?: unknown) => void;
  const result = new Promise<AnalyzeResponse>((resolve, reject) => {
    doneResolve = resolve;
    doneReject = reject;
  });

  const read = async (): Promise<void> => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        // Trailing event without a closing blank line.
        if (eventName && dataLines.length) dispatch();
        if (!eventName) doneReject(new Error("Connection closed before analysis finished."));
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
        }
        if (eventName && dataLines.length) dispatch();
        eventName = "";
        dataLines = [];
      }
    }
  };

  read().catch((err) => doneReject(err));
  return result;
}

/**
 * Persist a complaint and return the stored row (with its CF- tracking ID).
 *
 * The backend's POST /complaints expects multipart form data. When a photo
 * is passed it is uploaded to Supabase Storage and linked via image_url;
 * without one, the complaint is saved photo-less.
 */
export async function createComplaint(
  payload: ComplaintCreatePayload,
  file?: File
): Promise<StoredComplaint> {
  const formData = new FormData();
  if (file) formData.append("file", file);
  formData.append("issue_type", payload.issue_type);
  if (payload.description) formData.append("description", payload.description);
  if (payload.confidence !== undefined) {
    formData.append("confidence", String(payload.confidence));
  }
  if (payload.severity) formData.append("severity", payload.severity);
  if (payload.ward) formData.append("ward", payload.ward);
  if (payload.lat !== undefined) formData.append("lat", String(payload.lat));
  if (payload.lng !== undefined) formData.append("lng", String(payload.lng));
  if (payload.department) formData.append("department", payload.department);
  if (payload.routing_notes) {
    formData.append("routing_notes", payload.routing_notes);
  }

  // Do NOT set Content-Type manually: the browser adds the multipart
  // boundary for FormData.
  const response = await fetch(`${API_BASE_URL}/complaints`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    // 409 = duplicate detected: the body's `detail` object carries the
    // existing complaint's tracking ID so the UI can point the user at it
    // instead of at a generic "HTTP 409" error.
    if (response.status === 409) {
      let detail: { message?: string; duplicate?: DuplicateComplaint } | undefined;
      try {
        const body = await response.json();
        detail = body?.detail as
          | { message?: string; duplicate?: DuplicateComplaint }
          | undefined;
      } catch {
        // Body was not JSON (or lacked detail) - fall through to the
        // generic message below.
      }
      if (detail?.message && detail.duplicate) {
        throw new DuplicateComplaintError(detail.message, detail.duplicate);
      }
    }
    throw new Error(await errorMessage(response));
  }

  return (await response.json()) as StoredComplaint;
}

/** Look up a complaint by its CF- tracking ID (404 -> Error). */
export async function getComplaintByTrackingId(
  trackingId: string
): Promise<StoredComplaint> {
  const response = await fetch(
    `${API_BASE_URL}/complaints/${encodeURIComponent(trackingId)}`
  );
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }

  return (await response.json()) as StoredComplaint;
}

/** List the most recent stored complaints, newest first (GHMC portal feed). */
export async function listComplaints(limit = 100): Promise<StoredComplaint[]> {
  const response = await fetch(
    `${API_BASE_URL}/complaints?limit=${limit}`
  );
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }

  return (await response.json()) as StoredComplaint[];
}

/**
 * Advance a complaint's lifecycle status (GHMC portal action).
 * The /track page sees the new status immediately on its next lookup.
 */
export async function updateComplaintStatus(
  trackingId: string,
  status: ComplaintStatus
): Promise<StoredComplaint> {
  const response = await fetch(
    `${API_BASE_URL}/complaints/${encodeURIComponent(trackingId)}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }
  );
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }

  return (await response.json()) as StoredComplaint;
}

/**
 * A stored complaint returned by the nearby scan - the server adds the
 * great-circle distance from the viewer's position, in metres.
 */
export interface NearbyComplaint extends StoredComplaint {
  distance_m: number;
}

/** Shape of the response of GET /complaints/nearby (Nearby Activity map). */
export interface NearbyResponse {
  center: { lat: number; lng: number };
  radius_m: number;
  count: number;
  complaints: NearbyComplaint[];
}

/**
 * Scan stored complaints within `radiusM` metres of a GPS point, nearest
 * first (drives the Nearby Activity map).
 *
 * `categories` narrows results by plural display name ("Potholes",
 * "Streetlights", "Garbage", "Water Leaks"); omit for every category.
 * Resolved complaints are included - the map shows the full lifecycle.
 */
export async function fetchNearbyComplaints(
  lat: number,
  lng: number,
  opts?: { radiusM?: number; categories?: string[] }
): Promise<NearbyResponse> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  if (opts?.radiusM !== undefined) {
    params.set("radius_m", String(opts.radiusM));
  }
  if (opts?.categories && opts.categories.length > 0) {
    params.set("categories", opts.categories.join(","));
  }

  const response = await fetch(
    `${API_BASE_URL}/complaints/nearby?${params.toString()}`
  );
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }

  return (await response.json()) as NearbyResponse;
}