import { useState } from "react";
import OfflineControl from "../components/course/OfflineControl";
import { ButtonLink } from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import Link from "../components/ui/Link";
import { Card, ErrorMessage, ProgressBar, Skeleton } from "../components/ui/primitives";
import { formatSize } from "../lib/api";
import { quizStatusText } from "../lib/quiz";
import { useHash } from "../lib/router";
import { COURSE_NAME, mayHaveLessonCheck, type Course, type CourseModule } from "../lib/useCourse";
import type { Lesson } from "../types";

/** Written from the three real modules only. Update when modules change. */
const WHAT_YOU_LEARN = [
  "Greet people: hello, goodbye, please and thank you",
  "Count from one to ten",
  "Name family members: mother, father, sister and brother",
];

function reviewLine(course: Course): { text: string; reviewed: boolean } {
  const { signs, reviewedSigns } = course.totals;
  if (signs > 0 && reviewedSigns === signs) return { text: "Reviewed by a Deaf KSL reviewer", reviewed: true };
  if (reviewedSigns > 0) {
    return { text: `${reviewedSigns} of ${signs} signs reviewed by a Deaf KSL reviewer`, reviewed: true };
  }
  return { text: "Sample clips: not yet reviewed", reviewed: false };
}

/* ---------- Banner (forest) ---------- */

export function CourseBanner({ course, pendingSync }: { course: Course; pendingSync: number }) {
  const { totals, resume, modules } = course;
  const review = reviewLine(course);
  const unsaved = modules.filter((m) => m.offline !== "saved").length;
  const viewedLabel = `${totals.signsViewed} of ${totals.signs} signs viewed`;

  return (
    <section className="on-forest bg-forest text-white" aria-labelledby="course-title">
      <div className="wrap grid gap-6 py-7 md:grid-cols-[1fr_340px] md:items-center md:gap-10 md:pb-8">
        <div>
          <p className="text-label text-on-forest-muted">My learning / Kenyan Sign Language</p>
          <h1 id="course-title" className="mt-2 text-[24px] leading-[30px] font-semibold md:text-h1">
            {COURSE_NAME}
          </h1>
          <p className="mt-2 max-w-[600px] text-[17px] leading-[26px] text-on-forest">
            {review.reviewed && totals.reviewedSigns === totals.signs
              ? "Everyday Kenyan Sign Language for school and home. Every sign is recorded by a Deaf signer and checked by a Deaf KSL reviewer."
              : "Everyday Kenyan Sign Language for school and home. Signs marked as sample clips are placeholders until a Deaf KSL reviewer approves a real recording."}
          </p>
          {course.status === "ready" && (
            <div className="mt-3.5 flex flex-wrap gap-x-5 gap-y-2 text-label text-on-forest-muted">
              <span className="inline-flex items-center gap-1.5">
                <Icon name={review.reviewed ? "shield" : "alert"} size={16} />
                {review.text}
              </span>
              <span>Beginner</span>
              <span>
                {modules.length} module{modules.length === 1 ? "" : "s"} · {totals.signs} signs
              </span>
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            {resume ? (
              <ButtonLink to={`/lesson/${resume.lesson.id}`} variant="primary" size="lg" icon="play">
                {resume.started ? "Resume" : "Start"}: {resume.lesson.title}
              </ButtonLink>
            ) : (
              course.status === "ready" &&
              totals.lessons > 0 && (
                <ButtonLink to="/progress" variant="primary" size="lg" icon="circle-check">
                  All lessons done: see your progress
                </ButtonLink>
              )
            )}
            {unsaved > 0 && (
              <ButtonLink to="/downloads" variant="on-forest" size="lg" icon="download">
                Download {totals.savedModules > 0 ? "remaining modules" : "modules for offline"}
              </ButtonLink>
            )}
          </div>
        </div>

        <div className="rounded-card bg-white p-5 text-ink">
          <p className="eyebrow">Your progress</p>
          <p className="mt-1.5 text-h3">{viewedLabel}</p>
          <ProgressBar value={totals.signsViewed} max={totals.signs} label={viewedLabel} className="mt-2.5" />
          <dl className="mt-3.5 grid grid-cols-[1fr_auto] gap-2 text-nav">
            <dt className="text-muted">Modules completed</dt>
            <dd className="font-semibold">
              {totals.modulesDone} of {modules.length}
            </dd>
            <dt className="text-muted">Lesson checks passed</dt>
            <dd className="font-semibold">
              {totals.checksPassed} of {course.lessons.filter(mayHaveLessonCheck).length}
            </dd>
            <dt className="text-muted">Saved on this device</dt>
            <dd className="font-semibold">
              {totals.savedModules} module{totals.savedModules === 1 ? "" : "s"}
              {totals.savedModules > 0 ? ` · ${formatSize(totals.savedKb)}` : ""}
            </dd>
            <dt className="text-muted">Waiting to sync</dt>
            <dd className="font-semibold">{pendingSync}</dd>
          </dl>
        </div>
      </div>
    </section>
  );
}

/* ---------- Tabs ---------- */

function CourseTabs({ tab }: { tab: "modules" | "overview" }) {
  const base = "inline-flex min-h-[52px] items-center border-b-[3px] text-nav text-ink no-underline";
  const on = "border-terra font-semibold";
  const off = "border-transparent font-normal";
  return (
    <div className="border-b border-line bg-white">
      <nav aria-label="Course sections" className="wrap flex gap-7 overflow-x-auto">
        <Link to="/" aria-current={tab === "modules" ? "page" : undefined} className={`${base} ${tab === "modules" ? on : off}`}>
          Modules
        </Link>
        <Link
          to="/#overview"
          aria-current={tab === "overview" ? "page" : undefined}
          className={`${base} ${tab === "overview" ? on : off}`}
        >
          Overview
        </Link>
        <Link to="/progress" className={`${base} ${off}`}>
          Progress
        </Link>
        <Link to="/faq" className={`${base} ${off}`}>
          FAQ
        </Link>
      </nav>
    </div>
  );
}

/* ---------- Module list ---------- */

function moduleStatus(m: CourseModule): { text: string; done: boolean } {
  if (m.completed) return { text: "Completed", done: true };
  if (m.lessons.length > 1 && m.lessonsDone > 0) {
    return { text: `${m.lessonsDone} of ${m.lessons.length} lessons done`, done: false };
  }
  if (m.started) return { text: `${m.signsViewed} of ${m.signCount} signs viewed`, done: false };
  return { text: "Not started", done: false };
}

function ItemRow({
  to,
  icon,
  iconClass,
  title,
  kind,
  detail,
  resume,
}: {
  to: string;
  icon: "circle-check" | "circle" | "play";
  iconClass: string;
  title: string;
  kind: string;
  detail: string;
  resume?: boolean;
}) {
  return (
    <li>
      <Link
        to={to}
        className={`grid min-h-11 grid-cols-[22px_1fr] items-center gap-x-3 rounded-ctl px-3 py-1.5 text-nav text-ink no-underline hover:bg-cream sm:grid-cols-[22px_1fr_110px_auto] ${
          resume ? "border border-terra font-semibold" : "border border-transparent"
        }`}
      >
        <Icon name={icon} size={20} className={iconClass} />
        <span>
          {title}
          {resume && <span className="text-cap font-semibold text-terra-ink"> · Resume here</span>}
        </span>
        <span className="col-start-2 text-label font-normal text-muted sm:col-start-auto">{kind}</span>
        <span className="col-start-2 text-label font-normal text-muted sm:col-start-auto sm:text-right">{detail}</span>
      </Link>
    </li>
  );
}

function ModuleRow({
  module,
  course,
  open,
  onToggle,
}: {
  module: CourseModule;
  course: Course;
  open: boolean;
  onToggle: () => void;
}) {
  const status = moduleStatus(module);
  const panelId = `module-${module.number}-items`;
  const resumeId = course.resume?.lesson.id;

  return (
    <li className="border-t border-line">
      <div
        className={`grid grid-cols-[44px_1fr_24px] items-center gap-x-4 gap-y-2 px-4 py-4 md:grid-cols-[44px_1fr_170px_190px_24px] md:px-6 ${
          open ? "bg-sage" : ""
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-flex size-9 items-center justify-center rounded-ctl border font-semibold ${
            module.started || module.completed
              ? "border-transparent bg-forest text-white"
              : "border-line bg-cream text-muted"
          }`}
        >
          {module.number}
        </span>
        <h3 className="m-0">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={onToggle}
            className="block min-h-11 w-full cursor-pointer text-left"
          >
            <span className="block text-cap font-normal text-muted">
              Module {module.number} · {module.signCount} signs
            </span>
            <span className="block text-h3">{module.title}</span>
          </button>
        </h3>
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={onToggle}
          className="inline-flex size-9 cursor-pointer items-center justify-center text-forest md:order-last"
        >
          <Icon name={open ? "minus" : "plus"} />
        </button>
        <span
          className={`col-span-3 inline-flex items-center gap-1.5 text-label font-semibold md:col-span-1 ${
            status.done ? "text-ok" : status.text === "Not started" ? "font-normal text-muted" : "text-ink"
          }`}
        >
          {status.done && <Icon name="check" size={16} />}
          {status.text}
        </span>
        <div className="col-span-3 md:col-span-1">
          <OfflineControl module={module} />
        </div>
      </div>

      {open && (
        <ol id={panelId} className="flex flex-col gap-0.5 bg-white px-4 pt-1.5 pb-4 md:pr-6 md:pl-[84px]">
          {module.lessons.map((lesson: Lesson) => {
            const p = course.progress.get(lesson.id);
            const done = !!p?.completed;
            const viewed = Math.min(p?.completed_cards ?? 0, lesson.card_count);
            const isResume = lesson.id === resumeId;
            const quiz = course.quiz.get(lesson.id);
            return (
              <li key={lesson.id}>
                <ol className="flex flex-col gap-0.5">
                  <ItemRow
                    to={`/lesson/${lesson.id}`}
                    icon={done ? "circle-check" : isResume ? "play" : "circle"}
                    iconClass={done ? "text-ok" : isResume ? "text-terra-ink" : "text-muted"}
                    title={lesson.title}
                    kind="Sign videos"
                    detail={
                      done
                        ? `${lesson.card_count} signs · done`
                        : viewed > 0
                          ? `${viewed} of ${lesson.card_count} viewed`
                          : `${lesson.card_count} signs`
                    }
                    resume={isResume}
                  />
                  {mayHaveLessonCheck(lesson) && (
                    <ItemRow
                      to={`/lesson/${lesson.id}/check`}
                      icon={quiz?.passed ? "circle-check" : "circle"}
                      iconClass={quiz?.passed ? "text-ok" : "text-muted"}
                      title={`Lesson check: ${lesson.title}`}
                      kind="Quiz"
                      detail={quizStatusText(quiz)}
                    />
                  )}
                </ol>
              </li>
            );
          })}
        </ol>
      )}
    </li>
  );
}

function ModuleList({ course }: { course: Course }) {
  const resumeModule = course.modules.find((m) => m.lessons.some((l) => l.id === course.resume?.lesson.id));
  const [openKeys, setOpenKeys] = useState<Set<string> | null>(null);
  // Until the learner touches anything, the module to resume is open.
  const open = openKeys ?? new Set(resumeModule ? [resumeModule.key] : course.modules.slice(0, 1).map((m) => m.key));
  const allOpen = course.modules.length > 0 && course.modules.every((m) => open.has(m.key));

  function toggle(key: string) {
    const next = new Set(open);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOpenKeys(next);
  }

  return (
    <Card as="section" aria-labelledby="modules-heading" className="overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-5 md:px-6">
        <h2 id="modules-heading" className="text-h2">
          {course.modules.length === 1
            ? "There is 1 module in this course"
            : `There are ${course.modules.length} modules in this course`}
        </h2>
        <button
          type="button"
          className="min-h-11 cursor-pointer text-label font-semibold text-terra-ink underline"
          onClick={() => setOpenKeys(allOpen ? new Set() : new Set(course.modules.map((m) => m.key)))}
        >
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>
      <ol>
        {course.modules.map((m) => (
          <ModuleRow key={m.key} module={m} course={course} open={open.has(m.key)} onToggle={() => toggle(m.key)} />
        ))}
      </ol>
    </Card>
  );
}

/* ---------- Side cards ---------- */

function WhatYouLearn() {
  return (
    <Card as="section" aria-labelledby="learn-heading" className="px-4 py-5 md:px-6">
      <h2 id="learn-heading" className="mb-3 text-h2">
        What you'll learn
      </h2>
      <ul className="grid gap-x-7 gap-y-2.5 text-body sm:grid-cols-2">
        {WHAT_YOU_LEARN.map((item) => (
          <li key={item} className="flex gap-2.5">
            <Icon name="check" className="mt-[3px] text-forest" />
            {item}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function HowToStudy() {
  return (
    <section className="rounded-card bg-sage p-[18px]" aria-labelledby="study-heading">
      <h2 id="study-heading" className="text-h3 text-forest">
        How to study
      </h2>
      <ol className="mt-2 flex list-decimal flex-col gap-1 pl-[18px] text-label text-ink">
        <li>Watch the sign at 1×.</li>
        <li>Watch again at 0.5×.</li>
        <li>Copy it with your own hands.</li>
        <li>Take the lesson check, then try again tomorrow.</li>
      </ol>
    </section>
  );
}

function OfflineCard({ course }: { course: Course }) {
  const { savedModules } = course.totals;
  const total = course.modules.length;
  return (
    <Card as="section" aria-labelledby="offline-heading" className="p-[18px]">
      <h2 id="offline-heading" className="text-h3">
        Offline
      </h2>
      <p className="mt-1.5 text-label text-muted">
        {savedModules === 0
          ? "No modules are saved yet. Download them while you are connected to use them without internet."
          : savedModules === total
            ? "All modules are saved on this device."
            : `${savedModules} of ${total} modules are saved. Download the rest before you lose your connection.`}
      </p>
      {course.storage && (
        <p className="mt-1 text-cap text-muted">Saved lessons use {formatSize(course.storage.usedKb)} on this device.</p>
      )}
      <div className="mt-2 flex flex-col">
        <Link to="/downloads" className="inline-flex min-h-9 items-center text-nav font-semibold">
          Manage downloads
        </Link>
        <Link to="/faq#offline" className="inline-flex min-h-9 items-center text-nav font-semibold">
          How offline use works
        </Link>
      </div>
    </Card>
  );
}

function WhoMadeCard({ course }: { course: Course }) {
  const allReviewed = course.totals.signs > 0 && course.totals.reviewedSigns === course.totals.signs;
  return (
    <Card as="section" aria-labelledby="who-heading" className="p-[18px]">
      <h2 id="who-heading" className="text-h3">
        Who makes these lessons
      </h2>
      <p className="mt-1.5 text-label text-muted">
        {allReviewed
          ? "Signs are recorded by a Deaf signer and approved by a separate Deaf KSL reviewer."
          : "Signs will be recorded by a Deaf signer and approved by a separate Deaf KSL reviewer. Until then, sample clips are clearly labelled."}
      </p>
      <Link to="/faq#signers" className="mt-1 inline-flex min-h-9 items-center text-nav font-semibold">
        Read more in the FAQ
      </Link>
    </Card>
  );
}

/* ---------- Page ---------- */

export default function CourseHome({ course }: { course: Course }) {
  const hash = useHash();
  const tab = hash === "#overview" ? "overview" : "modules";

  return (
    <>
      <CourseTabs tab={tab} />
      <div className="wrap grid w-full items-start gap-7 py-7 md:pb-12 lg:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col gap-5">
          {course.status === "loading" && (
            <Card className="p-6">
              <Skeleton label="Loading modules" lines={3} />
            </Card>
          )}
          {course.status === "error" && (
            <ErrorMessage title="We couldn't load your lessons" onRetry={course.reload}>
              {course.error}
            </ErrorMessage>
          )}
          {course.status === "ready" && course.fromCache && (
            <p className="text-label text-muted">Showing the lessons saved on this device.</p>
          )}
          {course.status === "ready" && tab === "modules" && <ModuleList course={course} />}
          {course.status === "ready" && tab === "overview" && (
            <>
              <WhatYouLearn />
              <Card as="section" aria-labelledby="about-heading" className="px-4 py-5 md:px-6">
                <h2 id="about-heading" className="mb-2 text-h2">
                  About this course
                </h2>
                <p className="text-body">
                  {COURSE_NAME} teaches everyday Kenyan Sign Language through short sign videos. Each lesson is a
                  set of signs to watch, replay and slow down, followed by a lesson check. You can download any
                  module and use it with no internet.
                </p>
              </Card>
            </>
          )}
          {course.status === "ready" && tab === "modules" && <WhatYouLearn />}
        </div>
        <aside className="flex flex-col gap-4">
          <HowToStudy />
          <OfflineCard course={course} />
          <WhoMadeCard course={course} />
        </aside>
      </div>
    </>
  );
}
