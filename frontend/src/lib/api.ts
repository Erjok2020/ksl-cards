/**
 * API client. Uses JWT access/refresh tokens (NFR-03). When the network is
 * unavailable, GET requests fall back to the copy saved in Cache Storage, so
 * lessons a learner has already opened or downloaded keep working offline.
 */
import type { User } from "../types";

export const API_URL: string = import.meta.env.VITE_API_URL ?? "";
export const API_CACHE = "ksl-api";

const ACCESS_KEY = "ksl_access";
const REFRESH_KEY = "ksl_refresh";
const USER_KEY = "ksl_user";

export class OfflineError extends Error {
  constructor() {
    super("You're offline and this hasn't been saved on this device yet.");
  }
}

/** Shown when a request fails but the device reports it is online: the
 *  internet works, so the KSL Cards server itself can't be reached (for
 *  example it is restarting, or isn't running on a development machine). */
export const SERVER_UNREACHABLE =
  "We can't reach the KSL Cards server right now. Your internet connection is working, so the server may be restarting or down. Try again in a moment.";

/** Explains a failed request honestly: offline device vs unreachable server. */
export function connectionProblem(offlineText: string): string {
  return typeof navigator !== "undefined" && navigator.onLine ? SERVER_UNREACHABLE : offlineText;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function getSavedUser(): User | null {
  const raw = read(USER_KEY);
  if (!raw || !read(REFRESH_KEY)) return null;
  try {
    const user = JSON.parse(raw) as User;
    return user.role ? user : null; // sessions from before roles existed
  } catch {
    return null;
  }
}

export function saveSession(access: string, refresh: string, user: User) {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  for (const key of [ACCESS_KEY, REFRESH_KEY, USER_KEY, "token", "user"]) {
    localStorage.removeItem(key);
  }
}

let refreshing: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refresh = read(REFRESH_KEY);
  if (!refresh) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/api/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { access: string; refresh?: string };
      localStorage.setItem(ACCESS_KEY, data.access);
      if (data.refresh) localStorage.setItem(REFRESH_KEY, data.refresh);
      return true;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Fired when the refresh token is no longer valid and the user must log in. */
export const SESSION_EXPIRED = "ksl:session-expired";

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const send = () => {
    const headers = new Headers(init.headers);
    const access = read(ACCESS_KEY);
    if (access) headers.set("Authorization", `Bearer ${access}`);
    return fetch(`${API_URL}${path}`, { ...init, headers });
  };

  let res: Response;
  try {
    res = await send();
  } catch {
    throw new OfflineError();
  }

  if (res.status === 401 && !read(REFRESH_KEY)) {
    // No saved login at all (e.g. signed out elsewhere): go to the login screen.
    window.dispatchEvent(new Event(SESSION_EXPIRED));
  } else if (res.status === 401) {
    let refreshed: boolean;
    try {
      refreshed = await refreshAccessToken();
    } catch {
      throw new OfflineError();
    }
    if (refreshed) {
      res = await send();
    } else {
      window.dispatchEvent(new Event(SESSION_EXPIRED));
    }
  }
  return res;
}

async function errorFrom(res: Response): Promise<ApiError> {
  let message = `Request failed (${res.status}).`;
  try {
    const data = (await res.json()) as { error?: string; detail?: string };
    message = data.error || data.detail || message;
  } catch {
    // keep the default message
  }
  return new ApiError(message, res.status);
}

/** GET JSON, falling back to the cached copy when offline. */
export async function getJSON<T>(path: string): Promise<{ data: T; fromCache: boolean }> {
  try {
    const res = await apiFetch(path);
    if (!res.ok) throw await errorFrom(res);
    const copy = res.clone();
    void caches
      ?.open(API_CACHE)
      .then((cache) => cache.put(`${API_URL}${path}`, copy))
      .catch(() => undefined);
    return { data: (await res.json()) as T, fromCache: false };
  } catch (err) {
    if (!(err instanceof OfflineError)) throw err;
    const cached = await caches?.match(`${API_URL}${path}`, { cacheName: API_CACHE }).catch(() => undefined);
    if (!cached) throw err;
    return { data: (await cached.json()) as T, fromCache: true };
  }
}

export async function sendJSON<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw await errorFrom(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function sendForm<T>(path: string, form: FormData, method = "POST"): Promise<T> {
  const res = await apiFetch(path, { method, body: form });
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as T;
}

export function formatSize(kb: number): string {
  if (kb < 1024) return `${Math.max(kb, 1)} KB`;
  if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${(kb / 1024 / 1024).toFixed(1)} GB`;
}
