import { useState, useEffect } from "react";

const OFFLINE_LESSONS = [
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

export default function Dashboard({ user, onSelectLesson, onLogout }) {
  const [lessons, setLessons] = useState(OFFLINE_LESSONS);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLessons();
  }, []);

  async function fetchLessons() {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/lessons/", {
        headers: { Authorization: `Token ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLessons(data);
      localStorage.setItem("cached_lessons", JSON.stringify(data));
    } catch {
      const cached = localStorage.getItem("cached_lessons");
      if (cached) setLessons(JSON.parse(cached));
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#F4F6F9",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          backgroundColor: "#0C2D48",
          color: "#fff",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "20px" }}>KSL Cards</h2>
          <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#aac8d8" }}>
            Hello, {user.username} 👋
          </p>
        </div>
        <button
          onClick={onLogout}
          style={{
            background: "rgba(255,255,255,0.15)",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            padding: "8px 14px",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          Log out
        </button>
      </div>

      {offline && (
        <div
          style={{
            backgroundColor: "#B38600",
            color: "#fff",
            textAlign: "center",
            padding: "8px",
            fontSize: "13px",
          }}
        >
          You are offline — showing saved lessons
        </div>
      )}

      <div
        style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 20px" }}
      >
        <h3 style={{ color: "#0C2D48", marginBottom: "20px" }}>
          Choose a Lesson
        </h3>

        {loading ? (
          <p style={{ color: "#888" }}>Loading lessons...</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "20px",
            }}
          >
            {lessons.map((lesson) => (
              <div
                key={lesson.id}
                onClick={() => onSelectLesson(lesson)}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: "10px",
                  padding: "20px",
                  cursor: "pointer",
                  borderTop: `4px solid ${lesson.color}`,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                  transition: "transform 0.15s ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.transform = "translateY(-4px)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.transform = "translateY(0)")
                }
              >
                <h4
                  style={{
                    margin: "0 0 6px",
                    fontSize: "15px",
                    color: "#1a1a2e",
                  }}
                >
                  {lesson.title}
                </h4>
                <p
                  style={{
                    margin: "0 0 16px",
                    fontSize: "12px",
                    color: "#888",
                  }}
                >
                  {lesson.card_count} signs · {lesson.category}
                </p>
                <span
                  style={{
                    backgroundColor: lesson.color,
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: "bold",
                    padding: "5px 12px",
                    borderRadius: "4px",
                  }}
                >
                  Start →
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
