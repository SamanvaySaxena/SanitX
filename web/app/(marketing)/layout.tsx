import { ScrollRail } from "@/components/narrative/ScrollRail";
import { SkipToScanner } from "@/components/narrative/SkipToScanner";

/**
 * Zone A — the narrative site (§1.3).
 *
 * The route group is the bundle boundary. GSAP is imported only by components
 * rendered beneath this layout, so a professional who bookmarks /scan never
 * downloads a byte of it. §1.3: "Enforce the boundary in the bundler, not in
 * discipline."
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
      <main id="main">{children}</main>
    </>
  );
}
