import { useEffect, useState } from "react";

export default function Progress({ user, onBack }: { user: { username: string }, onBack: () => void }) {

  const [lessons, setLessons] = useState([]);
  const [progress, setProgress] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    fetch(`${import.meta.env.VITE_API_URL}/api/lessons/`, {
      headers: { Authorization: `Token ${token}` },
    })
      .then(res => res.json())
      .then(data => setLessons(data));

    fetch(`${import.meta.env.VITE_API_URL}/api/progress/me/`, {
      headers: { Authorization: `Token ${token}` },
    })
      .then(res => res.json())
      .then(data => setProgress(data));

  }, []);
   return (
    <div className="dashboard-shell">
      <header className="progress-header">
        <div>
          <p className="dashboard-greeting">Hello, {user.username}</p>
          <h2 className="dashboard-brand">Your Progress</h2>
        </div>
        <button className="secondary-button" onClick={onBack}>← Back</button>
      </header>

      <div className="progress-stats">
        <div className="progress-stat-box">
          <span className="stat-number stat-green">
            {lessons.filter((l: any) => {
              const r = progress.find((p: any) => p.lesson_id === l.id);
              return r && (r.completion === "completed" || r.completion === "1" || r.completion === 1);
            }).length}
          </span>
          <span className="stat-label">Completed</span>
        </div>
        <div className="progress-stat-box">
          <span className="stat-number stat-green">{lessons.length}</span>

          <span className="stat-label">Total lessons</span>
        </div>
      </div>

      <main className="dashboard-content">
        <h3 className="section-title">Your lessons</h3>
        {lessons.map((lesson: any) => {
          const record = progress.find((p: any) => p.lesson_id === lesson.id);
          const raw = record ? record.completion : "not_started";
          const status = (raw === "1" || raw === 1 || raw === true) ? "completed" : raw;

          return (
            <div key={lesson.id} className="progress-lesson-row">
              <div>
                <p className="lesson-title">{lesson.title}</p>
                <p className="lesson-meta">{lesson.card_count} signs · {lesson.category}</p>
              </div>
              <span className={`progress-badge progress-badge--${status}`}>
                {status === "completed" ? "Done" : status === "in_progress" ? "In progress" : "Not started"}
              </span>
            </div>
          );
        })}
      </main>
    </div>
  );


}
