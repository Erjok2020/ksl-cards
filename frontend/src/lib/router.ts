/**
 * A very small History API router. The app only needs path matching, links
 * and navigation, so this avoids adding a routing library.
 */
import { useSyncExternalStore } from "react";

const NAVIGATE = "ksl:navigate";

function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener(NAVIGATE, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(NAVIGATE, callback);
  };
}

/** Current pathname, without a trailing slash (except for "/"). */
export function usePath(): string {
  return useSyncExternalStore(subscribe, readPath, () => "/");
}

function readPath(): string {
  const p = window.location.pathname;
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

export function useHash(): string {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("hashchange", cb);
      const off = subscribe(cb);
      return () => {
        window.removeEventListener("hashchange", cb);
        off();
      };
    },
    () => window.location.hash,
    () => "",
  );
}

export function navigate(to: string, options: { replace?: boolean } = {}) {
  const current = window.location.pathname + window.location.search + window.location.hash;
  if (to !== current) {
    if (options.replace) window.history.replaceState(null, "", to);
    else window.history.pushState(null, "", to);
  }
  window.dispatchEvent(new Event(NAVIGATE));

  const hash = to.includes("#") ? to.slice(to.indexOf("#") + 1) : "";
  // After the new page renders: go to the anchor, or to the top and move
  // focus to the main region so keyboard and screen-reader users land there.
  requestAnimationFrame(() => {
    const target = hash ? document.getElementById(hash) : null;
    if (target) {
      target.scrollIntoView();
      target.focus?.({ preventScroll: true });
    } else {
      window.scrollTo(0, 0);
      document.getElementById("main")?.focus({ preventScroll: true });
    }
  });
}

/** Match "/lesson/:id" against a path. Returns params, or null if no match. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const want = pattern.split("/").filter(Boolean);
  const have = path.split("/").filter(Boolean);
  if (want.length !== have.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < want.length; i++) {
    if (want[i].startsWith(":")) params[want[i].slice(1)] = decodeURIComponent(have[i]);
    else if (want[i] !== have[i]) return null;
  }
  return params;
}
