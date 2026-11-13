import { useCallback, useEffect, useState } from "react";
import { getJSON, OfflineError } from "./api";
import type { Card } from "../types";

/** Loads a lesson's cards (falls back to the saved copy when offline). */
export function useLessonCards(lessonId: number) {
  const [state, setState] = useState<
    { status: "loading" } | { status: "ready"; cards: Card[] } | { status: "error"; offline: boolean }
  >({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    getJSON<Card[]>(`/api/lessons/${lessonId}/cards/`)
      .then(({ data }) => active && setState({ status: "ready", cards: data }))
      .catch((err: unknown) => active && setState({ status: "error", offline: err instanceof OfflineError }));
    return () => {
      active = false;
    };
  }, [lessonId, attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((a) => a + 1);
  }, []);
  return { state, retry };
}
