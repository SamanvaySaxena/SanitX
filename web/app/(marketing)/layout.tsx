import "@/styles/narrative.css";
import { ScrollRail } from "@/components/narrative/ScrollRail";
import { SkipToScanner } from "@/components/narrative/SkipToScanner";
import { MotionToggle } from "@/components/primitives/MotionToggle";

/**
 * Zone A — the narrative site (§1.3).
 *
 * The route group is the bundle boundary. GSAP is imported only by components
 * rendered beneath this layout, so a professional who bookmarks /scan never
 * downloads a byte of it. §1.3: "Enforce the boundary in the bundler, not in
 * discipline."
 *
 * narrative.css is imported here for the same reason: Acts 1-6's styles are
 * Zone A's, and a professional who bookmarks /scan should not download them.
 * Act 7 is the one exception, and it carries its own stylesheet with the
 * Scanner component rather than through a route layout.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ScrollRail />
      <SkipToScanner />
      {/* §7.2 — the motion preference, early in the tab order because a
          visitor who wants less motion needs it BEFORE six pinned acts, not
          in a footer under them. Zone A only: /scan animates nothing. */}
      <MotionToggle />
      <main id="main">{children}</main>
    </>
  );
}
