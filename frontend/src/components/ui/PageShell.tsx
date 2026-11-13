import type { ReactNode } from "react";
import { useOnline } from "../../lib/hooks";
import { usePath } from "../../lib/router";
import type { User } from "../../types";
import Button from "./Button";
import Icon from "./Icon";
import Link from "./Link";
import { Chip } from "./primitives";

/* ---------- Brand ---------- */

export function Brand({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="flex min-h-11 items-center gap-2.5 text-forest no-underline">
      <span className="inline-flex size-[34px] items-center justify-center rounded-lg bg-forest text-white">
        <Icon name="hand" size={20} />
      </span>
      <span className="text-[19px] font-semibold tracking-[-0.01em]">KSL Cards</span>
    </Link>
  );
}

/* ---------- Online / offline indicator ---------- */

export function ConnectionChip() {
  const online = useOnline();
  return (
    <span role="status" aria-live="polite">
      {online ? (
        <Chip icon="cloud">Online</Chip>
      ) : (
        <Chip tone="dark" icon="saved">
          Offline: using saved lessons
        </Chip>
      )}
    </span>
  );
}

/* ---------- Header ---------- */

interface NavItem {
  to: string;
  label: string;
  /** Paths (besides `to`) that keep this item highlighted. */
  also?: string[];
}

function navItems(user: User | null): NavItem[] {
  if (!user) return [];
  const items: NavItem[] = [
    { to: "/", label: "Lessons", also: ["/lesson", "/downloads"] },
    { to: "/progress", label: "My Progress" },
  ];
  if (user.role !== "learner") {
    items.push({ to: "/manage", label: user.role === "reviewer" ? "Review signs" : "Manage content" });
  }
  items.push({ to: "/account", label: "Account" });
  return items;
}

function isCurrent(item: NavItem, path: string) {
  if (item.to === "/") return path === "/" || (item.also ?? []).some((p) => path.startsWith(p));
  return path === item.to || path.startsWith(`${item.to}/`);
}

function Header({ user, locked, onLogout }: { user: User | null; locked?: boolean; onLogout?: () => void }) {
  const path = usePath();
  const items = locked ? [] : navItems(user);
  const initials = user ? user.username.slice(0, 2).toUpperCase() : "";

  return (
    <header className="border-b border-line bg-white">
      <div className="wrap flex min-h-16 flex-wrap items-center justify-between gap-x-6">
        <div className="flex items-center gap-9">
          <Brand />
          {items.length > 0 && (
            <nav aria-label="Main" className="hidden gap-[26px] md:flex">
              {items.map((item) => {
                const current = isCurrent(item, path);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={current ? "page" : undefined}
                    className={`inline-flex min-h-16 items-center border-b-[3px] text-nav text-ink no-underline ${
                      current ? "border-forest font-semibold" : "border-transparent font-normal"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
        <div className="flex items-center gap-3.5">
          <ConnectionChip />
          {user ? (
            <>
              <Link
                to="/account"
                aria-label={`Account: ${user.username}`}
                className="inline-flex size-11 items-center justify-center rounded-full no-underline"
              >
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-forest text-cap font-semibold text-white">
                  {initials}
                </span>
              </Link>
              {onLogout && (
                <span className="hidden sm:block">
                  <Button variant="ghost" onClick={onLogout}>
                    Log out
                  </Button>
                </span>
              )}
            </>
          ) : (
            path !== "/login" && (
              <Link to="/login" className="inline-flex min-h-11 items-center text-nav font-semibold">
                Sign in
              </Link>
            )
          )}
        </div>
      </div>

      {/* Phone: the same links in a row under the brand. */}
      {items.length > 0 && (
        <nav aria-label="Main" className="flex gap-5 overflow-x-auto border-t border-line px-4 md:hidden">
          {items.map((item) => {
            const current = isCurrent(item, path);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={current ? "page" : undefined}
                className={`inline-flex min-h-12 shrink-0 items-center border-b-[3px] text-nav text-ink no-underline ${
                  current ? "border-forest font-semibold" : "border-transparent font-normal"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex min-h-12 shrink-0 cursor-pointer items-center text-nav text-forest sm:hidden"
            >
              Log out
            </button>
          )}
        </nav>
      )}
    </header>
  );
}

/* ---------- Breadcrumbs ---------- */

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items, onForest }: { items: Crumb[]; onForest?: boolean }) {
  const colour = onForest ? "text-on-forest-muted" : "text-muted";
  return (
    <nav aria-label="Breadcrumb" className={`text-label ${colour}`}>
      <ol className="flex flex-wrap items-center gap-x-2">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true">/</span>}
            {item.to ? (
              <Link to={item.to} className={`inline-flex min-h-6 items-center ${onForest ? "text-on-forest-muted" : ""}`}>
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* ---------- Footer ---------- */

const FOOTER: { heading: string; links: { to: string; label: string }[] }[] = [
  {
    heading: "Learn",
    links: [
      { to: "/", label: "Lessons" },
      { to: "/progress", label: "My Progress" },
      { to: "/downloads", label: "Downloads" },
    ],
  },
  {
    heading: "Help",
    links: [
      { to: "/faq", label: "FAQ" },
      { to: "/faq#offline", label: "Using KSL Cards offline" },
      { to: "/feedback", label: "Send feedback" },
    ],
  },
  {
    heading: "About",
    links: [
      { to: "/privacy", label: "Privacy policy" },
      { to: "/faq#signers", label: "Who records the signs" },
      { to: "/account", label: "Account" },
    ],
  },
];

function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-cream">
      <div className="wrap grid gap-8 py-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Brand />
          <p className="mt-3 max-w-[300px] text-label text-muted">
            Kenyan Sign Language lessons for Deaf and hard-of-hearing learners in Kakuma. Signs are shown to
            learners only after a Deaf KSL reviewer approves them.
          </p>
        </div>
        {FOOTER.map((group) => (
          <nav key={group.heading} aria-label={group.heading}>
            <p className="eyebrow mb-2.5">{group.heading}</p>
            <ul className="flex flex-col gap-0.5">
              {group.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="inline-flex min-h-9 items-center text-nav text-ink no-underline hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}

/* ---------- Shell ---------- */

interface PageShellProps {
  user: User | null;
  /** Hide navigation until the user has chosen a new password. */
  locked?: boolean;
  onLogout?: () => void;
  /** Number of progress updates waiting to sync. */
  pendingSync?: number;
  /** Full-width content above <main>, such as the course banner. */
  banner?: ReactNode;
  breadcrumbs?: Crumb[];
  /** Skip the centred wrapper (the lesson view lays out its own columns). */
  bare?: boolean;
  children: ReactNode;
}

export default function PageShell({
  user,
  locked,
  onLogout,
  pendingSync = 0,
  banner,
  breadcrumbs,
  bare,
  children,
}: PageShellProps) {
  const online = useOnline();
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-ctl focus:bg-white focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <Header user={user} locked={locked} onLogout={onLogout} />

      <div role="status" aria-live="polite">
        {pendingSync > 0 && (
          <p className="bg-sage px-4 py-2 text-center text-label text-ink">
            {online
              ? `Syncing ${pendingSync} progress update${pendingSync === 1 ? "" : "s"}…`
              : `${pendingSync} progress update${pendingSync === 1 ? "" : "s"} saved on this device. ${
                  pendingSync === 1 ? "It" : "They"
                } will sync when you are back online.`}
          </p>
        )}
      </div>

      {banner}

      <main id="main" tabIndex={-1} className={`flex-1 outline-none ${bare ? "" : "wrap w-full py-7 md:pb-12"}`}>
        {breadcrumbs && !bare && (
          <div className="mb-4">
            <Breadcrumbs items={breadcrumbs} />
          </div>
        )}
        {children}
      </main>
      <Footer />
    </div>
  );
}
