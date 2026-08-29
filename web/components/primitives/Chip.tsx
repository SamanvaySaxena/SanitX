import * as React from "react";

/** Inline evidence chip. Radius 2px — documents have corners, not pills (§3.4). */
export function Chip({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "safe" | "review" | "blocked";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "border-[var(--line-soft)] text-[var(--text-low)]",
    accent: "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-dim)]",
    safe: "border-[var(--safe)] text-[var(--safe)]",
    review: "border-[var(--review)] text-[var(--review)]",
    blocked: "border-[var(--blocked)] text-[var(--blocked-text)]",
  };
  return (
    <span
      className={`from-document inline-flex items-center rounded-[var(--r-chip)] border px-1.5 py-0.5 text-[length:var(--ui-xs)] leading-none ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
