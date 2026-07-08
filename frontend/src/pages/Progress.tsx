import { useEffect, useState } from "react";

export default function Progress() {
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
  <div>
    <h2>My Progress</h2>
    {lessons.map((lesson: any) => {
      const record = progress.find((p: any) => p.lesson_id === lesson.id);
      const status = record ? record.completion : "not_started";

      return (
        <div key={lesson.id}>
          <p>{lesson.title} — {status}</p>
        </div>
      );
    })}
  </div>
);

}
