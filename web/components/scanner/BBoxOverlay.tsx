"use client";

/* =========================================================================
   Bounding-box overlay — FRONTEND_DESIGN.md §6.1.
   -------------------------------------------------------------------------
   "Selecting a finding scrolls the preview to its page, pulses its bbox once
   (120ms), and expands its evidence."

   Two decisions worth stating, because both are load-bearing:

   1. COORDINATE SPACE. Boxes are positioned as percentages of the PDF's own
      612x792 user space (US Letter in points, origin top-left, exactly as
      PyMuPDF reports it in lib/types.ts#BBox). That is why the PDF.js seam in
      PageViewer is a surface swap and not a rewrite — a real rendered page
      occupies the same box, so the same percentages land on the same glyphs
      at any zoom.

   2. NOT INTERACTIVE. The overlay is aria-hidden and pointer-events: none.
      §7.3 wants the findings list to be a real list and the selection to be
      announced once; giving every box a second focusable control would hand a
      keyboard user the same nine targets twice and announce each selection
      from two places. The list is the single interactive surface; this is its
      projection. Benign spans are never drawn — only findings.
   ========================================================================= */

import * as React from "react";
import type { Finding } from "@/lib/types";

/** US Letter in points. The scanner's whole coordinate contract. */
export const PAGE_W = 612;
export const PAGE_H = 792;

export interface BBoxOverlayProps {
  page: number;
  findings: Finding[];
  selectedId: string | null;
  /** Changes on every selection event, including re-selecting the same
      finding, so the 120ms pulse re-arms. §11 bans looping motion here. */
  pulseKey: number;
}

export function BBoxOverlay({
  page,
  findings,
  selectedId,
  pulseKey,
}: BBoxOverlayProps) {
  const onPage = findings.filter((f) => f.bbox && f.bbox.page === page);

  return (
    <div className="sx-bboxes" aria-hidden="true" data-testid="bbox-overlay">
      {onPage.map((f) => {
        const b = f.bbox!;
        const selected = f.id === selectedId;
        return (
          <div
            // Re-keying the selected box on pulseKey restarts the animation;
            // CSS alone cannot replay a one-shot animation on a live element.
            key={selected ? `${f.id}:${pulseKey}` : f.id}
            className="sx-bbox"
            data-finding={f.id}
            data-selected={selected ? "true" : "false"}
            data-pulse={selected ? "true" : "false"}
            style={{
              left: `${(b.x0 / PAGE_W) * 100}%`,
              top: `${(b.y0 / PAGE_H) * 100}%`,
              width: `${((b.x1 - b.x0) / PAGE_W) * 100}%`,
              height: `${((b.y1 - b.y0) / PAGE_H) * 100}%`,
            }}
          >
            {selected && <span className="sx-bbox-tag from-document">{f.label}</span>}
          </div>
        );
      })}
    </div>
  );
}
