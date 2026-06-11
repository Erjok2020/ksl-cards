import { useState } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CardViewer from "./pages/CardViewer";

export default function App() {
  const [user, setUser] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);

  function handleLogin(userData) {
    setUser(userData);
  }

  function handleLogout() {
    localStorage.removeItem("token");
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
        user={user}
        onBack={() => setSelectedLesson(null)}
      />
    );
  }

  return (
    <Dashboard
      user={user}
      onSelectLesson={setSelectedLesson}
      onLogout={handleLogout}
    />
  );
}
