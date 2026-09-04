/**
 * API client for the CivicFix FastAPI backend.
 *
 * Used by client components (see components/health-check.tsx).
 * The base URL defaults to the local dev backend and can be overridden with
 * NEXT_PUBLIC_API_URL in frontend/.env.local (copy .env.local.example).
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
/** Shape of the report payload sent to the backend. */
export interface ReportPayload {
  image_url: string;
  latitude: number;
  longitude: number;
  user_phone: string;
}

/** Shape of the response returned after processing a report. */
export interface ReportResponse {
  status: string;
  location_data?: any;
  vision_data?: any;
}

/**
 * Submit a civic report containing image and location data.
 */
export async function submitReport(payload: ReportPayload): Promise<ReportResponse> {
  const response = await fetch(`${API_BASE_URL}/civicos/process-report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as ReportResponse;
}