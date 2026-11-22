import type { ButtonHTMLAttributes, ReactNode } from "react";
import Icon, { type IconName } from "./Icon";
import { RAISED } from "./keys";
import Link from "./Link";

/**
 * Buttons are drawn as physical keys: a solid face on a darker edge. Pressing
 * a key pushes it down onto its edge, so the screen answers the finger the
 * way a real button would.
 *
 * Labels carry the meaning, so buttons have no decorative icons. Only the
 * media keys (Play, Pause, Replay) keep a symbol, because those symbols are
 * understood without reading English.
 *
 *  primary   terra-ink: the one main action on a screen
 *  brand     forest: other strong actions (Sign in, Play)
 *  secondary a white key with a forest label
 *  ghost     an underlined text action, for the least important choice
 *  danger    destructive actions
 *  on-forest a key for the forest banner
 *
 * Every button is at least 44px tall (36px for `size="sm"` inside dense rows
 * where the row itself is the 44px target).
 */
export type ButtonVariant = "primary" | "brand" | "secondary" | "ghost" | "danger" | "on-forest";

const VARIANT: Record<ButtonVariant, string> = {
  primary: `${RAISED} border-transparent bg-terra-ink text-white [--edge:var(--color-terra-edge)] hover:bg-[#963f25]`,
  brand: `${RAISED} border-transparent bg-forest text-white [--edge:var(--color-forest-edge)] hover:bg-forest-700`,
  secondary: `${RAISED} border-control bg-white text-forest [--edge:var(--color-control-edge)] hover:bg-cream`,
  danger: `${RAISED} border-danger bg-white text-danger [--edge:var(--color-danger-edge)] hover:bg-danger-bg`,
  "on-forest": `${RAISED} border-transparent bg-forest-2 text-white [--edge:var(--color-forest-edge)] hover:bg-[#2a6c5a]`,
  ghost:
    "border-transparent bg-transparent text-forest underline decoration-[1.5px] underline-offset-[5px] hover:decoration-[3px]",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-ctl border font-semibold cursor-pointer text-center";
const DISABLED =
  "disabled:translate-y-0 disabled:cursor-not-allowed disabled:border-line disabled:bg-disabled disabled:text-disabled-ink disabled:shadow-none";

interface CommonProps {
  variant?: ButtonVariant;
  size?: "md" | "sm" | "lg";
  /** Media keys only (Play, Pause, Replay). */
  icon?: IconName;
  full?: boolean;
  className?: string;
  children: ReactNode;
}

function classes({ variant = "secondary", size = "md", full, className = "" }: CommonProps) {
  // A text action lines up with the text around it, so it has no side padding.
  const pad = variant === "ghost" ? "px-0.5" : size === "sm" ? "px-3" : size === "lg" ? "px-6" : "px-[18px]";
  const sizing =
    size === "sm" ? "min-h-9 text-label" : size === "lg" ? "min-h-12 text-[17px] leading-6" : "min-h-11 text-nav";
  const underline = variant === "ghost" ? "" : "no-underline";
  return `${BASE} ${pad} ${sizing} ${underline} ${VARIANT[variant]} ${DISABLED} ${full ? "w-full" : ""} ${className}`;
}

type ButtonProps = CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

export default function Button(props: ButtonProps) {
  const { variant, size, icon, full, className, children, type = "button", ...rest } = props;
  return (
    <button type={type} className={classes({ variant, size, full, className, children })} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

/** A link that looks like a button, for navigation actions. */
export function ButtonLink(props: Omit<CommonProps, "icon"> & { to: string; "aria-label"?: string }) {
  const { to, variant, size, full, className, children, ...rest } = props;
  return (
    <Link to={to} className={classes({ variant, size, full, className, children })} {...rest}>
      {children}
    </Link>
  );
}
