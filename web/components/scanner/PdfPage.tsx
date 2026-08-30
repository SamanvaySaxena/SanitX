"use client";

/* =========================================================================
   The real page — FRONTEND_DESIGN.md §6.1 pane 1, §9.1.
   -------------------------------------------------------------------------
   Rasterises the scanned document itself, so the bounding boxes sit on the
   glyphs they describe rather than on greeked stand-in lines.

   Three things this component is careful about, all for the same reason —
   the surface underneath an annotation must never be able to misrepresent
   what was scanned:

   1. IT REPORTS ITS OWN STATE. `onStatus` tells the parent whether a real
      page is on screen, so the caption and the accessible name describe what
      is actually there rather than what was hoped for. §10.2's rule applies
      to the preview as much as to the verdict.

   2. IT NEVER RENDERS A STALE PAGE. Every render carries an AbortController
      that fires on page change, resize, file change and unmount, so paging
      quickly cannot leave page 3's pixels under page 7's boxes.

   3. IT DOES NOT OWN THE PAGE COUNT. The response is authoritative for how
      many pages the document has; if the renderer disagrees it says so
      through `onStatus` rather than silently paging somewhere else.
   ========================================================================= */

import * as React from "react";
import { openPdfFile, type PdfDocumentHandle } from "@/lib/pdf/render";

export type PdfPageStatus =
  | { kind: "loading" }
  | { kind: "ready"; pages: number }
  | { kind: "unavailable"; reason: string };

export interface PdfPageProps {
  file: File;
  page: number;
  onStatus?: (status: PdfPageStatus) => void;
}

export function PdfPage({ file, page, onStatus }: PdfPageProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const docRef = React.useRef<PdfDocumentHandle | null>(null);
  const [status, setStatus] = React.useState<PdfPageStatus>({ kind: "loading" });

  // Report upward without making `onStatus` a dependency of the render
  // effects — a parent that passes an inline arrow would otherwise re-open
  // the document on every one of its own renders.
  const statusRef = React.useRef(onStatus);
  statusRef.current = onStatus;
  React.useEffect(() => {
    statusRef.current?.(status);
  }, [status]);

  // Bumped whenever a document finishes opening or the box resizes, to
  // re-drive the render effect below.
  const [revision, setRevision] = React.useState(0);
  const widthRef = React.useRef(0);

  /* ---- Open the document. Once per File. ---------------------------- */
  React.useEffect(() => {
    let cancelled = false;
    setStatus({ kind: "loading" });

    void (async () => {
      try {
        const doc = await openPdfFile(file);
        if (cancelled) {
          doc.destroy();
          return;
        }
        docRef.current = doc;
        setStatus({ kind: "ready", pages: doc.pages });
        setRevision((r) => r + 1);
      } catch (err) {
        if (cancelled) return;
        docRef.current = null;
        // Named, never a generic failure. The document was still scanned;
        // only the picture of it is missing, and the caption says exactly
        // that rather than implying the scan is in doubt.
        setStatus({
          kind: "unavailable",
          reason:
            err instanceof Error && err.message
              ? err.message
              : "The renderer could not open this file.",
        });
      }
    })();

    return () => {
      cancelled = true;
      docRef.current?.destroy();
      docRef.current = null;
    };
  }, [file]);

  /* ---- Track the box width, so the raster matches the display size. -- */
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;

    const target = canvas.parentElement ?? canvas;
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0);
      if (next <= 0) return;
      // Ignore sub-pixel churn; a re-raster is not free.
      if (Math.abs(next - widthRef.current) < 8) return;
      widthRef.current = next;
      setRevision((r) => r + 1);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  /* ---- Draw. ------------------------------------------------------- */
  React.useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;

    const controller = new AbortController();
    const width =
      widthRef.current ||
      Math.round(canvas.parentElement?.clientWidth ?? 0) ||
      612;

    void (async () => {
      try {
        await doc.renderPage(page, canvas, width, controller.signal);
      } catch (err) {
        if (controller.signal.aborted) return;
        setStatus({
          kind: "unavailable",
          reason:
            err instanceof Error && err.message
              ? err.message
              : "The renderer could not draw this page.",
        });
      }
    })();

    return () => controller.abort();
  }, [page, revision]);

  return (
    <div className="sx-page-surface" data-surface="document">
      <canvas
        ref={canvasRef}
        className="sx-page-canvas"
        data-testid="pdf-page-canvas"
        data-page={page}
        data-status={status.kind}
        // The accessible name lives on .sx-page in PageViewer, which owns the
        // whole annotated composition. A second one here would announce the
        // page twice (§7.3).
        aria-hidden="true"
      />
    </div>
  );
}
