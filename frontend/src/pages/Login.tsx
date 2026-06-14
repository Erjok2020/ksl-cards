import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { AuthResponse, LoginProps } from "../types";

interface LoginFormState {
  username: string;
  password: string;
}

export default function Login({ onLogin }: LoginProps) {
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [form, setForm] = useState<LoginFormState>({
    username: "",
    password: "",
  });
  const [error, setError] = useState<string>("");

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const endpoint = isRegister ? "/api/register/" : "/api/login/";

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as AuthResponse;

      if (!res.ok || !data.token || !data.user) {
        setError(data.error || "Something went wrong.");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onLogin(data.user);
    } catch {
      setError("Could not connect to server.");
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1 className="auth-title">KSL Cards</h1>
        <p className="auth-subtitle">
          A simple way to learn Kenya Sign Language, one card at a time.
        </p>

        <div className="auth-tabs">
          <button
            className={isRegister ? "auth-tab" : "auth-tab auth-tab-active"}
            onClick={() => setIsRegister(false)}
          >
            Sign in
          </button>
          <button
            className={isRegister ? "auth-tab auth-tab-active" : "auth-tab"}
            onClick={() => setIsRegister(true)}
          >
            New account
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            className="auth-input"
            type="text"
            name="username"
            placeholder="Username"
            value={form.username}
            onChange={handleChange}
            required
          />
          <input
            className="auth-input"
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
          />

          {error && <p className="auth-error">{error}</p>}

          <button className="primary-button" type="submit">
            {isRegister ? "Create account" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
