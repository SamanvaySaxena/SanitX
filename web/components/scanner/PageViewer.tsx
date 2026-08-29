"use client";

/* =========================================================================
   Page preview — FRONTEND_DESIGN.md §6.1 pane 1.
   -------------------------------------------------------------------------
   §3.1: the paper is the only bright object on the screen, so it is the focal
   point in every section for free. This pane is the one place in Zone B that
   carries .paper-surface and the one shadow the system allows.

   In demo mode there is no file and therefore no page to rasterise, so the
   surface is a SYNTHETIC page in the same 612x792 space the bboxes use. It is
   labelled as synthetic in the UI. §10.2's rule — a security tool must not
   silently present fabricated material as real — applies to the preview just
   as much as to the verdict.
   ========================================================================= */

import * as React from "react";
import { BBoxOverlay } from "./BBoxOverlay";
import type { Finding } from "@/lib/types";

export interface PageViewerProps {
  filename: string;
  pages: number;
  page: number;
  onPageChange: (page: number) => void;
  findings: Finding[];
  selectedId: string | null;
  pulseKey: number;
  /** True while fixtures are serving. Drives the synthetic-page caption. */
  demo: boolean;
}

/* -------------------------------------------------------------------------
   PDF.js SEAM.

   §9.1 / §8: "PDF.js is loaded only on /scan, and only after a file is
   selected." The dependency is deliberately NOT installed yet — §10.1 marks
   "Scanner: upload + caps" as needing backend Stage 1, so there is no real
   file in play and shipping ~330KB of renderer to draw a placeholder would
   blow the 60KB Zone B budget for nothing.

   When a real File arrives, replace <SyntheticPage /> below with a <canvas>
   filled by this effect and change NOTHING else:

     React.useEffect(() => {
       if (!file) return;
       let cancelled = false;
       void (async () => {
         const pdfjs = await import("pdfjs-dist");          // lazy, /scan only
         pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
         const doc  = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
         const pg   = await doc.getPage(page);
         const vp   = pg.getViewport({ scale: canvas.width / pg.getViewport({ scale: 1 }).width });
         if (cancelled) return;
         await pg.render({ canvasContext: ctx, viewport: vp }).promise;
       })();
       return () => { cancelled = true; };
     }, [file, page]);

   BBoxOverlay is expressed in PDF user space as percentages of 612x792, so it
   sits correctly over either surface at any size. The overlay is the contract;
   the surface underneath it is an implementation detail.
   ------------------------------------------------------------------------- */

/** Greeked mono paper. Deliberately not readable prose: inventing document
    text a user might mistake for their own content is the same category of
    error §10.2 warns about, one level down. */
function SyntheticPage({ page }: { page: number }) {
  const lines = React.useMemo(() => {
    // Deterministic from the page number, so paging back and forth is stable
    // and nothing reflows between renders.
    const out: number[] = [];
    let seed = page * 9301 + 49297;
    for (let i = 0; i < 22; i += 1) {
      seed = (seed * 9301 + 49297) % 233280;
      out.push(38 + (seed % 62));
    }
    return out;
  }, [page]);

  return (
    <div className="sx-page-surface from-document">
      <div className="sx-paper-head">PAGE {page}</div>
      <div className="sx-paper-sub">synthetic surface — demo mode</div>
      <div className="sx-paper-lines">
        {lines.map((w, i) => (
          <div
            key={i}
            className="sx-paper-line"
            data-weight={i === 0 || i === 11 ? "rule" : undefined}
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
      <div className="sx-paper-block" />
    </div>
  );
}

export function PageViewer({
  filename,
  pages,
  page,
  onPageChange,
  findings,
  selectedId,
  pulseKey,
  demo,
}: PageViewerProps) {
  const clamped = Math.min(Math.max(1, page), Math.max(1, pages));
  const onThisPage = findings.filter((f) => f.bbox?.page === clamped).length;

  return (
    <div className="sx-page-wrap">
      <h2 className="sx-pane-title about-document">
        <span>Page preview</span>
        <span className="sx-pane-title-count from-document tabular">
          {onThisPage} box{onThisPage === 1 ? "" : "es"}
        </span>
      </h2>

      <div
        className="sx-page paper-surface"
        role="img"
        aria-label={
          demo
            ? `Synthetic stand-in for page ${clamped} of ${pages} of ${filename}. ` +
              `${onThisPage} finding bounding box${onThisPage === 1 ? "" : "es"} are drawn on it. ` +
              "Demo mode renders a placeholder page; the bounding boxes are the fixture's own coordinates."
            : `Page ${clamped} of ${pages} of ${filename}, with ${onThisPage} finding bounding box${
                onThisPage === 1 ? "" : "es"
              } drawn on it.`
        }
      >
        <SyntheticPage page={clamped} />
        <BBoxOverlay
          page={clamped}
          findings={findings}
          selectedId={selectedId}
          pulseKey={pulseKey}
        />
      </div>

      {/* §6.1 — "◀ 1 / 12 ▶". Both controls clear the 24px target floor. */}
      <div className="sx-pager">
        <button
          type="button"
          className="sx-sample"
          style={{ minHeight: 32, width: "auto", display: "inline-flex" }}
          onClick={() => onPageChange(clamped - 1)}
          disabled={clamped <= 1}
          aria-label="Previous page"
        >
          ◀
        </button>
        <span className="sx-pager-readout from-document tabular" aria-live="off">
          {clamped} / {pages}
        </span>
        <button
          type="button"
          className="sx-sample"
          style={{ minHeight: 32, width: "auto", display: "inline-flex" }}
          onClick={() => onPageChange(clamped + 1)}
          disabled={clamped >= pages}
          aria-label="Next page"
        >
          ▶
        </button>
      </div>

      <p className="sx-note about-document">
        {demo
          ? "Demo mode renders a synthetic page. The boxes are the fixture's own coordinates in the PDF's 612 × 792 point space; PDF.js renders the real page once a file is scanned."
          : "Boxes are drawn in the PDF's own 612 × 792 point coordinate space."}
      </p>
    </div>
  );
}
