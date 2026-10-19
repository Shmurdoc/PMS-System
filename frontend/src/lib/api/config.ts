// ============================================
// API CONFIGURATION
// ============================================
// Base URL and auth-token plumbing for the Aquri backend.
// Override the base URL per environment with VITE_API_URL, e.g.
//   VITE_API_URL=https://staging.example.com npm run dev

// An explicitly-set empty string means same-origin (the containerized frontend
// proxies /api to the backend); an unset variable keeps the localhost dev default.
const envUrl: unknown = import.meta.env['VITE_API_URL'];

export const API_BASE_URL: string =
  typeof envUrl === 'string'
    ? envUrl.trim().replace(/\/+$/, '')
    : 'http://localhost:5114';

export const API_PREFIX = '/api/v1';

export const TOKEN_STORAGE_KEY = 'aquri_token';

/** Builds a fully-qualified URL for an API path, e.g. apiUrl('/bookings') → http://localhost:5114/api/v1/bookings */
export function apiUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${API_PREFIX}${suffix}`;
}

export function getAuthToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Storage unavailable (private mode) — token lives in memory only this page life.
  }
}

export function clearAuthToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore — nothing to clean up.
  }
}

/**
 * Best-effort role extraction from the stored JWT (payload `role` claim).
 * Used to gate data fetches before /auth/me resolves; returns null when the
 * token is missing or unparseable — callers must fall back safely.
 */
export function getTokenRole(): string | null {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const decoded = JSON.parse(atob(padded)) as { role?: unknown };
    return typeof decoded.role === 'string' && decoded.role !== '' ? decoded.role : null;
  } catch {
    return null;
  }
}
