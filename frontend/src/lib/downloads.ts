/**
 * Per-module offline downloads (FR-05, sequence diagram flow 1).
 *
 * Downloading a module saves the lesson text in the "ksl-api" cache and every
 * sign video and poster in the "ksl-media" cache, which the service worker
 * serves when there is no connection. A module only counts as downloaded once
 * every file has been saved; an interrupted download is cleaned up.
 */
import { API_CACHE, API_URL, apiFetch, OfflineError } from "./api";
import { db } from "./db";
import type { Card, DownloadRecord, Lesson } from "../types";

export const MEDIA_CACHE = "ksl-media";
export const DOWNLOADS_CHANGED = "ksl:downloads-changed";

export function cacheSupported(): boolean {
  return typeof caches !== "undefined" && "serviceWorker" in navigator;
}

export async function listDownloads(): Promise<Map<string, DownloadRecord>> {
  const all = await (await db()).getAll("downloads");
  return new Map(all.map((d) => [d.module, d]));
}

export async function downloadModule(
  module: string,
  lessons: Lesson[],
  onProgress: (done: number, total: number) => void,
): Promise<DownloadRecord> {
  if (!cacheSupported()) throw new Error("This browser can't save lessons for offline use.");
  // Ask the browser not to clear our storage under pressure (best effort).
  void navigator.storage?.persist?.().catch(() => undefined);

  const apiCache = await caches.open(API_CACHE);
  const mediaCache = await caches.open(MEDIA_CACHE);
  const urls: string[] = [];
  const savedHere: string[] = [];

  try {
    // 1. Lesson text, including the lesson list itself.
    const lessonListRes = await apiFetch("/api/lessons/");
    if (lessonListRes.ok) await apiCache.put(`${API_URL}/api/lessons/`, lessonListRes);

    const cardsByLesson: Card[][] = [];
    for (const lesson of lessons) {
      const path = `/api/lessons/${lesson.id}/cards/`;
      const res = await apiFetch(path);
      if (!res.ok) throw new Error(`Couldn't load ${lesson.title}.`);
      cardsByLesson.push((await res.clone().json()) as Card[]);
      await apiCache.put(`${API_URL}${path}`, res);
    }

    for (const cards of cardsByLesson) {
      for (const c of cards) {
        if (c.video_url) urls.push(c.video_url);
        if (c.poster_url) urls.push(c.poster_url);
      }
    }

    // 2. Sign videos and posters.
    let done = 0;
    onProgress(done, urls.length);
    for (const url of urls) {
      if (!(await mediaCache.match(url))) {
        let res: Response;
        try {
          res = await fetch(url, { mode: "cors" });
        } catch {
          throw new OfflineError();
        }
        if (!res.ok) throw new Error("A sign video failed to download. Please try again.");
        await mediaCache.put(url, res);
        savedHere.push(url);
      }
      done += 1;
      onProgress(done, urls.length);
    }
  } catch (err) {
    // Interrupted download: don't leave half a module behind.
    await Promise.all(savedHere.map((u) => mediaCache.delete(u)));
    throw err;
  }

  const record: DownloadRecord = {
    module,
    lessonIds: lessons.map((l) => l.id),
    urls,
    sizeKb: lessons.reduce((sum, l) => sum + l.download_size_kb, 0),
    downloadedAt: Date.now(),
  };
  await (await db()).put("downloads", record);
  window.dispatchEvent(new Event(DOWNLOADS_CHANGED));
  return record;
}

export async function removeModule(module: string) {
  const database = await db();
  const record = await database.get("downloads", module);
  if (!record) return;
  // Keep files that another downloaded module also uses.
  const others = (await database.getAll("downloads")).filter((d) => d.module !== module);
  const stillNeeded = new Set(others.flatMap((d) => d.urls));
  const mediaCache = await caches.open(MEDIA_CACHE);
  await Promise.all(record.urls.filter((u) => !stillNeeded.has(u)).map((u) => mediaCache.delete(u)));
  await database.delete("downloads", module);
  window.dispatchEvent(new Event(DOWNLOADS_CHANGED));
}

/** Checks the files are really still there (browsers can clear storage). */
export async function verifyDownload(record: DownloadRecord): Promise<boolean> {
  if (!cacheSupported()) return false;
  const mediaCache = await caches.open(MEDIA_CACHE);
  const checks = await Promise.all(record.urls.map((u) => mediaCache.match(u)));
  return checks.every(Boolean);
}

export async function storageUsed(): Promise<{ usedKb: number; quotaKb: number } | null> {
  const estimate = await navigator.storage?.estimate?.().catch(() => undefined);
  if (!estimate) return null;
  return {
    usedKb: Math.round((estimate.usage ?? 0) / 1024),
    quotaKb: Math.round((estimate.quota ?? 0) / 1024),
  };
}
