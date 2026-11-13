import type { ButtonHTMLAttributes, ReactNode } from "react";
import Icon, { type IconName } from "./Icon";
import Link from "./Link";

/**
 * Buttons (mockups/System.html).
 *  primary   terra-ink: the one main action on a screen
 *  brand     forest: other strong actions (Sign in, Pause)
 *  secondary white with a forest label
 *  ghost     text only
 *  danger    destructive actions
 * Every button is at least 44px tall (36px for `size="sm"` inside dense rows
 * where the row itself is the 44px target).
 */
export type ButtonVariant = "primary" | "brand" | "secondary" | "ghost" | "danger" | "on-forest";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-terra-ink text-white",
  brand: "border-transparent bg-forest text-white",
  secondary: "border-control bg-white text-forest",
  ghost: "border-transparent bg-transparent text-forest",
  danger: "border-danger bg-white text-danger",
  "on-forest": "border-[#6f948a] bg-transparent text-white",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-ctl border font-semibold no-underline cursor-pointer text-center";
const DISABLED = "disabled:cursor-not-allowed disabled:border-line disabled:bg-disabled disabled:text-disabled-ink";

interface CommonProps {
  variant?: ButtonVariant;
  size?: "md" | "sm" | "lg";
  icon?: IconName;
  iconAfter?: IconName;
  full?: boolean;
  className?: string;
  children: ReactNode;
}

function classes({ variant = "secondary", size = "md", full, className = "" }: CommonProps) {
  const sizing =
    size === "sm"
      ? "min-h-9 px-3 text-label"
      : size === "lg"
        ? "min-h-12 px-[22px] text-nav"
        : "min-h-11 px-[18px] text-nav";
  return `${BASE} ${sizing} ${VARIANT[variant]} ${DISABLED} ${full ? "w-full" : ""} ${className}`;
}

function Content({ icon, iconAfter, children }: CommonProps) {
  return (
    <>
      {icon && <Icon name={icon} />}
      {children}
      {iconAfter && <Icon name={iconAfter} />}
    </>
  );
}

type ButtonProps = CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

export default function Button(props: ButtonProps) {
  const { variant, size, icon, iconAfter, full, className, children, type = "button", ...rest } = props;
  return (
    <button type={type} className={classes({ variant, size, full, className, children })} {...rest}>
      <Content icon={icon} iconAfter={iconAfter}>
        {children}
      </Content>
    </button>
  );
}

/** A link that looks like a button, for navigation actions. */
export function ButtonLink(props: CommonProps & { to: string; "aria-label"?: string }) {
  const { to, variant, size, icon, iconAfter, full, className, children, ...rest } = props;
  return (
    <Link to={to} className={classes({ variant, size, full, className, children })} {...rest}>
      <Content icon={icon} iconAfter={iconAfter}>
        {children}
      </Content>
    </Link>
  );
}
