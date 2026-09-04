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
