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

/** Payload accepted by POST /complaints (see ComplaintCreate on the backend). */
export interface ComplaintCreatePayload {
  issue_type: string;
  description?: string;
  confidence?: number;
  severity?: string;
  ward?: string;
  lat?: number;
  lng?: number;
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

/** Upload a photo and return the vision agent's analysis (+ optional location). */
export async function analyzeComplaintImage(
  file: File,
  opts?: { lat?: number; lng?: number; signal?: AbortSignal }
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

  return (await response.json()) as AnalyzeResponse;
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