import { useEffect, useRef, useState } from "react";
import ModulePanel from "../components/course/ModulePanel";
import SignPlayer from "../components/course/SignPlayer";
import Button, { ButtonLink } from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import Link from "../components/ui/Link";
import { Card as Panel, EmptyState, ErrorMessage, ProgressBar, Skeleton } from "../components/ui/primitives";
import type { Speed } from "../lib/player";
import { buildQuiz, isPass, PASS_RATIO, recordQuizAttempt, type QuizQuestion } from "../lib/quiz";
import { useOnline } from "../lib/hooks";
import type { Course, CourseModule } from "../lib/useCourse";
import { useLessonCards } from "../lib/useLessonCards";
import { usePageMeta } from "../lib/usePageMeta";
import type { Card, Lesson, QuizAnswer, User } from "../types";

interface LessonCheckProps {
  user: User;
  lesson: Lesson;
  module: CourseModule;
  course: Course;
}

/**
 * Lesson check: watch a sign, pick the matching word. No timer. Replay and
 * the three speeds stay available on every question. Questions come from the
 * lesson's own visible cards, so the check works offline once the module is
 * downloaded.
 */
export default function LessonCheck({ user, lesson, module, course }: LessonCheckProps) {
  usePageMeta(
    `Lesson check: ${lesson.title}`,
    `Check what you remember from ${lesson.title}: watch each sign and choose the word it matches. No timer.`,
  );
  const { state, retry } = useLessonCards(lesson.id);

  return (
    <div className="grid flex-1 md:grid-cols-[300px_1fr]">
      <ModulePanel module={module} course={course} currentLessonId={lesson.id} currentKind="check" />
      <div className="mx-auto w-full max-w-[900px] bg-white md:px-10 md:pt-6 md:pb-8">
        {state.status === "loading" && (
          <div className="p-4 md:p-0">
            <Skeleton label="Loading lesson check" lines={3} />
          </div>
        )}
        {state.status === "error" && (
          <div className="p-4 md:p-0">
            <ErrorMessage title="We couldn't load this lesson check" onRetry={retry}>
              {state.offline
                ? "You're offline and this lesson isn't saved on this device. Download its module while you are connected."
                : "Check your connection and try again."}
            </ErrorMessage>
          </div>
        )}
        {state.status === "ready" && <Quiz user={user} lesson={lesson} cards={state.cards} />}
      </div>
    </div>
  );
}

function Quiz({ user, lesson, cards }: { user: User; lesson: Lesson; cards: Card[] }) {
  // A fresh, reshuffled set of questions for each round.
  const [round, setRound] = useState(() => ({ number: 0, questions: buildQuiz(cards) }));
  const questions = round.questions;

  if (!questions) {
    return (
      <div className="p-4 md:p-0">
        <h1 className="mb-4 text-h1">Lesson check: {lesson.title}</h1>
        <EmptyState
          title="This lesson doesn't have a check yet"
          action={
            <ButtonLink to={`/lesson/${lesson.id}`} variant="secondary" size="sm">
              Back to the signs
            </ButtonLink>
          }
        >
          A lesson check needs at least two signs with video. It will appear once more signs are approved.
        </EmptyState>
      </div>
    );
  }
  return (
    <Round
      key={round.number}
      user={user}
      lesson={lesson}
      questions={questions}
      onRetry={() => setRound((r) => ({ number: r.number + 1, questions: buildQuiz(cards) }))}
    />
  );
}

function Round({
  user,
  lesson,
  questions,
  onRetry,
}: {
  user: User;
  lesson: Lesson;
  questions: QuizQuestion[];
  onRetry: () => void;
}) {
  const online = useOnline();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [speed, setSpeed] = useState<Speed>(1);
  const [finished, setFinished] = useState(false);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const total = questions.length;
  const question = questions[index];
  const answered = chosen !== null;
  const correct = answered && chosen === question.card.id;

  // Move focus to the result so keyboard and screen-reader users hear it.
  useEffect(() => {
    if (answered) feedbackRef.current?.focus();
  }, [answered, index]);
  useEffect(() => {
    if (finished) headingRef.current?.focus();
  }, [finished]);

  function choose(cardId: number) {
    if (answered) return;
    setChosen(cardId);
    setAnswers((a) => [...a, { card_id: question.card.id, chosen_card_id: cardId, correct: cardId === question.card.id }]);
  }

  function next() {
    if (index < total - 1) {
      setIndex(index + 1);
      setChosen(null);
    } else {
      setFinished(true);
      void recordQuizAttempt(user.id, lesson.id, answers);
    }
  }

  /* ----- Results ----- */
  if (finished) {
    const score = answers.filter((a) => a.correct).length;
    const missed = answers.filter((a) => !a.correct);
    const passed = isPass(score, total);
    const byId = new Map(questions.map((q) => [q.card.id, q.card]));
    return (
      <div className="flex flex-col gap-5 p-4 md:p-0">
        <div>
          <p className="text-cap text-muted">Lesson check · {lesson.title}</p>
          <h1 ref={headingRef} tabIndex={-1} className="mt-0.5 text-h1 outline-none">
            You got {score} of {total}
          </h1>
          <p className="mt-2 flex items-center gap-1.5 text-body">
            <Icon name={passed ? "circle-check" : "alert"} className={passed ? "text-ok" : "text-muted"} />
            {passed
              ? `Passed. A lesson check is passed at ${Math.round(PASS_RATIO * 100)}% or more.`
              : `Not passed yet. A lesson check is passed at ${Math.round(PASS_RATIO * 100)}% or more, and you can try as many times as you like.`}
          </p>
          <p className="mt-1 text-label text-muted">
            {online
              ? "Your result is saved to your account."
              : "Your result is saved on this device and will sync when you are back online."}
          </p>
        </div>

        {missed.length > 0 ? (
          <Panel as="section" aria-labelledby="missed-heading">
            <h2 id="missed-heading" className="px-5 pt-5 text-h2">
              Signs to watch again
            </h2>
            <ul className="mt-2">
              {missed.map((a) => {
                const card = byId.get(a.card_id);
                const picked = byId.get(a.chosen_card_id);
                if (!card) return null;
                return (
                  <li key={a.card_id} className="border-t border-line">
                    <Link
                      to={`/lesson/${lesson.id}#sign-${card.id}`}
                      className="flex min-h-12 items-center justify-between gap-3 px-5 py-2 text-body text-ink no-underline hover:underline"
                    >
                      <span>
                        <span className="font-semibold">{card.english_word}</span>
                        {picked && <span className="block text-label text-muted">You chose {picked.english_word}</span>}
                      </span>
                      <span className="inline-flex items-center gap-1 text-label font-semibold text-terra-ink">
                        Watch the sign
                        <Icon name="chevron-right" size={16} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>
        ) : (
          <p className="text-body">You matched every sign.</p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button variant="primary" icon="replay" onClick={onRetry}>
            Try again
          </Button>
          <ButtonLink to={`/lesson/${lesson.id}`} variant="secondary">
            Back to the signs
          </ButtonLink>
          <ButtonLink to="/" variant="ghost">
            All modules
          </ButtonLink>
        </div>
      </div>
    );
  }

  /* ----- Question ----- */
  const positionLabel = `Question ${index + 1} of ${total}`;
  return (
    <div className="flex flex-col gap-3.5">
      <div className="px-4 pt-4 md:p-0">
        <p className="text-cap text-muted">Lesson check · {lesson.title} · no timer</p>
        <h1 className="mt-0.5 text-[26px] leading-8 font-semibold md:text-h1">Which sign is this?</h1>
        <ProgressBar value={index + (answered ? 1 : 0)} max={total} label={positionLabel} className="mt-3" />
        <p className="mt-1 text-cap text-ink">{positionLabel}</p>
      </div>

      <SignPlayer
        key={question.card.id}
        card={question.card}
        speed={speed}
        onSpeedChange={setSpeed}
        label={`Sign video for question ${index + 1}`}
      />

      <fieldset className="border-t border-line px-4 pt-4 md:px-0">
        <legend className="sr-only">Choose the word that matches the sign</legend>
        <p className="mb-2 text-label font-semibold" aria-hidden="true">
          Choose the word that matches the sign
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {question.options.map((option) => {
            const isChosen = chosen === option.id;
            const isAnswer = option.id === question.card.id;
            const showRight = answered && isAnswer;
            const showWrong = answered && isChosen && !isAnswer;
            return (
              <button
                key={option.id}
                type="button"
                disabled={answered}
                aria-pressed={isChosen}
                onClick={() => choose(option.id)}
                className={`flex min-h-12 items-center justify-between gap-2 rounded-ctl border px-4 text-left text-body ${
                  showRight
                    ? "border-2 border-ok bg-ok-bg font-semibold text-ink"
                    : showWrong
                      ? "border-2 border-danger bg-danger-bg font-semibold text-danger-ink"
                      : answered
                        ? "border-line bg-white text-muted"
                        : "cursor-pointer border-control bg-white text-ink hover:bg-cream"
                }`}
              >
                <span>{option.english_word}</span>
                {showRight && (
                  <span className="inline-flex items-center gap-1 text-label text-ok">
                    <Icon name="circle-check" size={18} />
                    Correct answer
                  </span>
                )}
                {showWrong && (
                  <span className="inline-flex items-center gap-1 text-label text-danger">
                    <Icon name="x" size={18} />
                    Your answer
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-3 px-4 pb-4 md:px-0 md:pb-0">
        {answered && (
          <div
            ref={feedbackRef}
            tabIndex={-1}
            role="status"
            className={`flex items-center gap-2 rounded-ctl p-3.5 text-body outline-none ${
              correct ? "bg-ok-bg" : "bg-danger-bg"
            }`}
          >
            <Icon name={correct ? "circle-check" : "alert"} size={22} className={correct ? "text-ok" : "text-danger"} />
            {correct ? (
              <span className="font-semibold">Correct</span>
            ) : (
              <span>
                <span className="font-semibold">Not quite:</span> this is <em>{question.card.english_word}</em>
              </span>
            )}
          </div>
        )}
        <div className="flex justify-end">
          <Button variant="primary" iconAfter="chevron-right" onClick={next} disabled={!answered}>
            {index < total - 1 ? "Next" : "See results"}
          </Button>
        </div>
      </div>
    </div>
  );
}
