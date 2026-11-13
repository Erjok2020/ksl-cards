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
  // Videos are essential; posters are optional (an old image link on another
  // site may not allow offline saving, and must not block the whole module).
  const files: { url: string; required: boolean }[] = [];
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
        if (c.video_url) files.push({ url: c.video_url, required: true });
        if (c.poster_url) files.push({ url: c.poster_url, required: false });
      }
    }

    // 2. Sign videos and posters.
    let done = 0;
    onProgress(done, files.length);
    for (const file of files) {
      if (await mediaCache.match(file.url)) {
        urls.push(file.url);
      } else {
        let res: Response | null = null;
        try {
          res = await fetch(file.url, { mode: "cors" });
        } catch {
          if (file.required) throw new OfflineError();
        }
        if (res?.ok) {
          await mediaCache.put(file.url, res);
          savedHere.push(file.url);
          urls.push(file.url);
        } else if (file.required) {
          throw new Error("A sign video failed to download. Please try again.");
        }
      }
      done += 1;
      onProgress(done, files.length);
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
