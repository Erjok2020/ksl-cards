/**
 * Progress tracking that works offline (FR-04, NFR-02).
 *
 * Every progress update becomes an event with its own client_event_id and is
 * stored in IndexedDB first. Events are sent to /api/progress/sync/ when the
 * device is online. The server ignores event ids it has seen before, so a
 * queue that is sent twice (e.g. the connection drops mid-request) never
 * creates duplicate records.
 */
import { ApiError, OfflineError, sendJSON } from "./api";
import { db } from "./db";
import type { ProgressRecord, QueuedProgressEvent } from "../types";

export const PROGRESS_CHANGED = "ksl:progress-changed";
const BATCH = 200;

interface SyncResponse {
  applied: string[];
  duplicates: string[];
  rejected: { client_event_id: string | null; error: string }[];
  progress: ProgressRecord[];
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback for older browsers / non-secure origins.
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16),
  );
}

export async function recordProgress(
  userId: number,
  lessonId: number,
  completedCards: number,
  completed: boolean,
) {
  const event: QueuedProgressEvent = {
    client_event_id: newId(),
    lesson_id: lessonId,
    completed_cards: completedCards,
    completed,
    user_id: userId,
    created_at: Date.now(),
  };
  await (await db()).put("progressQueue", event);
  window.dispatchEvent(new Event(PROGRESS_CHANGED));
  void syncProgress(userId);
}

export async function pendingEvents(userId: number): Promise<QueuedProgressEvent[]> {
  return (await db()).getAllFromIndex("progressQueue", "by_user", userId);
}

let syncing: Promise<void> | null = null;

export function syncProgress(userId: number): Promise<void> {
  syncing ??= (async () => {
    try {
      const database = await db();
      const events = (await pendingEvents(userId)).sort((a, b) => a.created_at - b.created_at);
      for (let i = 0; i < events.length; i += BATCH) {
        const batch = events.slice(i, i + BATCH);
        const res = await sendJSON<SyncResponse>("/api/progress/sync/", "POST", {
          events: batch.map(({ client_event_id, lesson_id, completed_cards, completed }) => ({
            client_event_id,
            lesson_id,
            completed_cards,
            completed,
          })),
        });
        // Applied, duplicate and permanently rejected events all leave the queue.
        const done = new Set<string>([
          ...res.applied,
          ...res.duplicates,
          ...res.rejected.map((r) => r.client_event_id ?? ""),
        ]);
        const tx = database.transaction("progressQueue", "readwrite");
        await Promise.all([...done].filter(Boolean).map((id) => tx.store.delete(id)));
        await tx.done;
      }
      if (events.length) window.dispatchEvent(new Event(PROGRESS_CHANGED));
    } catch (err) {
      // Offline or server unreachable: keep the queue and try again later.
      if (!(err instanceof OfflineError) && !(err instanceof ApiError)) throw err;
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

/** Merge server progress with events still waiting to sync. */
export function mergeProgress(
  server: ProgressRecord[],
  pending: QueuedProgressEvent[],
): Map<number, { completed_cards: number; completed: boolean; pending: boolean }> {
  const merged = new Map<number, { completed_cards: number; completed: boolean; pending: boolean }>();
  for (const p of server) {
    merged.set(p.lesson_id, { completed_cards: p.completed_cards, completed: p.completed, pending: false });
  }
  for (const e of pending) {
    const cur = merged.get(e.lesson_id) ?? { completed_cards: 0, completed: false, pending: false };
    merged.set(e.lesson_id, {
      completed_cards: Math.max(cur.completed_cards, e.completed_cards),
      completed: cur.completed || e.completed,
      pending: true,
    });
  }
  return merged;
}
