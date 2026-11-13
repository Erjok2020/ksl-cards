import { useState } from "react";
import { ButtonLink } from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import Link from "../components/ui/Link";
import { Card } from "../components/ui/primitives";
import { usePageMeta } from "../lib/usePageMeta";

/** Only in-app paths, so the link can't point anywhere else. */
function backTarget(): string {
  const from = new URLSearchParams(window.location.search).get("from") ?? "";
  return from.startsWith("/") && !from.startsWith("//") ? from : "";
}

export default function Thanks() {
  usePageMeta(
    "Thank you",
    "Thanks for sending feedback on KSL Cards. See what happens next and get back to your sign language lessons.",
  );
  const [from] = useState(backTarget);
  const fromLesson = from.startsWith("/lesson/");

  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-5 py-4">
      <div>
        <Icon name="circle-check" size={40} className="text-ok" />
        <h1 className="mt-2 text-h1">Thank you for your feedback</h1>
        <p className="mt-2 text-body text-muted">
          Your message helps us improve the lessons for learners in Kakuma. It is stored without your name unless
          you chose to add your username.
        </p>
      </div>

      <Card as="section" aria-labelledby="next-heading" className="p-5">
        <h2 id="next-heading" className="text-h2">
          What happens next
        </h2>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-body">
          <li>The project team reads the feedback that is sent in.</li>
          <li>Problems with a sign video are passed to the Deaf KSL reviewer.</li>
          <li>If a lesson is changed, you get the new version the next time you are online.</li>
        </ul>
      </Card>

      <div className="flex flex-wrap gap-3">
        {from && (
          <ButtonLink to={from} variant="primary" icon="chevron-left">
            {fromLesson ? "Back to the lesson" : "Back to where you were"}
          </ButtonLink>
        )}
        <ButtonLink to="/" variant={from ? "secondary" : "primary"}>
          All lessons
        </ButtonLink>
      </div>

      <p className="text-label text-muted">
        How we use feedback: <Link to="/privacy">Privacy policy</Link> · <Link to="/faq">FAQ</Link>
      </p>
    </div>
  );
}
