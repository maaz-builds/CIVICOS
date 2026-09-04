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
