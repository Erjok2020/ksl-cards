import { useState } from "react";
import OfflineControl from "../components/course/OfflineControl";
import Button, { ButtonLink } from "../components/ui/Button";
import Link from "../components/ui/Link";
import { Card, EmptyState, ErrorMessage, Notice, Skeleton } from "../components/ui/primitives";
import { formatSize, OfflineError } from "../lib/api";
import { cacheSupported, downloadModule } from "../lib/downloads";
import { useOnline } from "../lib/hooks";
import type { Course } from "../lib/useCourse";
import { usePageMeta } from "../lib/usePageMeta";

/** Low = under 50 MB left, or more than 90% of the browser's allowance used. */
function storageIsLow(storage: Course["storage"]): boolean {
  if (!storage?.quotaKb) return false;
  return storage.quotaKb - storage.usedKb < 50 * 1024 || storage.usedKb / storage.quotaKb > 0.9;
}

export default function Downloads({ course }: { course: Course }) {
  usePageMeta(
    "Downloads",
    "See which Kenyan Sign Language modules are saved on this device, download more to use offline, or remove them to free space.",
  );
  const online = useOnline();
  const [bulk, setBulk] = useState<{ status: "idle" | "running" | "error"; message?: string; current?: string }>({
    status: "idle",
  });
  const remaining = course.modules.filter((m) => m.offline !== "saved");
  const saved = course.modules.filter((m) => m.offline === "saved");

  async function downloadAll() {
    try {
      for (const m of remaining) {
        setBulk({ status: "running", current: m.title });
        await downloadModule(m.key, m.lessons, () => undefined);
      }
      setBulk({ status: "idle" });
    } catch (err) {
      setBulk({
        status: "error",
        message:
          err instanceof OfflineError
            ? "The connection dropped. Modules that finished are saved; the rest were not."
            : "A download failed. Modules that finished are saved.",
      });
    }
  }

  return (
    <div className="mx-auto flex max-w-[800px] flex-col gap-5">
      <div>
        <h1 className="text-h1">Downloads</h1>
        <p className="mt-2 text-body text-muted">
          Saved modules play with no internet, in this browser on this device.{" "}
          <Link to="/faq#offline">How offline use works</Link>
        </p>
      </div>

      {!cacheSupported() && (
        <ErrorMessage title="This browser can't save lessons for offline use">
          Try a recent version of Chrome, Firefox, Edge or Safari.
        </ErrorMessage>
      )}
      {!online && <Notice>You're offline. Saved modules still open. Connect to download more.</Notice>}
      {course.status === "loading" && <Skeleton label="Loading modules" lines={3} />}
      {course.status === "error" && (
        <ErrorMessage title="We couldn't load your modules" onRetry={course.reload}>
          {course.error}
        </ErrorMessage>
      )}

      {course.status === "ready" && (
        <>
          {saved.length === 0 && (
            <EmptyState
              title="No saved lessons yet"
              action={
                <ButtonLink to="/" variant="secondary" size="sm">
                  Browse modules
                </ButtonLink>
              }
            >
              Download a module while you are connected to use it offline.
            </EmptyState>
          )}

          <Card as="section" aria-labelledby="dl-modules" className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <h2 id="dl-modules" className="text-h2">
                Modules
              </h2>
              {remaining.length > 1 && cacheSupported() && (
                <Button
                  variant="primary"
                  icon="download"
                  disabled={!online || bulk.status === "running"}
                  onClick={() => void downloadAll()}
                >
                  {bulk.status === "running"
                    ? `Downloading ${bulk.current}…`
                    : `Download all ${remaining.length} · ${formatSize(remaining.reduce((s, m) => s + m.sizeKb, 0))}`}
                </Button>
              )}
            </div>
            {bulk.status === "error" && (
              <div className="px-5 pb-4">
                <ErrorMessage title="Download stopped">{bulk.message}</ErrorMessage>
              </div>
            )}
            <ul>
              {course.modules.map((m) => (
                <li
                  key={m.key}
                  className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5"
                >
                  <div>
                    <p className="text-cap text-muted">
                      Module {m.number} · {m.signCount} signs · {formatSize(m.sizeKb)}
                    </p>
                    <p className="text-h3">
                      {m.offline === "saved" ? (
                        <Link to={`/lesson/${m.lessons[0].id}`} className="text-ink">
                          {m.title}
                        </Link>
                      ) : (
                        m.title
                      )}
                    </p>
                  </div>
                  <OfflineControl module={m} showRemove />
                </li>
              ))}
            </ul>
          </Card>

          <Card as="section" aria-labelledby="dl-storage" className="p-5">
            <h2 id="dl-storage" className="text-h3">
              Storage on this device
            </h2>
            <p className="mt-1.5 text-label text-muted">
              {saved.length} of {course.modules.length} modules saved
              {saved.length > 0 ? ` (${formatSize(course.totals.savedKb)} of sign videos)` : ""}.
              {course.storage ? ` KSL Cards uses ${formatSize(course.storage.usedKb)} in total in this browser.` : ""}
            </p>
            {storageIsLow(course.storage) && (
              <div className="mt-3">
                <ErrorMessage title="This device is running low on space">
                  The browser may remove saved lessons. If that happens, the module shows “Removed by the browser”
                  and you can download it again.
                </ErrorMessage>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
