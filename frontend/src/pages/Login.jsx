import { useState } from "react";

export default function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const endpoint = isRegister ? "/api/register/" : "/api/login/";

    try {
      const res = await fetch(`http://127.0.0.1:8000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      localStorage.setItem("token", data.token);
      onLogin(data.user);
    } catch {
      setError("Could not connect to server.");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0C2D48",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "12px",
          padding: "40px 36px",
          width: "100%",
          maxWidth: "380px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        }}
      >
        <h1
          style={{
            color: "#0C2D48",
            textAlign: "center",
            margin: 0,
            fontSize: "28px",
          }}
        >
          KSL Cards
        </h1>
        <p
          style={{
            color: "#888",
            textAlign: "center",
            fontSize: "13px",
            margin: "6px 0 24px",
          }}
        >
          Learn Kenya Sign Language
        </p>

        <div
          style={{
            display: "flex",
            borderBottom: "2px solid #eee",
            marginBottom: "20px",
          }}
        >
          <button
            onClick={() => setIsRegister(false)}
            style={{
              flex: 1,
              padding: "10px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px",
              color: isRegister ? "#aaa" : "#0C2D48",
              borderBottom: isRegister ? "none" : "2px solid #0C2D48",
              marginBottom: "-2px",
            }}
          >
            Log In
          </button>
          <button
            onClick={() => setIsRegister(true)}
            style={{
              flex: 1,
              padding: "10px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px",
              color: isRegister ? "#0C2D48" : "#aaa",
              borderBottom: isRegister ? "2px solid #0C2D48" : "none",
              marginBottom: "-2px",
            }}
          >
            Register
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "14px" }}
        >
          <input
            style={{
              padding: "11px 14px",
              border: "1px solid #ddd",
              borderRadius: "8px",
              fontSize: "14px",
            }}
            type="text"
            name="username"
            placeholder="Username"
            value={form.username}
            onChange={handleChange}
            required
          />
          <input
            style={{
              padding: "11px 14px",
              border: "1px solid #ddd",
              borderRadius: "8px",
              fontSize: "14px",
            }}
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
          />

          {error && (
            <p style={{ color: "#c0392b", fontSize: "13px", margin: 0 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            style={{
              padding: "12px",
              backgroundColor: "#1A6B4A",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "15px",
              fontWeight: "bold",
              cursor: "pointer",
              marginTop: "4px",
            }}
          >
            {isRegister ? "Create Account" : "Log In"}
          </button>
        </form>
      </div>
    </div>
  );
}
