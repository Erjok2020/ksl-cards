import { useEffect, useMemo, useState } from "react";
import { ButtonLink } from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import Link from "../components/ui/Link";
import { Card, EmptyState, ErrorMessage, Notice, Skeleton } from "../components/ui/primitives";
import { connectionProblem, getJSON, OfflineError } from "../lib/api";
import { useOnline } from "../lib/hooks";
import { useHash } from "../lib/router";
import { usePageMeta } from "../lib/usePageMeta";
import type { FaqEntry } from "../types";

type State =
  | { status: "loading" }
  | { status: "ready"; entries: FaqEntry[]; fromCache: boolean }
  | { status: "error"; offline: boolean };

export default function Faq() {
  usePageMeta(
    "FAQ",
    "Answers about learning Kenyan Sign Language with KSL Cards, using lessons offline, lesson checks, saving progress and managing your account.",
  );
  const hash = useHash().slice(1);
  const online = useOnline();
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    getJSON<FaqEntry[]>("/api/faq/")
      .then(({ data, fromCache }) => active && setState({ status: "ready", entries: data, fromCache }))
      .catch((err: unknown) => active && setState({ status: "error", offline: err instanceof OfflineError }));
    return () => {
      active = false;
    };
  }, [attempt]);

  // Jump to the linked question or section once the answers are on the page.
  const ready = state.status === "ready";
  useEffect(() => {
    if (ready && hash) document.getElementById(hash)?.scrollIntoView();
  }, [ready, hash]);

  const groups = useMemo(() => {
    if (state.status !== "ready") return [];
    const q = query.trim().toLowerCase();
    const matches = state.entries.filter(
      (e) => !q || e.question.toLowerCase().includes(q) || e.answer.toLowerCase().includes(q),
    );
    const map = new Map<string, { label: string; entries: FaqEntry[] }>();
    for (const e of matches) {
      const g = map.get(e.category) ?? { label: e.category_label, entries: [] };
      g.entries.push(e);
      map.set(e.category, g);
    }
    return [...map.entries()].map(([category, g]) => ({ category, ...g }));
  }, [state, query]);

  const total = groups.reduce((s, g) => s + g.entries.length, 0);

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_260px]">
      <div className="flex min-w-0 flex-col gap-5">
        <div>
          <h1 className="text-h1">Frequently asked questions</h1>
          <p className="mt-2 text-body text-muted">Short answers about learning, offline use and accounts.</p>
        </div>

        {state.status === "loading" && <Skeleton label="Loading questions" lines={4} block={false} />}
        {state.status === "error" && (
          <ErrorMessage
            title={state.offline ? "The FAQ isn't saved on this device yet" : "We couldn't load the FAQ"}
            onRetry={() => {
              setState({ status: "loading" });
              setAttempt((a) => a + 1);
            }}
          >
            {state.offline
              ? connectionProblem(
                "You're offline. The FAQ is saved for offline reading the first time you open it while connected.",
              )
              : "Check your connection and try again."}
          </ErrorMessage>
        )}

        {state.status === "ready" && (
          <>
            {(state.fromCache || !online) && <Notice>You're offline. Showing the FAQ saved on this device.</Notice>}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="faq-search" className="text-label font-semibold">
                Search questions
              </label>
              <div className="relative">
                <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
                <input
                  id="faq-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="min-h-11 w-full rounded-ctl border border-[#b9c2be] bg-white pr-3 pl-10 text-body focus:border-2 focus:border-forest focus:outline-none"
                />
              </div>
              <p role="status" className="text-cap text-muted">
                {query.trim() ? `${total} question${total === 1 ? "" : "s"} found` : ""}
              </p>
            </div>

            {total === 0 && (
              <EmptyState title="No questions match your search">Try a different word, or send us your question.</EmptyState>
            )}

            {groups.map((g) => (
              <section key={g.category} aria-labelledby={`faq-${g.category}`}>
                {/* The category name is also the anchor: /faq#offline, /faq#learning, /faq#account */}
                <h2 id={`faq-${g.category}`} className="mb-2.5 scroll-mt-4 text-h2">
                  <span id={g.category} className="scroll-mt-4">
                    {g.label}
                  </span>
                </h2>
                <Card className="overflow-hidden">
                  {g.entries.map((e, i) => (
                    <details
                      key={e.id}
                      id={e.slug && e.slug !== g.category ? e.slug : undefined}
                      open={!!query.trim() || hash === e.slug || (hash === g.category && i === 0) || undefined}
                      className="group scroll-mt-4 border-t border-line first:border-t-0"
                    >
                      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 py-2.5 text-body font-semibold [&::-webkit-details-marker]:hidden">
                        {e.question}
                        <Icon name="plus" className="text-forest group-open:hidden" />
                        <Icon name="minus" className="hidden text-forest group-open:block" />
                      </summary>
                      <p className="px-5 pb-4 text-body text-ink">{e.answer}</p>
                    </details>
                  ))}
                </Card>
              </section>
            ))}
          </>
        )}
      </div>

      <aside className="flex flex-col gap-4">
        {state.status === "ready" && groups.length > 0 && (
          <nav aria-label="On this page" className="rounded-card bg-sage p-[18px]">
            <p className="eyebrow mb-1.5">On this page</p>
            <ul>
              {groups.map((g) => (
                <li key={g.category}>
                  <a href={`#${g.category}`} className="inline-flex min-h-9 items-center text-nav font-semibold text-forest">
                    {g.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <Card as="section" aria-labelledby="faq-help" className="p-[18px]">
          <h2 id="faq-help" className="text-h3">
            Still need help?
          </h2>
          <p className="mt-1.5 mb-3 text-label text-muted">Send us a note. Feedback is anonymous unless you choose to add your username.</p>
          <ButtonLink to="/feedback?page=%2Ffaq" variant="secondary" size="sm">
            Send feedback
          </ButtonLink>
          <p className="mt-3 text-label text-muted">
            How we handle your data: <Link to="/privacy">Privacy policy</Link>
          </p>
        </Card>
      </aside>
    </div>
  );
}
