/**
 * Lesson check (quiz).
 *
 * Questions are generated on the device from the lesson's visible cards:
 * watch a sign video, pick the matching word. There is no question bank, so
 * a newly approved sign joins the check automatically and the check works
 * offline once the module is downloaded.
 *
 * Results are stored in IndexedDB first and sent to
 * /api/quiz-attempts/sync/, which is idempotent on client_event_id.
 */
import { ApiError, getJSON, OfflineError, sendJSON } from "./api";
import { db } from "./db";
import { newId } from "./progress";
import type { Card, QueuedQuizAttempt, QuizAnswer, QuizAttempt, QuizSummary } from "../types";

export const QUIZ_CHANGED = "ksl:quiz-changed";
/** A lesson check counts as passed at 75% or more. Shown on the Progress page. */
export const PASS_RATIO = 0.75;
export const MAX_OPTIONS = 4;
export const MIN_SIGNS = 2;

export interface QuizQuestion {
  card: Card;
  /** The correct card plus distractors from the same lesson, shuffled. */
  options: Card[];
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Cards that can be asked about: they need a video to watch. */
export function quizCards(cards: Card[]): Card[] {
  return cards.filter((c) => c.video_url);
}

/**
 * Build one question per sign. Each has up to 4 options (as many as the
 * lesson has, minimum 2). Returns null when the lesson has fewer than 2
 * signs with video, because a one-option question is not a question.
 */
export function buildQuiz(cards: Card[], random: () => number = Math.random): QuizQuestion[] | null {
  const pool = quizCards(cards);
  if (pool.length < MIN_SIGNS) return null;
  return shuffle(pool, random).map((card) => {
    const distractors = shuffle(
      pool.filter((c) => c.id !== card.id),
      random,
    ).slice(0, MAX_OPTIONS - 1);
    return { card, options: shuffle([card, ...distractors], random) };
  });
}

export function isPass(score: number, total: number): boolean {
  return total > 0 && score / total >= PASS_RATIO;
}

/* ---------- saving and syncing ---------- */

export async function recordQuizAttempt(userId: number, lessonId: number, answers: QuizAnswer[]) {
  const attempt: QueuedQuizAttempt = {
    client_event_id: newId(),
    lesson_id: lessonId,
    score: answers.filter((a) => a.correct).length,
    total: answers.length,
    answers,
    completed_at: new Date().toISOString(),
    user_id: userId,
  };
  await (await db()).put("quizQueue", attempt);
  window.dispatchEvent(new Event(QUIZ_CHANGED));
  void syncQuizAttempts(userId);
  return attempt;
}

export async function pendingQuizAttempts(userId: number): Promise<QueuedQuizAttempt[]> {
  return (await db()).getAllFromIndex("quizQueue", "by_user", userId);
}

interface SyncResponse {
  applied: string[];
  duplicates: string[];
  rejected: { client_event_id: string | null; error: string }[];
}

let syncing: Promise<void> | null = null;

export function syncQuizAttempts(userId: number): Promise<void> {
  syncing ??= (async () => {
    try {
      const database = await db();
      const attempts = await pendingQuizAttempts(userId);
      if (!attempts.length) return;
      const res = await sendJSON<SyncResponse>("/api/quiz-attempts/sync/", "POST", {
        attempts: attempts.map(({ client_event_id, lesson_id, answers, completed_at }) => ({
          client_event_id,
          lesson_id,
          answers,
          completed_at,
        })),
      });
      const done = [...res.applied, ...res.duplicates, ...res.rejected.map((r) => r.client_event_id ?? "")];
      const tx = database.transaction("quizQueue", "readwrite");
      await Promise.all(done.filter(Boolean).map((id) => tx.store.delete(id)));
      await tx.done;
      window.dispatchEvent(new Event(QUIZ_CHANGED));
    } catch (err) {
      // Offline or server unreachable: keep the queue and try again later.
      if (!(err instanceof OfflineError) && !(err instanceof ApiError)) throw err;
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

/* ---------- reading results ---------- */

/** Best and latest result per lesson, from the server plus anything still
 *  waiting to sync on this device. */
export function summarise(server: QuizAttempt[], pending: QueuedQuizAttempt[]): Map<number, QuizSummary> {
  const pendingIds = new Set(pending.map((p) => p.client_event_id));
  const all = [...server.filter((a) => !pendingIds.has(a.client_event_id)), ...pending];
  const byLesson = new Map<number, QuizAttempt[]>();
  for (const a of all) byLesson.set(a.lesson_id, [...(byLesson.get(a.lesson_id) ?? []), a]);

  const out = new Map<number, QuizSummary>();
  for (const [lessonId, attempts] of byLesson) {
    const newestFirst = [...attempts].sort((a, b) => b.completed_at.localeCompare(a.completed_at));
    const last = newestFirst[0];
    // Best = highest share correct; ties go to the more recent attempt.
    const best = newestFirst.reduce((top, a) => (a.score / a.total > top.score / top.total ? a : top), last);
    out.set(lessonId, {
      attempts: attempts.length,
      best: { score: best.score, total: best.total },
      last: { score: last.score, total: last.total },
      passed: attempts.some((a) => isPass(a.score, a.total)),
      pending: pendingIds.has(last.client_event_id),
    });
  }
  return out;
}

export async function loadQuizSummaries(userId: number): Promise<Map<number, QuizSummary>> {
  const [server, pending] = await Promise.all([
    getJSON<QuizAttempt[]>("/api/quiz-attempts/")
      .then((r) => r.data)
      .catch(() => [] as QuizAttempt[]),
    pendingQuizAttempts(userId).catch(() => [] as QueuedQuizAttempt[]),
  ]);
  return summarise(server, pending);
}

/** "Not taken", or "Best 6 of 8 · last 5 of 8". */
export function quizStatusText(summary: QuizSummary | undefined): string {
  if (!summary) return "Not taken";
  const { best, last } = summary;
  return `Best ${best.score} of ${best.total} · last ${last.score} of ${last.total}`;
}
