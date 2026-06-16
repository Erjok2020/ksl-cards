import { useEffect, useState } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CardViewer from "./pages/CardViewer";
import type { LessonCard, PendingProgressItem, User } from "./types";

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem("user");
    const savedToken = localStorage.getItem("token");

    if (!savedUser || !savedToken) {
      return null;
    }

    return JSON.parse(savedUser) as User;
  });
  const [selectedLesson, setSelectedLesson] = useState<LessonCard | null>(null);
  const [isNewUser, setIsNewUser] = useState<boolean>(false);

  useEffect(() => {
    async function syncPendingProgress() {
      const token = localStorage.getItem("token");
      const pending = JSON.parse(
        localStorage.getItem("pending_progress") || "[]",
      ) as PendingProgressItem[];

      if (!token || pending.length === 0) {
        return;
      }

      const remaining: PendingProgressItem[] = [];

      for (const item of pending) {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL}/api/progress/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Token ${token}`,
            },
            body: JSON.stringify({
              lesson_id: item.lesson_id,
              completion: item.completion,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to sync pending progress");
          }
        } catch {
          remaining.push(item);
        }
      }

      localStorage.setItem("pending_progress", JSON.stringify(remaining));
    }

    function handleOnline() {
      void syncPendingProgress();
    }

    void syncPendingProgress();
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  function handleLogin(userData: User, newUser: boolean) {
    setUser(userData);
    setIsNewUser(newUser);
    localStorage.setItem("user", JSON.stringify(userData));
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setSelectedLesson(null);
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (selectedLesson) {
    return (
      <CardViewer
        lesson={selectedLesson}
        onBack={() => setSelectedLesson(null)}
      />
    );
  }

  return (
    <Dashboard
      user={user}
      isNewUser={isNewUser}
      onSelectLesson={setSelectedLesson}
      onLogout={handleLogout}
    />
  );
}
