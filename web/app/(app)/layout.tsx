/**
 * Zone B — the instrument (§1.3, §6).
 *
 * No scroll rail, no skip affordance, no animation library, no blueprint
 * grid: a working tool does not need wallpaper, and the user who is here
 * already converted (§11 — "Marketing copy inside the scanner").
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main id="main">{children}</main>;
}
