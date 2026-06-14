import { useEffect, useState } from "react";
import type { DashboardProps, Lesson, LessonCard } from "../types";

const OFFLINE_LESSONS: LessonCard[] = [
  {
    id: 1,
    title: "Greetings",
    category: "basics",
    card_count: 8,
    color: "#1A6B4A",
  },
  {
    id: 2,
    title: "Numbers 1-10",
    category: "numbers",
    card_count: 10,
    color: "#0C2D48",
  },
  {
    id: 3,
    title: "Family",
    category: "people",
    card_count: 6,
    color: "#C1440E",
  },
];

const LESSON_COLORS = ["#1A6B4A", "#0C2D48", "#C1440E", "#6B4A1A"];

const LESSON_ACCENT_CLASSES = [
  "lesson-accent-teal",
  "lesson-accent-navy",
  "lesson-accent-rust",
  "lesson-accent-gold",
];

function applyLessonColors(lessons: Lesson[]): LessonCard[] {
  return lessons.map((lesson, index) => ({
    ...lesson,
    color: lesson.color ?? LESSON_COLORS[index % LESSON_COLORS.length],
  }));
}

export default function Dashboard({
  user,
  onSelectLesson,
  onLogout,
}: DashboardProps) {
  const [lessons, setLessons] = useState<LessonCard[]>(OFFLINE_LESSONS);
  const [offline, setOffline] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isActive = true;

    async function loadLessons() {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/lessons/`, {
          headers: { Authorization: `Token ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load lessons");
        const data = (await res.json()) as Lesson[];
        if (!isActive) return;
        const lessonsWithColors = applyLessonColors(data);
        setLessons(lessonsWithColors);
        setOffline(false);
        localStorage.setItem(
          "cached_lessons",
          JSON.stringify(lessonsWithColors),
        );
      } catch {
        if (!isActive) return;
        const cached = localStorage.getItem("cached_lessons");
        if (cached) {
          setLessons(JSON.parse(cached) as LessonCard[]);
        }
        setOffline(true);
      } finally {
        if (isActive) setLoading(false);
      }
    }

    void loadLessons();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <h2 className="dashboard-brand">KSL Cards</h2>
          <p className="dashboard-greeting">
            Good to see you again, {user.username}.
          </p>
        </div>
        <button className="secondary-button" onClick={onLogout}>
          Log out
        </button>
      </header>

      {offline && (
        <div className="offline-banner">
          You're offline right now, so we're showing the lessons already saved
          on this device.
        </div>
      )}

      <main className="dashboard-content">
        <h3 className="section-title">Pick your next lesson</h3>

        {loading ? (
          <p className="muted-text">Loading lessons...</p>
        ) : (
          <div className="lesson-grid">
            {lessons.map((lesson, index) => (
              <div
                className={`lesson-card ${LESSON_ACCENT_CLASSES[index % LESSON_ACCENT_CLASSES.length]}`}
                key={lesson.id}
                onClick={() => onSelectLesson(lesson)}
              >
                <h4 className="lesson-title">{lesson.title}</h4>
                <p className="lesson-meta">
                  {lesson.card_count} signs · {lesson.category}
                </p>
                <span className="lesson-pill">Open lesson</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
