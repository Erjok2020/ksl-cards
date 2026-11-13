import { ButtonLink } from "../components/ui/Button";
import Link from "../components/ui/Link";
import { Card, Chip, EmptyState, ErrorMessage, ProgressBar, Skeleton } from "../components/ui/primitives";
import { PASS_RATIO } from "../lib/quiz";
import { mayHaveLessonCheck, type Course } from "../lib/useCourse";
import { usePageMeta } from "../lib/usePageMeta";

export default function Progress({ course, pendingSync }: { course: Course; pendingSync: number }) {
  usePageMeta(
    "My Progress",
    "See which Kenyan Sign Language lessons you have completed, how many signs you have viewed and your lesson check scores.",
  );
  const { totals, lessons } = course;
  const withCheck = lessons.filter(mayHaveLessonCheck);
  const passPercent = Math.round(PASS_RATIO * 100);

  if (course.status === "loading") return <Skeleton label="Loading progress" lines={4} />;
  if (course.status === "error") {
    return (
      <ErrorMessage title="We couldn't load your progress" onRetry={course.reload}>
        {course.error}
      </ErrorMessage>
    );
  }

  const stats: [string, string][] = [
    ["Signs viewed", `${totals.signsViewed} of ${totals.signs}`],
    ["Lessons completed", `${totals.lessonsDone} of ${totals.lessons}`],
    ["Lesson checks passed", `${totals.checksPassed} of ${withCheck.length}`],
    ["Waiting to sync", String(pendingSync)],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h1">My Progress</h1>
        <p className="mt-2 text-body text-muted">
          These numbers come from your account and from this device. Only you and the project administrator can
          see them. <Link to="/privacy">Privacy policy</Link>
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([label, value]) => (
          <Card key={label} className="p-4">
            <dt className="text-label text-muted">{label}</dt>
            <dd className="mt-1 text-h2">{value}</dd>
          </Card>
        ))}
      </dl>

      {lessons.length === 0 ? (
        <EmptyState
          title="No lessons yet"
          action={
            <ButtonLink to="/" variant="secondary" size="sm">
              Go to Lessons
            </ButtonLink>
          }
        >
          Lessons appear here once they are available.
        </EmptyState>
      ) : (
        <Card as="section" aria-labelledby="by-lesson" className="overflow-hidden">
          <h2 id="by-lesson" className="px-5 py-4 text-h2">
            By lesson
          </h2>
          <ul>
            {course.modules.flatMap((m) =>
              m.lessons.map((lesson) => {
                const p = course.progress.get(lesson.id);
                const viewed = Math.min(p?.completed_cards ?? 0, lesson.card_count);
                const quiz = course.quiz.get(lesson.id);
                const viewedLabel = `${viewed} of ${lesson.card_count} signs viewed`;
                return (
                  <li key={lesson.id} className="grid gap-x-6 gap-y-3 border-t border-line px-5 py-4 md:grid-cols-2">
                    <div>
                      <p className="text-cap text-muted">Module {m.number}</p>
                      <p className="text-h3">
                        <Link to={`/lesson/${lesson.id}`} className="text-ink">
                          {lesson.title}
                        </Link>
                      </p>
                      <ProgressBar value={viewed} max={lesson.card_count} label={viewedLabel} className="mt-2" />
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-label text-ink">
                        {viewedLabel}
                        {p?.completed ? (
                          <Chip tone="ok" icon="check">
                            Completed
                          </Chip>
                        ) : viewed === 0 ? (
                          <Chip tone="muted">Not started</Chip>
                        ) : null}
                        {p?.pending && <Chip icon="saved">Saved on this device</Chip>}
                      </p>
                    </div>
                    {mayHaveLessonCheck(lesson) && (
                      <div>
                        <p className="text-label font-semibold">Lesson check</p>
                        {quiz ? (
                          <>
                            <p className="mt-1 text-body">
                              Best {quiz.best.score} of {quiz.best.total} · latest {quiz.last.score} of{" "}
                              {quiz.last.total}
                            </p>
                            <p className="mt-1 flex flex-wrap items-center gap-2 text-label text-muted">
                              {quiz.attempts} attempt{quiz.attempts === 1 ? "" : "s"}
                              {quiz.passed ? (
                                <Chip tone="ok" icon="check">
                                  Passed
                                </Chip>
                              ) : (
                                <Chip tone="muted">Not passed yet</Chip>
                              )}
                              {quiz.pending && <Chip icon="saved">Saved on this device</Chip>}
                            </p>
                          </>
                        ) : (
                          <p className="mt-1 text-body text-muted">Not taken</p>
                        )}
                        <Link
                          to={`/lesson/${lesson.id}/check`}
                          className="mt-1 inline-flex min-h-9 items-center text-label font-semibold"
                        >
                          {quiz ? "Try the lesson check again" : "Take the lesson check"}
                        </Link>
                      </div>
                    )}
                  </li>
                );
              }),
            )}
          </ul>
        </Card>
      )}

      <Card as="section" aria-labelledby="how-counted" className="p-5">
        <h2 id="how-counted" className="text-h3">
          How these numbers are counted
        </h2>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-label text-ink">
          <li>A sign counts as viewed when you move on to the next sign in its lesson.</li>
          <li>A lesson is completed when you have gone through all of its signs.</li>
          <li>
            A lesson check is passed when you get at least {passPercent}% right in one attempt. “Best” is your
            highest score and “latest” is your most recent one.
          </li>
          <li>Progress made offline is kept on this device and sent when you are back online. Nothing is counted twice.</li>
        </ul>
        <Link to="/faq#lesson-check" className="mt-2 inline-flex min-h-9 items-center text-label font-semibold">
          How does the lesson check work?
        </Link>
      </Card>
    </div>
  );
}
