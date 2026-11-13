import { ButtonLink } from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import Link from "../components/ui/Link";
import { Card } from "../components/ui/primitives";
import { usePageMeta } from "../lib/usePageMeta";

const LINKS = [
  { to: "/", label: "Lessons" },
  { to: "/progress", label: "My Progress" },
  { to: "/faq", label: "Frequently asked questions" },
  { to: "/privacy", label: "Privacy policy" },
];

export default function NotFound() {
  usePageMeta(
    "Page not found",
    "This page could not be found. Go back to your Kenyan Sign Language lessons or open a module you saved offline.",
  );
  return (
    <div className="mx-auto max-w-[640px] py-6">
      <p className="eyebrow">Error 404</p>
      <h1 className="mt-1 text-h1">We can't find that page</h1>
      <p className="mt-2 text-body text-muted">
        The link may be old, or the lesson may have moved. If you're offline, only modules you saved will open.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <ButtonLink to="/" variant="primary">
          Go to Lessons
        </ButtonLink>
        <ButtonLink to="/downloads" variant="secondary" icon="saved">
          Open saved modules
        </ButtonLink>
      </div>

      <Card as="section" className="mt-8" aria-labelledby="nf-links">
        <h2 id="nf-links" className="px-5 pt-5 text-h2">
          You might be looking for
        </h2>
        <ul className="mt-2">
          {LINKS.map((l) => (
            <li key={l.to} className="border-t border-line first:border-t-0">
              <Link
                to={l.to}
                className="flex min-h-12 items-center justify-between px-5 text-body text-ink no-underline hover:underline"
              >
                {l.label}
                <Icon name="chevron-right" className="text-forest" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
