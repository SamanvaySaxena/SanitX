"use client";

/* =========================================================================
   The Markdown surface — FRONTEND_DESIGN.md §6.1 pane 1, for the other kind.
   -------------------------------------------------------------------------
   PdfPage rasterises a page so a bounding box can sit on the glyphs it
   describes. Markdown has no glyphs to sit on: what a Markdown finding
   describes is a SOURCE LINE, and the thing worth showing the user is the
   source itself — because the whole attack is that the source and the
   rendering are not the same document.

   So this is the deliberate inverse of PdfPage. It does not render the
   Markdown. Rendering it would reproduce exactly the omission the scan
   exists to catch: the comment would vanish, the display:none span would
   vanish, and the pane would show the reader the same clean document the
   attacker intended them to see. The source, with the hidden lines marked, is
   the honest surface.

   It keeps PdfPage's three commitments, for the same reasons:

   1. IT REPORTS ITS OWN STATE, so PageViewer's caption describes what is
      actually on screen (§10.2).
   2. IT NEVER SHOWS A STALE DOCUMENT — a new File aborts the previous read.
   3. IT DOES NOT OWN THE LINE COUNT. The response is authoritative; a
      disagreement is reported through `onStatus`, not silently papered over.
   ========================================================================= */

import * as React from "react";
import { SEVERITY_PRESENTATION } from "./FindingsList";
import type { Finding } from "@/lib/types";

/** Beyond this the DOM node count stops being worth it and the pane is no
    longer something a person reads. The findings list stays complete either
    way — only the preview truncates, and it says so. */
export const MAX_PREVIEW_LINES = 4000;

export type MarkdownPageStatus =
  | { kind: "loading" }
  | { kind: "ready"; lines: number; truncated: boolean }
  | { kind: "unavailable"; reason: string };

export interface MarkdownPageProps {
  file: File;
  findings: Finding[];
  selectedId: string | null;
  /** Changes on every selection event so the one-shot pulse re-arms — the
      line-level equivalent of BBoxOverlay's 120ms box pulse. */
  pulseKey: number;
  onStatus?: (status: MarkdownPageStatus) => void;
}

export function MarkdownPage({
  file,
  findings,
  selectedId,
  pulseKey,
  onStatus,
}: MarkdownPageProps) {
  const [lines, setLines] = React.useState<string[] | null>(null);
  const [status, setStatus] = React.useState<MarkdownPageStatus>({
    kind: "loading",
  });
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  // Report upward without making `onStatus` a dependency of the read effect —
  // a parent passing an inline arrow would otherwise re-read the file on
  // every one of its own renders.
  const statusRef = React.useRef(onStatus);
  statusRef.current = onStatus;
  React.useEffect(() => {
    statusRef.current?.(status);
  }, [status]);

  /* ---- Read the source. Once per File. ------------------------------ */
  React.useEffect(() => {
    let cancelled = false;
    setStatus({ kind: "loading" });
    setLines(null);

    void (async () => {
      try {
        const text = await file.text();
        if (cancelled) return;
        const all = text.split("\n");
        const truncated = all.length > MAX_PREVIEW_LINES;
        setLines(truncated ? all.slice(0, MAX_PREVIEW_LINES) : all);
        setStatus({ kind: "ready", lines: all.length, truncated });
      } catch (err) {
        if (cancelled) return;
        // Named, never generic. The document was still scanned; only the
        // picture of it is missing, and the caption says exactly that rather
        // than implying the scan is in doubt.
        setStatus({
          kind: "unavailable",
          reason:
            err instanceof Error && err.message
              ? err.message
              : "The source could not be read from this file.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  /* ---- One finding per line, worst first, so a line carrying two
          findings is marked at the severity that matters. --------------- */
  const byLine = React.useMemo(() => {
    const map = new Map<number, Finding>();
    for (const f of [...findings].sort((a, b) => b.score - a.score)) {
      if (f.line == null) continue;
      if (!map.has(f.line)) map.set(f.line, f);
    }
    return map;
  }, [findings]);

  /* ---- Selection scrolls its line into view (§6.1: "selecting a finding
          scrolls the preview to its page"). ----------------------------- */
  const selectedLine = findings.find((f) => f.id === selectedId)?.line ?? null;

  React.useEffect(() => {
    if (selectedLine == null || !scrollRef.current) return;
    const row = scrollRef.current.querySelector<HTMLElement>(
      `[data-line="${selectedLine}"]`,
    );
    // Optional call for the same reason FindingsList makes it optional: jsdom
    // has no scrollIntoView, and a preview that throws in tests would be a
    // worse trade than a preview that does not scroll in them.
    row?.scrollIntoView?.({ block: "center", behavior: "auto" });
  }, [selectedLine, pulseKey, lines]);

  if (status.kind === "unavailable" || !lines) {
    // A blank paper ground rather than a fabricated document. PageViewer
    // draws the caption that explains which of the two this is.
    return (
      <div
        className="sx-page-surface sx-md-surface"
        data-surface="source"
        data-state={status.kind}
      />
    );
  }

  return (
    <div
      className="sx-page-surface sx-md-surface"
      data-surface="source"
      data-state="ready"
      ref={scrollRef}
    >
      <ol className="sx-md-lines from-document" data-testid="markdown-source">
        {lines.map((text, i) => {
          const lineNo = i + 1;
          const finding = byLine.get(lineNo);
          const selected = finding != null && finding.id === selectedId;
          return (
            <li
              // Re-keying the selected row on pulseKey restarts the one-shot
              // pulse; CSS alone cannot replay an animation on a live element.
              key={selected ? `${lineNo}:${pulseKey}` : lineNo}
              className="sx-md-line"
              data-line={lineNo}
              data-flagged={finding ? "true" : "false"}
              data-tone={
                finding ? SEVERITY_PRESENTATION[finding.severity].tone : undefined
              }
              data-selected={selected ? "true" : "false"}
              data-pulse={selected ? "true" : "false"}
            >
              <span className="sx-md-gutter tabular" aria-hidden="true">
                {lineNo}
              </span>
              {/* A blank line still needs height, or the gutter numbering
                  drifts out of step with the file. */}
              <span className="sx-md-text">{text === "" ? " " : text}</span>
              {selected && finding && (
                <span className="sx-md-tag from-document">{finding.label}</span>
              )}
            </li>
          );
        })}
      </ol>
      {status.kind === "ready" && status.truncated && (
        <p className="sx-md-truncation about-document">
          Preview truncated at {MAX_PREVIEW_LINES.toLocaleString("en-US")} of{" "}
          {status.lines.toLocaleString("en-US")} lines. Every finding is still listed.
        </p>
      )}
    </div>
  );
}
