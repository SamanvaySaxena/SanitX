import type { Metadata } from "next";
import { Scanner } from "@/components/scanner/Scanner";
import { SAMPLE_ORDER, type SampleId } from "@/lib/fixtures/scans";

/* Zone B — the instrument (§6), full-bleed. Act 7 renders the identical
   component inline (§5.7); the only difference is `embedded`.

   §1.3 / §9.1: this route group is the bundle boundary. Nothing imported from
   here reaches GSAP or Motion — §8 puts Zone B's animation library count at
   "none" and its JS budget at 60KB gzip. */

export const metadata: Metadata = {
  title: "Scan",
  description:
    "Scan a PDF or Markdown document for hidden prompt injections.",
};

/** The hero's second CTA is /scan?sample=malicious (§5.0) — a first-time
    visitor reaches a real verdict without possessing a malicious document. An
    unrecognised value is ignored rather than erroring: a bad query string is
    not worth a broken page. */
function parseSample(value: string | string[] | undefined): SampleId | null {
  const v = Array.isArray(value) ? value[0] : value;
  return SAMPLE_ORDER.find((s) => s === v) ?? null;
}

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ sample?: string | string[] }>;
}) {
  const { sample } = await searchParams;

  return (
    <div id="scanner" className="sx-route">
      <Scanner initialSample={parseSample(sample)} />
    </div>
  );
}
