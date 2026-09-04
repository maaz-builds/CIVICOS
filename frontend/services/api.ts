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

/** Upload a photo and return the vision agent's analysis. */
export async function analyzeComplaintImage(
  file: File,
  signal?: AbortSignal
): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/complaints/analyze`, {
    method: "POST",
    body: formData,
    signal,
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }

  const data = await response.json();
  return data.analysis as AnalysisResult;
}

/** Persist a complaint and return the stored row (with its CF- tracking ID). */
export async function createComplaint(
  payload: ComplaintCreatePayload
): Promise<StoredComplaint> {
  const response = await fetch(`${API_BASE_URL}/complaints`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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