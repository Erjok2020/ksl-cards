import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { formatSize, getJSON, sendForm, sendJSON } from "../lib/api";
import type { Decision, ManagedCard, ManagedLesson, Role, User } from "../types";

/**
 * Content management (FR-06) with separate roles:
 *  - Teachers upload sign videos and create lessons.
 *  - Deaf KSL reviewers approve, request a re-recording, or reject.
 *  - Administrators manage users and roles (and can also upload).
 */
export default function Manage({ user }: { user: User }) {
  const tabs: { id: string; label: string }[] = [];
  if (user.role === "teacher" || user.role === "admin") tabs.push({ id: "upload", label: "Upload signs" });
  if (user.role === "reviewer") tabs.push({ id: "review", label: "Review queue" });
  if (user.role === "admin") tabs.push({ id: "users", label: "Users & roles" });
  const [tab, setTab] = useState(tabs[0]?.id);

  if (!tabs.length) return <p>Your account doesn't have content permissions.</p>;

  return (
    <div className="space-y-5">
      <h1 className="text-h1">
        {user.role === "reviewer" ? "Review signs" : "Manage content"}
      </h1>
      {tabs.length > 1 && (
        <div role="tablist" aria-label="Sections" className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? "btn-primary" : "btn-secondary"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {tab === "upload" && <UploadSection />}
      {tab === "review" && <ReviewSection />}
      {tab === "users" && <UsersSection me={user} />}
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-warn-soft text-warn-ink",
  approved: "bg-brand text-white",
  rejected: "bg-accent-soft text-accent-strong",
};

function StatusBadge({ card }: { card: ManagedCard }) {
  const label =
    card.review_status === "pending" && card.last_review?.decision === "revise"
      ? "Re-record requested"
      : card.review_status === "pending"
        ? "Waiting for review"
        : card.review_status === "approved"
          ? "Approved"
          : "Rejected";
  return <span className={`badge ${STATUS_STYLE[card.review_status]}`}>{label}</span>;
}

function Message({ text, error }: { text: string; error?: boolean }) {
  if (!text) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={`rounded-xl px-3 py-2 text-sm font-semibold ${error ? "bg-accent-soft text-accent-strong" : "bg-brand-soft text-brand-strong"}`}
    >
      {text}
    </p>
  );
}

// ---------------- teacher ----------------

function UploadSection() {
  const [lessons, setLessons] = useState<ManagedLesson[]>([]);
  const [cards, setCards] = useState<ManagedCard[]>([]);
  const [msg, setMsg] = useState({ text: "", error: false });
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [showLessonForm, setShowLessonForm] = useState(false);

  const [version, setVersion] = useState(0);
  const load = useCallback(async () => setVersion((v) => v + 1), []);

  useEffect(() => {
    let active = true;
    Promise.all([
      getJSON<ManagedLesson[]>("/api/manage/lessons/"),
      getJSON<ManagedCard[]>("/api/manage/cards/"),
    ])
      .then(([l, c]) => {
        if (!active) return;
        setLessons(l.data);
        setCards(c.data);
      })
      .catch((e: Error) => active && setMsg({ text: e.message, error: true }));
    return () => {
      active = false;
    };
  }, [version]);

  async function uploadCard(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg({ text: "", error: false });
    try {
      await sendForm("/api/manage/cards/", new FormData(e.currentTarget));
      formRef.current?.reset();
      setMsg({ text: "Uploaded. The sign stays hidden from learners until a Deaf KSL reviewer approves it.", error: false });
      await load();
    } catch (err) {
      setMsg({ text: (err as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  }

  async function createLesson(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      await sendJSON("/api/manage/lessons/", "POST", data);
      form.reset();
      setShowLessonForm(false);
      setMsg({ text: "Lesson created.", error: false });
      await load();
    } catch (err) {
      setMsg({ text: (err as Error).message, error: true });
    }
  }

  async function replaceVideo(card: ManagedCard, file: File) {
    if (!window.confirm(`Replace the video for “${card.english_word}”? The sign goes back to the review queue and is hidden from learners until it is approved again.`)) return;
    setMsg({ text: "", error: false });
    const form = new FormData();
    form.append("video", file);
    try {
      await sendForm(`/api/manage/cards/${card.id}/`, form, "PATCH");
      setMsg({ text: `New recording uploaded for “${card.english_word}”. It is waiting for review.`, error: false });
      await load();
    } catch (err) {
      setMsg({ text: (err as Error).message, error: true });
    }
  }

  async function deleteCard(card: ManagedCard) {
    if (!window.confirm(`Delete “${card.english_word}”? This removes the video too.`)) return;
    try {
      await sendJSON(`/api/manage/cards/${card.id}/`, "DELETE");
      await load();
    } catch (err) {
      setMsg({ text: (err as Error).message, error: true });
    }
  }

  return (
    <div className="space-y-5">
      <Message {...msg} />

      <form ref={formRef} onSubmit={uploadCard} className="panel grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="text-h2 sm:col-span-2">Upload a sign</h2>
        <div>
          <label className="label" htmlFor="lesson_id">
            Lesson
          </label>
          <select id="lesson_id" name="lesson_id" className="field" required>
            <option value="">Choose a lesson…</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.module ? `${l.module} — ` : ""}
                {l.title}
              </option>
            ))}
          </select>
          <button type="button" className="mt-1 min-h-9 cursor-pointer text-label font-semibold text-terra-ink underline" onClick={() => setShowLessonForm((s) => !s)}>
            {showLessonForm ? "Cancel new lesson" : "+ Create a new lesson"}
          </button>
        </div>
        <div>
          <label className="label" htmlFor="english_word">
            English word
          </label>
          <input id="english_word" name="english_word" className="field" required maxLength={120} />
        </div>
        <div>
          <label className="label" htmlFor="kiswahili">
            Kiswahili (optional)
          </label>
          <input id="kiswahili" name="kiswahili" className="field" maxLength={200} lang="sw" placeholder="e.g. Maji" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="context_sentence">
            Context sentence
          </label>
          <input id="context_sentence" name="context_sentence" className="field" maxLength={300} placeholder="e.g. Thank you for helping me." />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="movement_description">
            Written movement description
          </label>
          <textarea id="movement_description" name="movement_description" rows={2} className="field" placeholder="Handshape, location, movement, facial expression" />
        </div>
        <div>
          <label className="label" htmlFor="video">
            Sign video (MP4 or WebM, max 25 MB)
          </label>
          <input id="video" name="video" type="file" accept="video/mp4,video/webm" className="field" required />
        </div>
        <div>
          <label className="label" htmlFor="poster">
            Poster image (optional)
          </label>
          <input id="poster" name="poster" type="file" accept="image/jpeg,image/png,image/webp" className="field" />
        </div>
        <p className="text-sm text-muted sm:col-span-2">
          Film the upper body against a plain background with good light. Only upload recordings you have the
          signer's written consent and reuse licence for.
        </p>
        <div className="sm:col-span-2">
          <button className="btn-primary" disabled={busy}>
            {busy ? "Uploading…" : "Upload for review"}
          </button>
        </div>
      </form>

      {showLessonForm && (
        <form onSubmit={createLesson} className="panel grid gap-4 p-5 sm:grid-cols-2">
          <h2 className="text-h2 sm:col-span-2">New lesson</h2>
          <div>
            <label className="label" htmlFor="title">Title</label>
            <input id="title" name="title" className="field" required />
          </div>
          <div>
            <label className="label" htmlFor="category">Category</label>
            <input id="category" name="category" className="field" required placeholder="e.g. basics" />
          </div>
          <div>
            <label className="label" htmlFor="module">Module</label>
            <input id="module" name="module" className="field" list="module-names" placeholder="e.g. Module 1: Greetings" />
            <datalist id="module-names">
              {[...new Set(lessons.map((l) => l.module).filter(Boolean))].map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor="sort_order">Order in module</label>
            <input id="sort_order" name="sort_order" type="number" className="field" defaultValue={0} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="description">Description</label>
            <input id="description" name="description" className="field" />
          </div>
          <div className="sm:col-span-2">
            <button className="btn-primary">Create lesson</button>
          </div>
        </form>
      )}

      <section className="panel" aria-labelledby="my-uploads">
        <h2 id="my-uploads" className="border-b border-line px-5 py-3 text-h2">
          Uploaded signs
        </h2>
        {cards.length === 0 ? (
          <p className="px-5 py-4 text-muted">No uploads yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {cards.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="mr-auto">
                  <p className="font-semibold">
                    {c.english_word}
                    {c.kiswahili && <span className="font-normal text-muted" lang="sw"> · {c.kiswahili}</span>}{" "}
                    {c.is_sample && <span className="badge bg-sand text-ink">Sample</span>}
                  </p>
                  <p className="text-sm text-muted">
                    {c.lesson_title} · {formatSize(c.file_size_kb)}
                    {c.uploaded_by ? ` · by ${c.uploaded_by}` : ""}
                  </p>
                  {c.last_review?.notes && (
                    <p className="text-sm">
                      Reviewer note: <em>{c.last_review.notes}</em>
                    </p>
                  )}
                </div>
                <StatusBadge card={c} />
                <label className="btn-secondary cursor-pointer">
                  {c.review_status === "pending" && c.last_review?.decision === "revise" ? "Upload new recording" : "Replace video"}
                  <input
                    type="file"
                    accept="video/mp4,video/webm"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void replaceVideo(c, file);
                    }}
                  />
                  <span className="sr-only"> for {c.english_word}</span>
                </label>
                <button className="btn-danger" onClick={() => void deleteCard(c)}>
                  Delete<span className="sr-only"> {c.english_word}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------- reviewer ----------------

function ReviewSection() {
  const [queue, setQueue] = useState<ManagedCard[] | null>(null);
  const [msg, setMsg] = useState({ text: "", error: false });

  const [version, setVersion] = useState(0);
  const load = useCallback(async () => setVersion((v) => v + 1), []);

  useEffect(() => {
    let active = true;
    getJSON<ManagedCard[]>("/api/reviews/pending/")
      .then((r) => active && setQueue(r.data))
      .catch((e: Error) => active && setMsg({ text: e.message, error: true }));
    return () => {
      active = false;
    };
  }, [version]);

  async function decide(card: ManagedCard, decision: Decision, notes: string) {
    try {
      await sendJSON(`/api/cards/${card.id}/review/`, "POST", { decision, notes });
      const verb = { approved: "approved and published", revise: "sent back for re-recording", rejected: "rejected" }[decision];
      setMsg({ text: `“${card.english_word}” ${verb}.`, error: false });
      await load();
    } catch (err) {
      setMsg({ text: (err as Error).message, error: true });
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-muted">
        Check handshape, location, movement, orientation, facial expression, meaning and regional variation. Only
        approved signs are shown to learners. You can't review signs you uploaded yourself.
      </p>
      <Message {...msg} />
      {queue === null ? (
        <p className="text-muted">Loading…</p>
      ) : queue.length === 0 ? (
        <p className="panel p-5">Nothing is waiting for review.</p>
      ) : (
        queue.map((card) => <ReviewItem key={card.id} card={card} onDecide={decide} />)
      )}
    </div>
  );
}

function ReviewItem({ card, onDecide }: { card: ManagedCard; onDecide: (c: ManagedCard, d: Decision, n: string) => void }) {
  const [notes, setNotes] = useState("");
  const notesId = `notes-${card.id}`;
  return (
    <article className="panel grid gap-4 p-5 md:grid-cols-2" aria-label={`Review ${card.english_word}`}>
      <video
        src={card.video_url}
        poster={card.poster_url || undefined}
        controls
        muted
        playsInline
        className="aspect-[4/3] w-full rounded-xl bg-brand-strong"
        aria-label={`Uploaded sign video for ${card.english_word}`}
      />
      <div className="space-y-3">
        <div>
          <h2 className="text-h2">{card.english_word}</h2>
          <p className="text-sm text-muted">
            {card.lesson_title} · uploaded by {card.uploaded_by ?? "unknown"}
          </p>
        </div>
        {card.context_sentence && <p>“{card.context_sentence}”</p>}
        {card.movement_description && <p className="text-sm text-muted">{card.movement_description}</p>}
        {card.last_review && (
          <p className="text-sm">
            Previous decision: <strong>{card.last_review.decision}</strong>
            {card.last_review.notes ? ` — ${card.last_review.notes}` : ""}
          </p>
        )}
        <div>
          <label className="label" htmlFor={notesId}>
            Notes (required to request a re-recording or reject)
          </label>
          <textarea id={notesId} className="field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => onDecide(card, "approved", notes)}>
            Approve
          </button>
          <button className="btn-secondary" onClick={() => onDecide(card, "revise", notes)}>
            Request re-record
          </button>
          <button className="btn-danger" onClick={() => onDecide(card, "rejected", notes)}>
            Reject
          </button>
        </div>
      </div>
    </article>
  );
}

// ---------------- admin ----------------

const ROLES: { value: Role; label: string }[] = [
  { value: "learner", label: "Learner" },
  { value: "teacher", label: "Teacher" },
  { value: "reviewer", label: "Deaf KSL reviewer" },
  { value: "admin", label: "Administrator" },
];

function UsersSection({ me }: { me: User }) {
  const [users, setUsers] = useState<User[]>([]);
  const [msg, setMsg] = useState({ text: "", error: false });

  const [version, setVersion] = useState(0);
  const load = useCallback(async () => setVersion((v) => v + 1), []);

  useEffect(() => {
    let active = true;
    getJSON<User[]>("/api/users/")
      .then((r) => active && setUsers(r.data))
      .catch((e: Error) => active && setMsg({ text: e.message, error: true }));
    return () => {
      active = false;
    };
  }, [version]);

  const [temp, setTemp] = useState<{ username: string; password: string } | null>(null);

  async function resetPassword(u: User) {
    if (!window.confirm(`Reset the password for ${u.username}? Their current password will stop working.`)) return;
    setMsg({ text: "", error: false });
    try {
      const res = await sendJSON<{ username: string; temporary_password: string }>(
        `/api/users/${u.id}/reset-password/`,
        "POST",
      );
      setTemp({ username: res.username, password: res.temporary_password });
    } catch (err) {
      setTemp(null);
      setMsg({ text: (err as Error).message, error: true });
    }
  }

  async function changeRole(u: User, role: Role) {
    try {
      await sendJSON(`/api/users/${u.id}/`, "PATCH", { role });
      setMsg({ text: `${u.username} is now a ${ROLES.find((r) => r.value === role)?.label}.`, error: false });
      await load();
    } catch (err) {
      setMsg({ text: (err as Error).message, error: true });
    }
  }

  return (
    <div className="space-y-4">
      <Message {...msg} />
      {temp && (
        <div role="status" className="panel space-y-2 border-brand p-5">
          <p className="font-semibold">Temporary password for {temp.username}</p>
          <p className="select-all rounded-xl bg-sand px-4 py-3 font-mono text-2xl tracking-widest">{temp.password}</p>
          <p className="text-sm text-muted">
            Give this to {temp.username} in person. It is shown only once. They will be asked to choose their own
            password when they sign in.
          </p>
          <button className="btn-secondary" onClick={() => setTemp(null)}>
            Done
          </button>
        </div>
      )}
      <p className="text-sm text-muted">
        Passwords can't be viewed. If someone forgets theirs, reset it here and give them the temporary password.
      </p>
      <ul className="panel divide-y divide-line">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <p className="mr-auto font-semibold">
              {u.username} {u.id === me.id && <span className="text-sm font-normal text-muted">(you)</span>}
            </p>
            <label className="sr-only" htmlFor={`role-${u.id}`}>
              Role for {u.username}
            </label>
            <select
              id={`role-${u.id}`}
              className="field w-auto"
              value={u.role}
              disabled={u.id === me.id}
              onChange={(e) => void changeRole(u, e.target.value as Role)}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <button className="btn-secondary" disabled={u.id === me.id} onClick={() => void resetPassword(u)}>
              Reset password
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
