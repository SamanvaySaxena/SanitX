import { Kbd } from "@/components/primitives/Kbd";

/**
 * §4.3 — "Every pinned scene exposes a skip affordance: a persistent,
 * keyboard-reachable 'Skip to scanner' in the top-right from the first scroll
 * event onward. The engineer who wants the tool must always be one key away.
 * This is the single most important concession Zone A makes to Zone B."
 *
 * Persistent and always rendered rather than revealed on scroll, because a
 * control that appears only after scrolling is not reachable by the keyboard
 * user who tabs from the top — and that user is exactly who needs it.
 */
export function SkipToScanner() {
  return (
    <a
      href="/scan"
      className="fixed right-3 top-3 z-50 inline-flex min-h-9 items-center gap-2 rounded-[var(--r-card)] border border-[var(--line-soft)] bg-[color-mix(in_oklab,var(--bg-overlay)_88%,transparent)] px-3 text-[length:var(--ui)] text-[var(--text-mid)] no-underline backdrop-blur transition-colors duration-[var(--t-snap)] ease-[var(--e-snap)] hover:border-[var(--line-strong)] hover:text-[var(--text-hi)]"
    >
      Skip to scanner <Kbd>⏎</Kbd>
    </a>
  );
}
