import { quizStatusText } from "../../lib/quiz";
import { mayHaveLessonCheck, type Course, type CourseModule } from "../../lib/useCourse";
import Icon from "../ui/Icon";
import Link from "../ui/Link";
import { ProgressBar } from "../ui/primitives";

/* ---------- Side panel: the module's items ---------- */

export default function ModulePanel({
  module,
  course,
  currentLessonId,
  currentKind,
}: {
  module: CourseModule;
  course: Course;
  currentLessonId: number;
  currentKind: "signs" | "check";
}) {
  const items = module.lessons.flatMap((l) => (mayHaveLessonCheck(l) ? [l, l] : [l])).length;
  const done =
    module.lessonsDone + module.lessons.filter((l) => mayHaveLessonCheck(l) && course.quiz.get(l.id)?.passed).length;
  const label = `${done} of ${items} items done`;

  const row = (current: boolean) =>
    `grid grid-cols-[22px_1fr] gap-2.5 rounded-ctl px-3 py-2.5 text-ink no-underline ${
      current ? "border-l-[3px] border-terra bg-white font-semibold" : "border-l-[3px] border-transparent"
    }`;

  return (
    <nav aria-label={`Module ${module.number} items`} className="border-b border-sage-line bg-sage px-3.5 py-4 md:border-r md:border-b-0 md:py-5">
      <Link to="/" className="inline-flex min-h-9 items-center gap-1 px-1.5 text-label font-semibold text-forest">
        <Icon name="chevron-left" size={16} />
        All modules
      </Link>
      <div className="px-3 pt-2 pb-3">
        <p className="text-cap text-muted">Module {module.number}</p>
        <p className="text-h3">{module.title}</p>
        <ProgressBar value={done} max={items} label={label} trackClassName="bg-sage-line" className="mt-2.5" />
        <p className="mt-1 text-cap text-ink">{label}</p>
      </div>
      <ol className="flex flex-col gap-0.5">
        {module.lessons.map((l) => {
          const lessonDone = !!course.progress.get(l.id)?.completed;
          const quiz = course.quiz.get(l.id);
          const onSigns = l.id === currentLessonId && currentKind === "signs";
          const onCheck = l.id === currentLessonId && currentKind === "check";
          return (
            <li key={l.id}>
              <ol className="flex flex-col gap-0.5">
                <li>
                  <Link to={`/lesson/${l.id}`} aria-current={onSigns ? "page" : undefined} className={row(onSigns)}>
                    <Icon
                      name={lessonDone ? "circle-check" : onSigns ? "play" : "circle"}
                      size={20}
                      className={lessonDone ? "text-ok" : onSigns ? "text-terra-ink" : "text-muted"}
                    />
                    <span className="text-nav">
                      {l.title}
                      <span className="block text-cap font-normal text-muted">
                        Sign videos · {l.card_count} signs{lessonDone ? " · done" : ""}
                      </span>
                    </span>
                  </Link>
                </li>
                {mayHaveLessonCheck(l) && (
                  <li>
                    <Link to={`/lesson/${l.id}/check`} aria-current={onCheck ? "page" : undefined} className={row(onCheck)}>
                      <Icon
                        name={quiz?.passed ? "circle-check" : "circle"}
                        size={20}
                        className={quiz?.passed ? "text-ok" : "text-muted"}
                      />
                      <span className="text-nav">
                        Lesson check
                        <span className="block text-cap font-normal text-muted">Quiz · {quizStatusText(quiz)}</span>
                      </span>
                    </Link>
                  </li>
                )}
              </ol>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
