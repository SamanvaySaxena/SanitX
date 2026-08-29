import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scan",
  description: "Scan a PDF for hidden prompt injections.",
};

export default function ScanPage() {
  return (
    <div id="scanner" className="min-h-dvh">
      <p className="p-6 text-[length:var(--ui)]">Scanner shell — build step 3.</p>
    </div>
  );
}
