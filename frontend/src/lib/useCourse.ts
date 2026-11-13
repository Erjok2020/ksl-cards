/**
 * Everything the course screens need, from the real API and the local
 * queues: lessons grouped into modules, progress, offline downloads and
 * lesson check results. Nothing here is invented or estimated.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { connectionProblem, getJSON, OfflineError } from "./api";
import {
  cacheSupported,
  DOWNLOADS_CHANGED,
  listDownloads,
  storageUsed,
  verifyDownload,
} from "./downloads";
import { useEventVersion, useOnline } from "./hooks";
import { mergeProgress, pendingEvents, PROGRESS_CHANGED } from "./progress";
import { loadQuizSummaries, QUIZ_CHANGED } from "./quiz";
import type { DownloadRecord, Lesson, ProgressRecord, QuizSummary } from "../types";

export const COURSE_NAME = "KSL Foundations";

export interface LessonProgress {
  completed_cards: number;
  completed: boolean;
  pending: boolean;
}

export interface CourseModule {
  /** The module name as stored, e.g. "Module 1: Greetings". Used as the key. */
  key: string;
  /** 1-based position in the course. */
  number: number;
  /** Display title without the "Module 1: " prefix. */
  title: string;
  lessons: Lesson[];
  signCount: number;
  sizeKb: number;
  signsViewed: number;
  lessonsDone: number;
  completed: boolean;
  started: boolean;
  /** "saved" | "removed" (cleared by the browser) | "none". */
  offline: "saved" | "removed" | "none";
}

export type OfflineState = CourseModule["offline"];

export function moduleTitle(key: string): string {
  return key.replace(/^Module\s+\d+\s*[:.-]\s*/i, "") || key;
}

export interface Course {
  status: "loading" | "ready" | "error";
  error: string;
  fromCache: boolean;
  lessons: Lesson[];
  modules: CourseModule[];
  progress: Map<number, LessonProgress>;
  quiz: Map<number, QuizSummary>;
  totals: {
    signs: number;
    signsViewed: number;
    reviewedSigns: number;
    lessons: number;
    lessonsDone: number;
    modulesDone: number;
    savedModules: number;
    savedKb: number;
    checksPassed: number;
  };
  storage: { usedKb: number; quotaKb: number } | null;
  /** First unfinished lesson, preferring one already started. */
  resume: { lesson: Lesson; started: boolean } | null;
  reload: () => void;
}

export function useCourse(userId: number): Course {
  const online = useOnline();
  const downloadsVersion = useEventVersion(DOWNLOADS_CHANGED);
  const progressVersion = useEventVersion(PROGRESS_CHANGED);
  const quizVersion = useEventVersion(QUIZ_CHANGED);
  const [attempt, setAttempt] = useState(0);

  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState("");
  const [downloads, setDownloads] = useState<Map<string, DownloadRecord>>(new Map());
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [storage, setStorage] = useState<Course["storage"]>(null);
  const [progress, setProgress] = useState<Map<number, LessonProgress>>(new Map());
  const [quiz, setQuiz] = useState<Map<number, QuizSummary>>(new Map());

  useEffect(() => {
    let active = true;
    getJSON<Lesson[]>("/api/lessons/")
      .then(({ data, fromCache: cached }) => {
        if (!active) return;
        setLessons(data);
        setFromCache(cached);
        setError("");
      })
      .catch((err: unknown) => {
        if (!active) return;
        setLessons([]);
        setError(
          err instanceof OfflineError
            ? connectionProblem(
                "You're offline and no lessons are saved on this device yet. Connect once and download a module.",
              )
            : "Check your connection, or open a module you saved earlier.",
        );
      });
    return () => {
      active = false;
    };
  }, [online, attempt]);

  useEffect(() => {
    let active = true;
    (async () => {
      const records = cacheSupported() ? await listDownloads() : new Map<string, DownloadRecord>();
      const gone = new Set<string>();
      for (const r of records.values()) {
        if (!(await verifyDownload(r))) gone.add(r.module);
      }
      const used = await storageUsed();
      if (!active) return;
      setDownloads(records);
      setMissing(gone);
      setStorage(used);
    })().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [downloadsVersion]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [server, pending] = await Promise.all([
        getJSON<ProgressRecord[]>("/api/progress/me/")
          .then((r) => r.data)
          .catch(() => [] as ProgressRecord[]),
        pendingEvents(userId).catch(() => []),
      ]);
      if (active) setProgress(mergeProgress(server, pending));
    })();
    return () => {
      active = false;
    };
  }, [userId, progressVersion, online]);

  useEffect(() => {
    let active = true;
    loadQuizSummaries(userId).then((s) => active && setQuiz(s));
    return () => {
      active = false;
    };
  }, [userId, quizVersion, online]);

  const reload = useCallback(() => {
    setLessons(null);
    setAttempt((a) => a + 1);
  }, []);

  return useMemo<Course>(() => {
    const list = lessons ?? [];
    const groups = new Map<string, Lesson[]>();
    for (const l of list) {
      const key = l.module || "Other lessons";
      groups.set(key, [...(groups.get(key) ?? []), l]);
    }
    const viewed = (l: Lesson) => Math.min(progress.get(l.id)?.completed_cards ?? 0, l.card_count);

    const modules: CourseModule[] = [...groups.entries()].map(([key, ls], i) => {
      const lessonsDone = ls.filter((l) => progress.get(l.id)?.completed).length;
      const signsViewed = ls.reduce((s, l) => s + viewed(l), 0);
      return {
        key,
        number: i + 1,
        title: moduleTitle(key),
        lessons: ls,
        signCount: ls.reduce((s, l) => s + l.card_count, 0),
        sizeKb: ls.reduce((s, l) => s + l.download_size_kb, 0),
        signsViewed,
        lessonsDone,
        completed: ls.length > 0 && lessonsDone === ls.length,
        started: signsViewed > 0 || lessonsDone > 0,
        offline: !downloads.has(key) ? "none" : missing.has(key) ? "removed" : "saved",
      };
    });

    const unfinished = list.filter((l) => !progress.get(l.id)?.completed);
    const inProgress = unfinished.find((l) => viewed(l) > 0);
    const next = inProgress ?? unfinished[0] ?? null;
    const saved = modules.filter((m) => m.offline === "saved");

    return {
      status: lessons === null ? "loading" : error ? "error" : "ready",
      error,
      fromCache,
      lessons: list,
      modules,
      progress,
      quiz,
      totals: {
        signs: list.reduce((s, l) => s + l.card_count, 0),
        signsViewed: list.reduce((s, l) => s + viewed(l), 0),
        reviewedSigns: list.reduce((s, l) => s + (l.reviewed_count ?? 0), 0),
        lessons: list.length,
        lessonsDone: list.length - unfinished.length,
        modulesDone: modules.filter((m) => m.completed).length,
        savedModules: saved.length,
        savedKb: saved.reduce((s, m) => s + m.sizeKb, 0),
        checksPassed: list.filter((l) => quiz.get(l.id)?.passed).length,
      },
      storage,
      resume: next ? { lesson: next, started: !!inProgress } : null,
      reload,
    };
  }, [lessons, error, fromCache, downloads, missing, storage, progress, quiz, reload]);
}

/** Whether a lesson has enough signs with video for a lesson check. The
 *  lesson list doesn't say which cards have video, so this is the cheap
 *  version used for list rows; the check page itself verifies with the cards. */
export function mayHaveLessonCheck(lesson: Lesson): boolean {
  return lesson.card_count >= 2;
}
