/**
 * §4.3 — a 2px scroll-progress rail across the top of Zone A, driven entirely
 * by `animation-timeline: scroll()`. No JavaScript, no listener, off the main
 * thread. Decorative in the sense that it reveals progress rather than
 * content, which is the one exception §4.1 grants: it is information about
 * the page, not motion on it.
 */
export function ScrollRail() {
  return <div className="scroll-rail" aria-hidden="true" />;
}
