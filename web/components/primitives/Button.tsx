import * as React from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "sm";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-[#04070E] border-[var(--accent)] hover:brightness-110",
  secondary:
    "bg-transparent text-[var(--text-hi)] border-[var(--line-soft)] hover:border-[var(--line-strong)] hover:bg-[var(--bg-raised)]",
  ghost:
    "bg-transparent text-[var(--text-mid)] border-transparent hover:text-[var(--text-hi)] hover:bg-[var(--bg-raised)]",
};

// WCAG 2.2 SC 2.5.8 — target size >= 24x24px. min-h-11 / min-h-9 clear it
// with margin; nothing here may shrink below the floor.
const SIZE: Record<Size, string> = {
  md: "min-h-11 px-4 text-[length:var(--ui-lg)] gap-2",
  sm: "min-h-9 px-3 text-[length:var(--ui)] gap-1.5",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "secondary", size = "md", className = "", ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        // §4.2 Instant/Snap only — no transition here exceeds the Zone B ceiling.
        className={`inline-flex items-center justify-center rounded-[var(--r-card)] border font-medium transition-[background-color,border-color,filter,color] duration-[var(--t-snap)] ease-[var(--e-snap)] disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
        {...rest}
      />
    );
  },
);

/** A link styled as a button — used for the hero CTAs, which are navigations. */
export interface LinkButtonProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  size?: Size;
}

export const LinkButton = React.forwardRef<HTMLAnchorElement, LinkButtonProps>(
  function LinkButton(
    { variant = "secondary", size = "md", className = "", ...rest },
    ref,
  ) {
    return (
      <a
        ref={ref}
        className={`inline-flex items-center justify-center rounded-[var(--r-card)] border font-medium no-underline transition-[background-color,border-color,filter,color] duration-[var(--t-snap)] ease-[var(--e-snap)] ${VARIANT[variant]} ${SIZE[size]} ${className}`}
        {...rest}
      />
    );
  },
);
