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

/*
 * Sign-in storage. Each tab keeps its own sign-in in sessionStorage, so
 * signing in as someone else in another tab leaves this tab as it was. The
 * account used most recently is also remembered in localStorage: a new tab,
 * or the app opened again later, starts from it, so learners stay signed in
 * and can open saved lessons offline. Without sessionStorage, all tabs share
 * the remembered sign-in.
 */
const SESSION_KEYS = [ACCESS_KEY, REFRESH_KEY, USER_KEY];
/** Set in a tab that signed out, so reloading the tab keeps it signed out. */
const SIGNED_OUT_HERE = "ksl_signed_out_here";

function storage(kind: "localStorage" | "sessionStorage"): Storage | null {
  try {
    return window[kind];
  } catch {
    return null;
  }
}

function get(store: Storage | null, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Writes a value, or removes it when the value is null. */
function put(store: Storage | null, key: string, value: string | null) {
  try {
    if (value === null) store?.removeItem(key);
    else store?.setItem(key, value);
  } catch {
    // Storage blocked or full: the sign-in still works while the page is open.
  }
}

let adopted = false;

/** This tab's sign-in. A new tab first copies the remembered one, unless the
 *  tab was signed out and is only being reloaded. */
function tabSession(): Storage | null {
  const tab = storage("sessionStorage");
  const remembered = storage("localStorage");
  if (!tab) return remembered;
  if (!adopted) {
    adopted = true;
    if (!get(tab, REFRESH_KEY) && !get(tab, SIGNED_OUT_HERE)) {
      for (const key of SESSION_KEYS) put(tab, key, get(remembered, key));
    }
  }
  return tab;
}

function read(key: string): string | null {
  return get(tabSession(), key);
}

function userIdIn(store: Storage | null): number | null {
  try {
    return (JSON.parse(get(store, USER_KEY) ?? "null") as User | null)?.id ?? null;
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

/** Signs this tab in, and remembers the account for new tabs. */
export function saveSession(access: string, refresh: string, user: User) {
  const tab = tabSession();
  const remembered = storage("localStorage");
  const values: [string, string][] = [
    [ACCESS_KEY, access],
    [REFRESH_KEY, refresh],
    [USER_KEY, JSON.stringify(user)],
  ];
  put(tab, SIGNED_OUT_HERE, null);
  for (const [key, value] of values) {
    put(tab, key, value);
    put(remembered, key, value);
  }
}

/** Makes this tab's account the one new tabs start with. Called whenever the
 *  tab is in use, so a link opened in a new tab stays with the same person. */
export function rememberThisTab() {
  const tab = tabSession();
  const remembered = storage("localStorage");
  if (!tab || tab === remembered || !get(tab, REFRESH_KEY)) return;
  for (const key of SESSION_KEYS) put(remembered, key, get(tab, key));
}

/** Signs this tab out; other tabs keep their own sign-in. The remembered
 *  account is forgotten too when it is the same person, so a new tab doesn't
 *  sign them straight back in. */
export function clearSession() {
  const tab = tabSession();
  const remembered = storage("localStorage");
  const id = userIdIn(tab);
  if (id !== null && id === userIdIn(remembered)) {
    for (const key of SESSION_KEYS) put(remembered, key, null);
  }
  for (const key of SESSION_KEYS) put(tab, key, null);
  if (tab !== remembered) put(tab, SIGNED_OUT_HERE, "1");
  for (const key of ["token", "user"]) put(remembered, key, null); // sessions from before JWT
}

/** Keeps renewed tokens in this tab, and in the remembered account when it is
 *  the same person. */
function saveRenewedTokens(access: string, refresh?: string) {
  const tab = tabSession();
  const remembered = storage("localStorage");
  const stores = tab !== remembered && userIdIn(tab) === userIdIn(remembered) ? [tab, remembered] : [tab];
  for (const store of stores) {
    put(store, ACCESS_KEY, access);
    if (refresh) put(store, REFRESH_KEY, refresh);
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
      saveRenewedTokens(data.access, data.refresh);
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
    // No saved login at all (e.g. the browser's storage was cleared): go to the login screen.
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

/** Lesson text, the FAQ and policy pages are the same for everyone (module
 *  downloads save them too). Everything else is personal, so it is cached
 *  under the account's id: one account never sees another's data offline. */
const SHARED_PATH = /^\/api\/(lessons|faq|pages)\//;

function cacheUrl(path: string): string {
  if (SHARED_PATH.test(path)) return `${API_URL}${path}`;
  const id = getSavedUser()?.id ?? 0;
  return `${API_URL}${path}${path.includes("?") ? "&" : "?"}cached_for=${id}`;
}

/** GET JSON, falling back to the cached copy when offline. */
export async function getJSON<T>(path: string): Promise<{ data: T; fromCache: boolean }> {
  const key = cacheUrl(path);
  try {
    const res = await apiFetch(path);
    if (!res.ok) throw await errorFrom(res);
    const copy = res.clone();
    void caches
      ?.open(API_CACHE)
      .then((cache) => cache.put(key, copy))
      .catch(() => undefined);
    return { data: (await res.json()) as T, fromCache: false };
  } catch (err) {
    if (!(err instanceof OfflineError)) throw err;
    const cached = await caches?.match(key, { cacheName: API_CACHE }).catch(() => undefined);
    if (!cached) throw err;
    return { data: (await cached.json()) as T, fromCache: true };
  }
}

/** On sign-out: removes the account's personal data from the API cache.
 *  Lesson text stays, so saved modules keep working for the next person. */
export async function forgetCachedData(userId: number) {
  try {
    const cache = await caches.open(API_CACHE);
    for (const request of await cache.keys()) {
      const url = new URL(request.url);
      if (SHARED_PATH.test(url.pathname)) continue;
      const owner = url.searchParams.get("cached_for");
      // No owner: personal data cached before accounts were kept apart.
      if (owner === null || owner === String(userId)) await cache.delete(request);
    }
  } catch {
    // This browser has no Cache Storage, so nothing was cached.
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
