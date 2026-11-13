import { useEffect, useMemo, useState } from "react";
import Link from "../components/ui/Link";
import { ErrorMessage, Notice, Skeleton } from "../components/ui/primitives";
import { connectionProblem, getJSON, OfflineError } from "../lib/api";
import { useOnline } from "../lib/hooks";
import { usePageMeta } from "../lib/usePageMeta";
import type { PolicyPageData } from "../types";

interface Section {
  id: string;
  heading: string;
  blocks: ({ kind: "p"; text: string } | { kind: "ul"; items: string[] })[];
}

/**
 * The policy body is plain text written in the admin:
 *   "## Heading" starts a section, "- " is a bullet, "> " is the summary box,
 *   anything else is a paragraph. No HTML is ever rendered from it.
 */
function parsePolicy(body: string): { summary: string[]; sections: Section[] } {
  const summary: string[] = [];
  const sections: Section[] = [];
  let current: Section | null = null;
  const used = new Set<string>();

  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("## ")) {
      const heading = line.slice(3).trim();
      let id = heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
      while (used.has(id)) id += "-2";
      used.add(id);
      current = { id, heading, blocks: [] };
      sections.push(current);
    } else if (line.startsWith("> ")) {
      summary.push(line.slice(2).trim());
    } else if (line.startsWith("- ")) {
      if (!current) {
        current = { id: "intro", heading: "", blocks: [] };
        sections.push(current);
      }
      const last = current.blocks[current.blocks.length - 1];
      if (last?.kind === "ul") last.items.push(line.slice(2).trim());
      else current.blocks.push({ kind: "ul", items: [line.slice(2).trim()] });
    } else {
      if (!current) {
        current = { id: "intro", heading: "", blocks: [] };
        sections.push(current);
      }
      current.blocks.push({ kind: "p", text: line });
    }
  }
  return { summary, sections };
}

/** Marks "[confirm …]" notes so open questions stand out to reviewers. */
function Text({ text }: { text: string }) {
  const parts = text.split(/(\[confirm[^\]]*\])/i);
  return (
    <>
      {parts.map((part, i) =>
        /^\[confirm/i.test(part) ? (
          <strong key={i} className="font-semibold text-danger">
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

type State =
  | { status: "loading" }
  | { status: "ready"; page: PolicyPageData; fromCache: boolean }
  | { status: "error"; offline: boolean };

export default function Privacy() {
  usePageMeta(
    "Privacy policy",
    "What KSL Cards stores, why, what stays on your device, who can see your progress, and how to ask for your data to be deleted.",
  );
  const online = useOnline();
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    getJSON<PolicyPageData>("/api/pages/privacy/")
      .then(({ data, fromCache }) => active && setState({ status: "ready", page: data, fromCache }))
      .catch((err: unknown) => active && setState({ status: "error", offline: err instanceof OfflineError }));
    return () => {
      active = false;
    };
  }, [attempt]);

  const parsed = useMemo(
    () => (state.status === "ready" ? parsePolicy(state.page.body) : { summary: [], sections: [] }),
    [state],
  );

  if (state.status === "loading") return <Skeleton label="Loading privacy policy" lines={4} block={false} />;
  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-[720px]">
        <h1 className="mb-4 text-h1">Privacy policy</h1>
        <ErrorMessage
          title={state.offline ? "The privacy policy isn't saved on this device yet" : "We couldn't load the privacy policy"}
          onRetry={() => {
            setState({ status: "loading" });
            setAttempt((a) => a + 1);
          }}
        >
          {state.offline
            ? connectionProblem(
                "You're offline. The policy is saved for offline reading the first time you open it while connected.",
              )
            : "Check your connection and try again."}
        </ErrorMessage>
      </div>
    );
  }

  const { page } = state;
  const updated = new Date(page.updated_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const toc = parsed.sections.filter((s) => s.heading);

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[240px_1fr]">
      <nav aria-label="Contents" className="rounded-card bg-sage p-[18px] lg:sticky lg:top-4">
        <p className="eyebrow mb-1.5">Contents</p>
        <ol className="list-decimal pl-5 text-nav">
          {toc.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="inline-flex min-h-9 items-center font-semibold text-forest">
                {s.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <article className="flex min-w-0 max-w-[720px] flex-col gap-5">
        <div>
          <h1 className="text-h1">{page.title}</h1>
          <p className="mt-1 text-label text-muted">Last updated {updated}</p>
        </div>

        {page.is_draft && (
          <div role="note" className="rounded-ctl border-l-4 border-danger bg-danger-bg p-3.5 text-danger-ink">
            <p className="font-semibold">Draft</p>
            <p className="text-label">
              This policy is a draft and has not yet been approved by the project supervisor and the research ethics
              review. Points marked “[confirm …]” are still open.
            </p>
          </div>
        )}
        {(state.fromCache || !online) && <Notice>You're offline. Showing the policy saved on this device.</Notice>}

        {parsed.summary.length > 0 && (
          <div className="rounded-card bg-sage p-[18px]">
            <p className="eyebrow mb-1">In short</p>
            {parsed.summary.map((s) => (
              <p key={s} className="text-body text-ink">
                {s}
              </p>
            ))}
          </div>
        )}

        {parsed.sections.map((s) => (
          <section key={s.id} aria-labelledby={s.heading ? s.id : undefined}>
            {s.heading && (
              <h2 id={s.id} className="mb-2 scroll-mt-4 text-h2">
                {s.heading}
              </h2>
            )}
            {s.blocks.map((b, i) =>
              b.kind === "p" ? (
                <p key={i} className="mb-2 text-body">
                  <Text text={b.text} />
                </p>
              ) : (
                <ul key={i} className="mb-2 flex list-disc flex-col gap-1.5 pl-5 text-body">
                  {b.items.map((item) => (
                    <li key={item}>
                      <Text text={item} />
                    </li>
                  ))}
                </ul>
              ),
            )}
          </section>
        ))}

        <p className="border-t border-line pt-4 text-label text-muted">
          See also: <Link to="/faq">FAQ</Link> · <Link to="/faq#offline">Using KSL Cards offline</Link> ·{" "}
          <Link to="/feedback?page=%2Fprivacy">Send feedback</Link>
        </p>
      </article>
    </div>
  );
}
