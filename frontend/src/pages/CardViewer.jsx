// KSL Cards - Flashcard viewer with flip interaction and progress saving import { useState, useEffect } from "react";

const PLACEHOLDER = [
  {
    id: 1,
    meaning: "Hello",
    description:
      "Open hand, palm facing out, raised to shoulder height and waved gently side to side.",
  },
  {
    id: 2,
    meaning: "Thank You",
    description:
      "Flat hand starts at chin, moves forward and slightly down toward the person you are thanking.",
  },
  {
    id: 3,
    meaning: "Yes",
    description: "Closed fist nodded up and down at wrist level.",
  },
  {
    id: 4,
    meaning: "No",
    description: "Index and middle fingers tapped against the thumb twice.",
  },
  {
    id: 5,
    meaning: "Please",
    description:
      "Flat hand moves in a circular motion on the chest, clockwise.",
  },
  {
    id: 6,
    meaning: "Sorry",
    description: "Closed fist rubbed in a circle over the heart.",
  },
  {
    id: 7,
    meaning: "Good",
    description:
      "Flat hand at lips moves forward and downward onto the back of the other hand.",
  },
  {
    id: 8,
    meaning: "Help",
    description: "Thumb on flat palm, both hands lifted upward together.",
  },
];

export default function CardViewer({ lesson, user, onBack }) {
  const [cards, setCards] = useState(PLACEHOLDER);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    fetchCards();
    setCurrent(0);
    setFlipped(false);
    setCompleted(false);
  }, [lesson.id]);

  async function fetchCards() {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `http://127.0.0.1:8000/api/lessons/${lesson.id}/cards/`,
        {
          headers: { Authorization: `Token ${token}` },
        },
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCards(data);
    } catch {
      // stay on placeholder cards if offline
    }
  }

  async function handleNext() {
    if (current < cards.length - 1) {
      setCurrent(current + 1);
      setFlipped(false);
    } else {
      setCompleted(true);
      try {
        const token = localStorage.getItem("token");
        await fetch("http://127.0.0.1:8000/api/progress/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Token ${token}`,
          },
          body: JSON.stringify({ lesson_id: lesson.id, completion: true }),
        });
      } catch {
        const pending = JSON.parse(
          localStorage.getItem("pending_progress") || "[]",
        );
        pending.push({
          lesson_id: lesson.id,
          completion: true,
          saved_at: Date.now(),
        });
        localStorage.setItem("pending_progress", JSON.stringify(pending));
      }
    }
  }

  function handlePrev() {
    if (current > 0) {
      setCurrent(current - 1);
      setFlipped(false);
    }
  }

  const progress = Math.round(((current + 1) / cards.length) * 100);
  const card = cards[current];

  if (completed) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F4F6F9",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: "16px",
            padding: "48px 32px",
            textAlign: "center",
            boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
            maxWidth: "380px",
          }}
        >
          <div
            style={{ fontSize: "52px", color: "#1A6B4A", marginBottom: "16px" }}
          >
            ✓
          </div>
          <h2 style={{ color: "#0C2D48", margin: "0 0 10px" }}>
            Lesson Complete!
          </h2>
          <p style={{ color: "#666", fontSize: "14px", marginBottom: "32px" }}>
            You finished all {cards.length} signs in{" "}
            <strong>{lesson.title}</strong>.
          </p>
          <button
            onClick={onBack}
            style={{
              backgroundColor: "#0C2D48",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "12px 28px",
              cursor: "pointer",
              fontSize: "15px",
            }}
          >
            Back to Lessons
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#F4F6F9",
        fontFamily: "Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          backgroundColor: "#0C2D48",
          color: "#fff",
          padding: "14px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            color: "#90CDF4",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Back
        </button>
        <span style={{ fontWeight: "bold" }}>{lesson.title}</span>
        <span style={{ color: "#aac8d8", fontSize: "13px" }}>
          {current + 1} / {cards.length}
        </span>
      </div>

      <div style={{ height: "5px", backgroundColor: "#dde3ea" }}>
        <div
          style={{
            height: "5px",
            backgroundColor: "#1A6B4A",
            width: `${progress}%`,
            transition: "width 0.3s ease",
          }}
        />
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 20px",
        }}
      >
        <div
          onClick={() => setFlipped(!flipped)}
          style={{
            width: "100%",
            maxWidth: "420px",
            minHeight: "280px",
            borderRadius: "16px",
            cursor: "pointer",
            padding: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: flipped ? "#0C2D48" : "#fff",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            transition: "background-color 0.2s ease",
          }}
        >
          {!flipped ? (
            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  color: "#aaa",
                  fontSize: "12px",
                  marginBottom: "16px",
                }}
              >
                tap to see the sign
              </p>
              <h2
                style={{
                  fontSize: "38px",
                  fontWeight: "bold",
                  color: "#0C2D48",
                  margin: 0,
                }}
              >
                {card.meaning}
              </h2>
            </div>
          ) : (
            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  color: "#90CDF4",
                  fontSize: "12px",
                  fontWeight: "bold",
                  letterSpacing: "1px",
                  marginBottom: "14px",
                }}
              >
                HOW TO SIGN IT
              </p>
              <p
                style={{
                  color: "#fff",
                  fontSize: "16px",
                  lineHeight: "1.7",
                  margin: 0,
                }}
              >
                {card.description}
              </p>
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "0 20px 16px",
          maxWidth: "460px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <button
          onClick={handlePrev}
          disabled={current === 0}
          style={{
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "10px 20px",
            cursor: "pointer",
            fontSize: "14px",
            opacity: current === 0 ? 0.3 : 1,
          }}
        >
          Prev
        </button>
        <button
          onClick={handleNext}
          style={{
            background: "#1A6B4A",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "10px 28px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "bold",
          }}
        >
          {current < cards.length - 1 ? "Next" : "Finish"}
        </button>
      </div>

      <p
        style={{
          textAlign: "center",
          color: "#bbb",
          fontSize: "12px",
          paddingBottom: "24px",
        }}
      >
        Tap the card to flip it
      </p>
    </div>
  );
}
