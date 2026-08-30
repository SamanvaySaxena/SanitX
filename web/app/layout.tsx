import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@/styles/globals.css";

/* §8 — Geist Sans and Geist Mono are self-hosted by the `geist` package via
   next/font, which subsets, sets font-display: swap, and preloads. No
   third-party font CDN sits on the critical path. */

export const metadata: Metadata = {
  metadataBase: new URL("https://sanitx.local"),
  title: {
    default: "SanitX — scans PDFs and Markdown for hidden prompt injections",
    template: "%s · SanitX",
  },
  // §3.6 register: capability, countable, no scare. The count stays a claim
  // about PDFs, because it is one — lib/vectors.ts is the PDF taxonomy, and
  // Markdown support added detectors rather than changing that number.
  description:
    "SanitX scans PDFs and Markdown for hidden prompt injections. Ten ways a PDF can hide an instruction — we check for all of them.",
  openGraph: {
    title: "SanitX — scans PDFs and Markdown for hidden prompt injections",
    description:
      "SanitX scans PDFs and Markdown for hidden prompt injections. Ten ways a PDF can hide an instruction — we check for all of them.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0B0F17",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* ---------------------------------------------------------------
            TEMPORARY — Figma capture bridge (design handoff only).

            Loads Figma's html-to-design capture script, which exposes an
            in-browser toolbar for pushing a section of this page into the
            Figma file. It is NOT part of the product: it is a third-party
            script on the critical path and must be deleted before any
            deploy. Tracked for removal — see the note in the PR/commit.
            --------------------------------------------------------------- */}
        <script
          src="https://mcp.figma.com/mcp/html-to-design/capture.js"
          async
        />
      </head>
      <body className="bg-[var(--bg-base)] text-[var(--text-mid)] antialiased">
        {/* §7.3 — skip-to-content and skip-to-scanner are the first two tab
            stops on every page. The second one is the professional's escape
            hatch from the narrative and is deliberately not marketing-gated. */}
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <a href="#scanner" className="skip-link">
          Skip to scanner
        </a>
        {children}
      </body>
    </html>
  );
}
