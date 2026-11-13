import { useState } from "react";
import type { FormEvent } from "react";
import Button from "../components/ui/Button";
import { Brand, ConnectionChip } from "../components/ui/PageShell";
import Link from "../components/ui/Link";
import { Card, ErrorMessage, Notice, TextField } from "../components/ui/primitives";
import { API_URL, saveSession } from "../lib/api";
import type { AuthResponse, User } from "../types";

interface LoginProps {
  onLogin: (user: User, isNewUser: boolean) => void;
  notice?: string;
}

export default function Login({ onLogin, notice }: LoginProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/${isRegister ? "register" : "login"}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as AuthResponse;
      if (!res.ok || !data.access || !data.refresh || !data.user) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      saveSession(data.access, data.refresh, data.user);
      onLogin(data.user, isRegister);
    } catch {
      setError("Can't reach the server. Connect to the internet to sign in the first time.");
    } finally {
      setBusy(false);
    }
  }

  const tab = (reg: boolean) =>
    `min-h-11 cursor-pointer rounded-ctl text-nav ${isRegister === reg ? "bg-white font-semibold text-forest" : "text-muted"}`;

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="border-b border-line bg-white">
        <div className="wrap flex min-h-16 items-center justify-between">
          <Brand />
          <ConnectionChip />
        </div>
      </header>

      <main id="main" className="wrap flex w-full flex-1 items-start justify-center py-10">
        <Card className="w-full max-w-[440px] p-6 sm:p-8">
          <h1 className="text-h1">{isRegister ? "Create an account" : "Sign in"}</h1>
          <p className="mt-2 text-body text-muted">
            Learn Kenyan Sign Language with sign videos that also work without internet.
          </p>

          {notice && (
            <div className="mt-4">
              <Notice>{notice}</Notice>
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-1 rounded-ctl bg-sage p-1" role="tablist" aria-label="Account">
            <button type="button" role="tab" aria-selected={!isRegister} className={tab(false)} onClick={() => { setIsRegister(false); setError(""); }}>
              Sign in
            </button>
            <button type="button" role="tab" aria-selected={isRegister} className={tab(true)} onClick={() => { setIsRegister(true); setError(""); }}>
              New account
            </button>
          </div>

          <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
            <TextField
              label="Username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              hint={isRegister ? "Choose a name that doesn't show your real name." : undefined}
              required
            />
            <TextField
              label="Password"
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              minLength={isRegister ? 6 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint={isRegister ? "At least 6 characters." : undefined}
              required
            />

            {error && <ErrorMessage title={isRegister ? "Account not created" : "Couldn't sign in"}>{error}</ErrorMessage>}

            <Button type="submit" variant="brand" full disabled={busy}>
              {busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="mt-5 text-label text-muted">
            Forgot your password? Ask the site administrator to reset it.{" "}
            <Link to="/faq#password">Help</Link> · <Link to="/privacy">Privacy policy</Link>
          </p>
        </Card>
      </main>
    </div>
  );
}
