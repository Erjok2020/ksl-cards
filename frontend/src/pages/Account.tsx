import { useState } from "react";
import type { FormEvent } from "react";
import { saveSession, sendJSON } from "../lib/api";
import type { AuthResponse, User } from "../types";

interface AccountProps {
  user: User;
  /** True after an administrator reset: the user must choose a new password. */
  forced: boolean;
  onChanged: (user: User) => void;
}

export default function Account({ user, forced, onChanged }: AccountProps) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setDone(false);
    if (next !== confirm) {
      setError("The two new passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const data = await sendJSON<AuthResponse>("/api/password/change/", "POST", {
        current_password: current,
        new_password: next,
      });
      if (!data.access || !data.refresh || !data.user) throw new Error("Something went wrong.");
      saveSession(data.access, data.refresh, data.user);
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
      onChanged(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change the password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <h1 className="text-h1">{forced ? "Choose a new password" : "Account"}</h1>

      {forced ? (
        <p className="rounded-xl bg-warn-soft px-3 py-2 text-warn-ink">
          An administrator reset your password. Enter the temporary password you were given, then choose your own
          before you continue.
        </p>
      ) : (
        <p className="text-muted">
          Signed in as <strong className="text-ink">{user.username}</strong>. Forgot your password? Ask an
          administrator to reset it for you.
        </p>
      )}

      <form className="panel space-y-4 p-5" onSubmit={handleSubmit}>
        {!forced && <h2 className="text-h3">Change password</h2>}
        <div>
          <label className="label" htmlFor="current_password">
            {forced ? "Temporary password" : "Current password"}
          </label>
          <input
            id="current_password"
            type="password"
            className="field"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="new_password">
            New password
          </label>
          <input
            id="new_password"
            type="password"
            className="field"
            autoComplete="new-password"
            minLength={6}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            aria-describedby="new-pw-help"
          />
          <p id="new-pw-help" className="mt-1 text-sm text-muted">
            At least 6 characters.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="confirm_password">
            New password again
          </label>
          <input
            id="confirm_password"
            type="password"
            className="field"
            autoComplete="new-password"
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-accent-soft px-3 py-2 text-sm font-semibold text-accent-strong">
            {error}
          </p>
        )}
        {done && (
          <p role="status" className="rounded-xl bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-strong">
            Password changed.
          </p>
        )}

        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Saving…" : "Change password"}
        </button>
      </form>
    </div>
  );
}
