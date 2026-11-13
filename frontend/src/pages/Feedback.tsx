import { useState } from "react";
import type { FormEvent } from "react";
import Button from "../components/ui/Button";
import Link from "../components/ui/Link";
import { Card, ErrorMessage, Notice, TextArea } from "../components/ui/primitives";
import { ApiError, OfflineError, sendJSON } from "../lib/api";
import { useOnline } from "../lib/hooks";
import { navigate } from "../lib/router";
import { usePageMeta } from "../lib/usePageMeta";
import type { User } from "../types";

const MAX = 2000;
const DRAFT_KEY = "ksl_feedback_draft";
const RATINGS = [
  { value: 1, label: "Very hard to use" },
  { value: 2, label: "Hard to use" },
  { value: 3, label: "OK" },
  { value: 4, label: "Easy to use" },
  { value: 5, label: "Very easy to use" },
];

function readDraft(): string {
  try {
    return sessionStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Only in-app paths are accepted, so the form can't be used to redirect. */
function safePage(): string {
  const page = new URLSearchParams(window.location.search).get("page") ?? "";
  return page.startsWith("/") && !page.startsWith("//") ? page.slice(0, 200) : "";
}

export default function Feedback({ user }: { user: User | null }) {
  usePageMeta(
    "Send feedback",
    "Tell the KSL Cards team what works and what doesn't. Feedback is anonymous unless you choose to add your username.",
  );
  const online = useOnline();
  const [page] = useState(safePage);
  const [message, setMessage] = useState(readDraft);
  const [rating, setRating] = useState<number | null>(null);
  const [includeUsername, setIncludeUsername] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [busy, setBusy] = useState(false);

  function updateMessage(value: string) {
    setMessage(value);
    setFieldError("");
    try {
      sessionStorage.setItem(DRAFT_KEY, value);
    } catch {
      // Private mode: the draft just isn't kept.
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!message.trim()) {
      setFieldError("Write a few words about what happened.");
      return;
    }
    setBusy(true);
    try {
      await sendJSON("/api/feedback/", "POST", {
        message: message.trim(),
        rating,
        page,
        include_username: includeUsername,
      });
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        // nothing to clear
      }
      navigate(`/thank-you${page ? `?from=${encodeURIComponent(page)}` : ""}`);
    } catch (err) {
      setError(
        err instanceof OfflineError
          ? "You're offline, so this can't be sent right now. Your message is kept on this page. Send it when you are connected."
          : err instanceof ApiError && err.status === 429
            ? "You've sent several messages in a short time. Please try again in an hour."
            : err instanceof Error
              ? err.message
              : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-5">
      <div>
        <h1 className="text-h1">Send feedback</h1>
        <p className="mt-2 text-body text-muted">
          Tell us what works, what doesn't, or what is wrong with a sign video. No personal details are needed.
        </p>
      </div>

      {!online && (
        <Notice>
          You're offline. Feedback needs a connection to send. You can write it now; it stays on this page until you
          are connected.
        </Notice>
      )}

      <Card as="form" className="flex flex-col gap-5 p-5" onSubmit={handleSubmit} noValidate>
        {page && (
          <p className="text-label text-muted">
            About: <span className="font-semibold text-ink">{page}</span>
          </p>
        )}

        <TextArea
          label="Your message"
          rows={6}
          maxLength={MAX}
          value={message}
          onChange={(e) => updateMessage(e.target.value)}
          error={fieldError}
          hint={`${message.length} of ${MAX} characters. Please don't include names or contact details.`}
          required
        />

        <fieldset>
          <legend className="text-label font-semibold">How easy is KSL Cards to use? (optional)</legend>
          <div className="mt-2 flex flex-col gap-0.5">
            {RATINGS.map((r) => (
              <label key={r.value} className="flex min-h-11 cursor-pointer items-center gap-3 text-body">
                <input
                  type="radio"
                  name="rating"
                  className="size-5 accent-forest"
                  checked={rating === r.value}
                  onChange={() => setRating(r.value)}
                />
                {r.value}. {r.label}
              </label>
            ))}
            {rating !== null && (
              <Button variant="ghost" size="sm" className="self-start !px-0 underline" onClick={() => setRating(null)}>
                Clear rating
              </Button>
            )}
          </div>
        </fieldset>

        {user ? (
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-body">
            <input
              type="checkbox"
              className="mt-1 size-5 accent-forest"
              checked={includeUsername}
              onChange={(e) => setIncludeUsername(e.target.checked)}
            />
            <span>
              Include my username ({user.username}) so the team can follow up
              <span className="block text-label text-muted">
                Leave this unticked to send your feedback anonymously.
              </span>
            </span>
          </label>
        ) : (
          <p className="text-label text-muted">You're not signed in, so this feedback is anonymous.</p>
        )}

        {error && <ErrorMessage title="Your feedback wasn't sent">{error}</ErrorMessage>}

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" variant="primary" disabled={busy || !online}>
            {busy ? "Sending…" : "Send feedback"}
          </Button>
          <span className="text-label text-muted">
            How we use feedback: <Link to="/privacy">Privacy policy</Link>
          </span>
        </div>
      </Card>
    </div>
  );
}
