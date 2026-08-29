"use client";

/**
 * §5.0 — "Do not loop the sweep. A repeating animation becomes wallpaper
 * within one cycle and the reveal loses its force. Re-arm it only on an
 * explicit replay control."
 *
 * This is the ONLY JavaScript in Act 0, and it is deliberately a separate
 * island so the hero itself stays a server component. §8: "Nothing in Act 0
 * waits on JavaScript." If this bundle never arrives, the sweep has already
 * played from static markup and CSS, and the button simply does nothing.
 *
 * Re-arming is a class removal, a forced reflow, and a class re-add — the
 * one reliable way to restart a CSS animation across engines.
 */
export function ReplayButton({ targetId }: { targetId: string }) {
  return (
    <button
      type="button"
      className="inline-flex min-h-9 items-center gap-2 rounded-[var(--r-card)] border border-[var(--line-soft)] bg-transparent px-3 text-[length:var(--ui-sm)] text-[var(--text-low)] transition-colors duration-[var(--t-snap)] ease-[var(--e-snap)] hover:border-[var(--line-strong)] hover:text-[var(--text-hi)]"
      onClick={() => {
        const el = document.getElementById(targetId);
        if (!el) return;
        el.classList.remove("hero-armed");
        // Forced reflow. Reading offsetWidth is what makes the restart stick.
        void el.offsetWidth;
        el.classList.add("hero-armed");
      }}
    >
      <span aria-hidden="true">↻</span> Replay the scan
    </button>
  );
}
