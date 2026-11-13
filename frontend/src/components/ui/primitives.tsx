import { useId } from "react";
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import Button from "./Button";
import Icon, { type IconName } from "./Icon";

/* ---------- Card ---------- */

export function Card({
  as: Tag = "div",
  className = "",
  children,
  ...rest
}: {
  as?: "div" | "section" | "article" | "aside" | "form" | "li";
  className?: string;
  children: ReactNode;
} & Record<string, unknown>) {
  return (
    <Tag className={`rounded-card border border-line bg-white ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

/* ---------- Chip / StatusBadge ---------- */

export type ChipTone = "neutral" | "sage" | "dark" | "ok" | "danger" | "muted" | "on-forest";

const CHIP_TONE: Record<ChipTone, string> = {
  neutral: "bg-white text-ink border border-line",
  muted: "bg-white text-muted border border-line",
  sage: "bg-sage text-forest",
  dark: "bg-forest text-white",
  "on-forest": "bg-forest-2 text-white",
  ok: "bg-ok-bg text-ok",
  danger: "bg-danger-bg text-danger",
};

/** Status is never colour alone: a chip always has text, and usually an icon. */
export function Chip({
  tone = "neutral",
  icon,
  children,
  className = "",
}: {
  tone?: ChipTone;
  icon?: IconName;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex min-h-[26px] items-center gap-1.5 rounded-full px-2.5 text-cap font-semibold ${CHIP_TONE[tone]} ${className}`}
    >
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  );
}

/* ---------- ProgressBar ---------- */

/** Progress bars always carry the count in text: pass the same wording as
 *  `label` that is shown beside the bar (e.g. "3 of 8 signs viewed"). */
export function ProgressBar({
  value,
  max,
  label,
  tone = "terra",
  trackClassName = "bg-track",
  className = "",
}: {
  value: number;
  max: number;
  label: string;
  tone?: "terra" | "forest" | "on-dark";
  trackClassName?: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fill = tone === "forest" ? "bg-forest" : tone === "on-dark" ? "bg-terra-on-dark" : "bg-terra";
  return (
    <div role="img" aria-label={label} className={`h-1.5 overflow-hidden rounded-[3px] ${trackClassName} ${className}`}>
      <span className={`block h-full ${fill}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ---------- Inputs ---------- */

const INPUT =
  "min-h-11 w-full rounded-ctl border bg-white px-3 text-body font-normal text-ink placeholder:text-muted focus:border-2 focus:border-forest focus:px-[11px] focus:outline-none";

interface FieldExtras {
  label: string;
  hint?: string;
  error?: string;
}

function FieldFrame({
  id,
  label,
  hint,
  error,
  children,
}: FieldExtras & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && !error && (
        <span id={`${id}-hint`} className="text-cap text-muted">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className="flex items-center gap-1.5 text-cap font-semibold text-danger">
          <Icon name="alert" size={14} />
          {error}
        </span>
      )}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

export function TextField({
  label,
  hint,
  error,
  id,
  className = "",
  ...rest
}: FieldExtras & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <FieldFrame id={fieldId} label={label} hint={hint} error={error}>
      <input
        id={fieldId}
        className={`${INPUT} ${error ? "border-2 border-danger px-[11px]" : "border-[#b9c2be]"} ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        {...rest}
      />
    </FieldFrame>
  );
}

export function TextArea({
  label,
  hint,
  error,
  id,
  className = "",
  ...rest
}: FieldExtras & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <FieldFrame id={fieldId} label={label} hint={hint} error={error}>
      <textarea
        id={fieldId}
        className={`${INPUT} py-2.5 ${error ? "border-2 border-danger px-[11px]" : "border-[#b9c2be]"} ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        {...rest}
      />
    </FieldFrame>
  );
}

/* ---------- States: loading, empty, error ---------- */

/** Static placeholder shapes: no shimmer, so nothing moves. */
export function Skeleton({ label, lines = 2, block = true }: { label: string; lines?: number; block?: boolean }) {
  const widths = ["60%", "35%", "80%", "50%"];
  return (
    <div aria-busy="true" aria-label={label} role="status" className="flex flex-col gap-2.5">
      {block && <span className="h-24 rounded-ctl bg-skeleton" />}
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="h-3.5 rounded bg-skeleton" style={{ width: widths[i % widths.length] }} />
      ))}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-[#c9c2b3] p-5 text-center">
      <p className="text-h3">{title}</p>
      {children && <p className="mt-1.5 text-label text-muted">{children}</p>}
      {action && <div className="mt-3.5">{action}</div>}
    </div>
  );
}

export function ErrorMessage({
  title,
  children,
  onRetry,
  action,
}: {
  title: string;
  children?: ReactNode;
  onRetry?: () => void;
  action?: ReactNode;
}) {
  return (
    <div role="alert" className="flex gap-2.5 rounded-ctl border-l-4 border-danger bg-danger-bg p-3.5 text-danger-ink">
      <Icon name="alert" size={20} className="mt-0.5 text-danger" />
      <div>
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-0.5 text-label">{children}</div>}
        {onRetry && (
          <Button variant="ghost" size="sm" className="mt-1 !px-0 !text-danger-ink underline" onClick={onRetry}>
            Try again
          </Button>
        )}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

/** A short confirmation or information message (not an error). */
export function Notice({ children, tone = "sage" }: { children: ReactNode; tone?: "sage" | "ok" }) {
  return (
    <div
      role="status"
      className={`flex gap-2.5 rounded-ctl p-3.5 text-label ${tone === "ok" ? "bg-ok-bg text-ok" : "bg-sage text-forest"}`}
    >
      <Icon name={tone === "ok" ? "circle-check" : "alert"} size={18} className="mt-px" />
      <div className="text-ink">{children}</div>
    </div>
  );
}
