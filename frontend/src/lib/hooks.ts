import { useEffect, useState, useSyncExternalStore } from "react";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

/** Re-runs a loader whenever any of the given window events fire. */
export function useEventVersion(...events: string[]): number {
  const [version, setVersion] = useState(0);
  const key = events.join("|");
  useEffect(() => {
    const names = key.split("|");
    const bump = () => setVersion((v) => v + 1);
    names.forEach((n) => window.addEventListener(n, bump));
    return () => names.forEach((n) => window.removeEventListener(n, bump));
  }, [key]);
  return version;
}
