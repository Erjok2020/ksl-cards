import { useCallback, useEffect, useRef, useState } from "react";
import ModulePanel from "../components/course/ModulePanel";
import SignPlayer, { type SignPlayerHandle } from "../components/course/SignPlayer";
import Button, { ButtonLink } from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import Link from "../components/ui/Link";
import { Chip, ErrorMessage, Skeleton } from "../components/ui/primitives";
import type { Speed } from "../lib/player";
import { recordProgress } from "../lib/progress";
import { useHash } from "../lib/router";
import { mayHaveLessonCheck, type Course, type CourseModule } from "../lib/useCourse";
import { useLessonCards } from "../lib/useLessonCards";
import { usePageMeta } from "../lib/usePageMeta";
import type { Card, Lesson, User } from "../types";

/* ---------- Lesson item view ---------- */

interface LessonViewProps {
  user: User;
  lesson: Lesson;
  module: CourseModule;
  course: Course;
}

export default function LessonView({ user, lesson, module, course }: LessonViewProps) {
  usePageMeta(
    lesson.title,
    `Watch the ${lesson.card_count} Kenyan Sign Language signs in ${lesson.title}, with replay and slow playback.`,
  );
  const { state, retry } = useLessonCards(lesson.id);

  return (
    <div className="grid flex-1 md:grid-cols-[300px_1fr]">
      <ModulePanel module={module} course={course} currentLessonId={lesson.id} currentKind="signs" />
      <div className="mx-auto w-full max-w-[900px] bg-white md:px-10 md:pt-6 md:pb-8">
        {state.status === "loading" && (
          <div className="p-4 md:p-0">
            <Skeleton label="Loading signs" lines={3} />
          </div>
        )}
        {state.status === "error" && (
          <div className="p-4 md:p-0">
            <ErrorMessage title="We couldn't load this lesson" onRetry={retry}>
              {state.offline
                ? "You're offline and this lesson isn't saved on this device. Download its module while you are connected."
                : "Check your connection and try again."}
            </ErrorMessage>
          </div>
        )}
        {state.status === "ready" && state.cards.length === 0 && (
          <div className="p-4 md:p-0">
            <ErrorMessage title="No approved signs in this lesson yet">
              Signs appear here after a Deaf KSL reviewer approves them.
            </ErrorMessage>
          </div>
        )}
        {state.status === "ready" && state.cards.length > 0 && (
          <Signs user={user} lesson={lesson} module={module} cards={state.cards} />
        )}
      </div>
    </div>
  );
}

function Signs({ user, lesson, module, cards }: { user: User; lesson: Lesson; module: CourseModule; cards: Card[] }) {
  const hash = useHash();
  const fromHash = cards.findIndex((c) => hash === `#sign-${c.id}`);
  const [index, setIndex] = useState(fromHash >= 0 ? fromHash : 0);
  const [furthest, setFurthest] = useState(0);
  const [finished, setFinished] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const player = useRef<SignPlayerHandle>(null);
  const total = cards.length;
  const card = cards[index];
  const hasCheck = mayHaveLessonCheck(lesson);

  const markViewed = useCallback(
    (upTo: number) => {
      if (upTo > furthest) {
        setFurthest(upTo);
        void recordProgress(user.id, lesson.id, upTo, upTo >= total);
      }
    },
    [furthest, lesson.id, total, user.id],
  );

  const next = useCallback(() => {
    markViewed(index + 1);
    if (index < total - 1) setIndex(index + 1);
    else setFinished(true);
  }, [index, markViewed, total]);

  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Keyboard: Space play/pause, R replay, S speed, arrows previous/next sign.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const onControl = tag === "BUTTON" || tag === "A" || tag === "SUMMARY";
      if (e.key === " " && !onControl) {
        e.preventDefault();
        player.current?.toggle();
      } else if (e.key === "r" || e.key === "R") player.current?.replay();
      else if (e.key === "s" || e.key === "S") player.current?.cycleSpeed();
      else if (e.key === "ArrowRight" && !finished) next();
      else if (e.key === "ArrowLeft" && !finished) prev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished, next, prev]);

  if (finished) {
    return (
      <div className="mx-auto flex max-w-[520px] flex-col gap-4 p-6 text-center md:py-12">
        <Icon name="circle-check" size={48} className="mx-auto text-ok" />
        <h1 className="text-h1">Lesson complete</h1>
        <p className="text-body text-muted">
          You went through all {total} signs in <strong className="font-semibold text-ink">{lesson.title}</strong>.
          Your progress is saved{navigator.onLine ? "" : " on this device and will sync when you're back online"}.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {hasCheck && (
            <ButtonLink to={`/lesson/${lesson.id}/check`} variant="primary" iconAfter="chevron-right">
              Take the lesson check
            </ButtonLink>
          )}
          <Button
            variant="secondary"
            icon="replay"
            onClick={() => {
              setFinished(false);
              setIndex(0);
            }}
          >
            Study again
          </Button>
          <ButtonLink to="/" variant="ghost">
            All modules
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="px-4 pt-4 md:p-0">
        <p className="text-cap text-muted">
          Sign videos · {total} signs · sign {index + 1} of {total}
        </p>
        <h1 className="mt-0.5 text-[26px] leading-8 font-semibold md:text-h1">{lesson.title}</h1>
      </div>

      <div role="group" aria-label="Signs in this lesson" className="flex gap-2 overflow-x-auto px-4 pb-1 md:flex-wrap md:px-0">
        {cards.map((c, i) => (
          <button
            key={c.id}
            type="button"
            aria-current={i === index ? "step" : undefined}
            onClick={() => setIndex(i)}
            className={`inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-ctl px-3.5 text-nav ${
              i === index ? "bg-forest font-semibold text-white" : "border border-line bg-white text-ink"
            }`}
          >
            {i + 1}. {c.english_word}
          </button>
        ))}
      </div>

      <SignPlayer
        ref={player}
        key={card.id}
        card={card}
        speed={speed}
        onSpeedChange={setSpeed}
        label={`Sign video: ${card.english_word}`}
      />

      <div className="grid gap-5 border-t border-line px-4 pt-4 md:grid-cols-2 md:px-0">
        <div>
          <h2 className="text-h3">{card.english_word}</h2>
          {card.kiswahili && (
            <p className="mt-0.5 mb-1.5 text-label text-muted" lang="sw">
              {card.kiswahili}
            </p>
          )}
          {card.context_sentence && <p className="text-body">“{card.context_sentence}”</p>}
          <p className="mt-2 text-label text-muted">
            <span className="font-semibold text-ink">How to sign it: </span>
            {card.movement_description || "A written description will be added after review by a Deaf KSL reviewer."}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2">
          {card.reviewed ? (
            <span className="flex items-center gap-1.5 text-label text-forest">
              <Icon name="shield" size={16} />
              Reviewed by a Deaf KSL reviewer
            </span>
          ) : (
            <Chip tone="danger" icon="alert">
              Sample clip, not a reviewed KSL sign
            </Chip>
          )}
          {module.offline === "saved" && (
            <span className="flex items-center gap-1.5 text-label text-forest">
              <Icon name="saved" size={16} />
              Plays offline on this device
            </span>
          )}
          <Link
            to={`/feedback?page=${encodeURIComponent(`/lesson/${lesson.id}#sign-${card.id}`)}`}
            className="inline-flex min-h-9 items-center text-label"
          >
            Report a problem with this video
          </Link>
        </div>
      </div>

      <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-line bg-white px-4 py-3 md:static md:flex md:justify-between md:px-0 md:pt-4 md:pb-0">
        <Button variant="secondary" icon="chevron-left" onClick={prev} disabled={index === 0}>
          <span>
            Previous<span className="hidden sm:inline"> sign</span>
          </span>
        </Button>
        <Button variant="primary" iconAfter="chevron-right" onClick={next}>
          {index < total - 1 ? "Next sign" : "Finish lesson"}
        </Button>
      </div>
      <p className="hidden text-cap text-muted md:block">
        Keyboard: Space play or pause · R replay · S speed · ← → previous or next sign
      </p>
    </div>
  );
}
