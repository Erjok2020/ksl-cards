import { useCallback, useEffect, useState } from "react";
import type { Card, CardViewerProps, PendingProgressItem } from "../types";

const PLACEHOLDER: Card[] = [
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

export default function CardViewer({ lesson, onBack }: CardViewerProps) {
  const [cards, setCards] = useState<Card[]>(PLACEHOLDER);
  const [current, setCurrent] = useState<number>(0);
  const [flipped, setFlipped] = useState<boolean>(false);
  const [completed, setCompleted] = useState<boolean>(false);
  const cacheKey = `cached_cards_${lesson.id}`;

  const fetchCards = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `http://127.0.0.1:8000/api/lessons/${lesson.id}/cards/`,
        {
          headers: { Authorization: `Token ${token}` },
        },
      );
      if (!res.ok) throw new Error("Failed to load cards");
      const data = (await res.json()) as Card[];
      setCards(data);
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setCards(JSON.parse(cached) as Card[]);
      }
    }
  }, [cacheKey, lesson.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadCards() {
      await fetchCards();
      if (cancelled) return;
      setCurrent(0);
      setFlipped(false);
      setCompleted(false);
    }

    void loadCards();

    return () => {
      cancelled = true;
    };
  }, [fetchCards]);

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
        ) as PendingProgressItem[];
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

  if (cards.length === 0) {
    return (
      <div className="viewer-empty-state">
        No cards available for this lesson.
      </div>
    );
  }

  const progress = Math.round(((current + 1) / cards.length) * 100);
  const card = cards[current];

  if (completed) {
    return (
      <div className="completion-shell">
        <div className="completion-card">
          <div className="completion-mark">✓</div>
          <h2 className="completion-title">Nice work</h2>
          <p className="completion-copy">
            You made it through all {cards.length} signs in{" "}
            <strong>{lesson.title}</strong>.
          </p>
          <button className="primary-button" onClick={onBack}>
            Back to lessons
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="viewer-shell">
      <header className="viewer-header">
        <button className="viewer-back" onClick={onBack}>
          Back to dashboard
        </button>
        <span className="viewer-lesson-title">{lesson.title}</span>
        <span className="viewer-progress-text">
          {current + 1} / {cards.length}
        </span>
      </header>

      <progress
        className="viewer-progress"
        value={progress}
        max={100}
        aria-label="Lesson progress"
      />

      <main className="viewer-stage">
        <div
          className={`flashcard ${flipped ? "flashcard-flipped" : ""}`}
          onClick={() => setFlipped(!flipped)}
        >
          {!flipped ? (
            <div className="flashcard-front">
              <p className="flashcard-kicker">tap to see the sign</p>
              <h2 className="flashcard-word">{card.meaning}</h2>
            </div>
          ) : (
            <div className="flashcard-back">
              <p className="flashcard-label">HOW TO SIGN IT</p>
              <p className="flashcard-description">{card.description}</p>
            </div>
          )}
        </div>
      </main>

      <footer className="viewer-actions">
        <button
          className="secondary-button secondary-button-light"
          onClick={handlePrev}
          disabled={current === 0}
        >
          Prev
        </button>
        <button className="primary-button" onClick={handleNext}>
          {current < cards.length - 1 ? "Next" : "Finish"}
        </button>
      </footer>

      <p className="viewer-footnote">Tap the card to reveal the sign</p>
    </div>
  );
}
