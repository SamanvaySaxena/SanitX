import * as React from "react";

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="from-document inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-[var(--r-chip)] border border-[var(--line-soft)] bg-[var(--bg-raised)] px-1 text-[length:var(--ui-xs)] text-[var(--text-low)]">
      {children}
    </kbd>
  );
}
