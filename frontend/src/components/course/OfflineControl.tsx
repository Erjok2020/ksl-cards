import { useState } from "react";
import { formatSize, OfflineError } from "../../lib/api";
import { cacheSupported, downloadModule, removeModule } from "../../lib/downloads";
import { useOnline } from "../../lib/hooks";
import type { CourseModule } from "../../lib/useCourse";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { Chip } from "../ui/primitives";

type State =
  | { status: "idle" }
  | { status: "downloading"; done: number; total: number }
  | { status: "error"; message: string };

/**
 * Offline status and actions for one module. Status is always icon + text
 * ("Saved offline", "Downloading 4 of 8", "Download failed"), never colour
 * alone.
 */
export default function OfflineControl({
  module,
  showRemove = false,
}: {
  module: CourseModule;
  /** Show a Remove button next to "Saved offline" (Downloads page). */
  showRemove?: boolean;
}) {
  const online = useOnline();
  const [state, setState] = useState<State>({ status: "idle" });
  const supported = cacheSupported();

  async function download() {
    setState({ status: "downloading", done: 0, total: 0 });
    try {
      await downloadModule(module.key, module.lessons, (done, total) =>
        setState({ status: "downloading", done, total }),
      );
      setState({ status: "idle" });
    } catch (err) {
      setState({
        status: "error",
        message:
          err instanceof OfflineError
            ? "The connection dropped. Nothing was saved."
            : err instanceof Error
              ? err.message
              : "Download failed.",
      });
    }
  }

  async function remove() {
    if (!window.confirm(`Remove "${module.title}" from this device? You can download it again later.`)) return;
    await removeModule(module.key);
  }

  if (state.status === "downloading") {
    return (
      <span role="status" aria-live="polite">
        <Chip icon="download">
          {state.total ? `Downloading ${state.done} of ${state.total}` : "Starting download"}
        </Chip>
      </span>
    );
  }

  if (module.offline === "saved") {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-cap font-semibold text-forest">
          <Icon name="saved" size={16} />
          Saved offline
        </span>
        {showRemove && (
          <Button size="sm" variant="danger" icon="trash" onClick={() => void remove()}>
            Remove<span className="sr-only"> {module.title} from this device</span>
          </Button>
        )}
      </span>
    );
  }

  const label =
    module.offline === "removed" ? "Download again" : state.status === "error" ? "Try again" : "Download";

  return (
    <span className="inline-flex flex-col items-start gap-1">
      {module.offline === "removed" && state.status !== "error" && (
        <Chip tone="danger" icon="alert">
          Removed by the browser
        </Chip>
      )}
      {state.status === "error" && (
        <span role="alert">
          <Chip tone="danger" icon="alert">
            Download failed
          </Chip>
          <span className="mt-1 block text-cap text-danger-ink">{state.message}</span>
        </span>
      )}
      {supported ? (
        <Button
          size="sm"
          variant="secondary"
          icon="download"
          disabled={!online}
          onClick={() => void download()}
          aria-label={`${label} ${module.title}, ${formatSize(module.sizeKb)}`}
        >
          {label} · {formatSize(module.sizeKb)}
        </Button>
      ) : (
        <span className="text-cap text-muted">Offline saving isn't available in this browser</span>
      )}
      {supported && !online && <span className="text-cap text-muted">Connect to download</span>}
    </span>
  );
}
