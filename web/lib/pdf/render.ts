/* =========================================================================
   The PDF.js seam, closed — FRONTEND_DESIGN.md §9.1, §6.1.
   -------------------------------------------------------------------------
   §9.1: "PDF.js is loaded only on /scan, and only after a file is selected."
   That is enforced here rather than by convention: the library is behind a
   single dynamic import() that nothing calls until a File exists, so the
   ~1.4MB renderer never enters the Zone A bundle.

   ---------------------------------------------------------------------------
   WHY THE PAGE IS STRETCHED INTO 612 x 792 RATHER THAN RENDERED TO ITS OWN
   ASPECT RATIO. This is the load-bearing decision in the file.

   The backend normalises every bbox into US-Letter point space before it
   leaves the pipeline (pipeline.py#_rescale_bbox):

       x_scale = 612 / page.rect.width
       y_scale = 792 / page.rect.height

   That is a NON-UNIFORM scale — an A4 page (595 x 842) is squeezed
   horizontally and stretched vertically on the way out. BBoxOverlay then
   places every box as a percentage of that same 612 x 792 space.

   So the only surface those percentages land on correctly is one that has had
   the identical non-uniform transform applied. Rendering the page to its true
   aspect ratio and letterboxing it would put every annotation on an A4
   document a few points off its glyphs — precisely the failure mode that
   makes an annotation overlay worse than no overlay at all.

   Hence: render at the page's own proportions, then let CSS stretch the
   canvas to fill the 612:792 box (.sx-page-canvas). The stretch IS the
   transform. US Letter documents, which are the overwhelming majority, are
   unaffected because the scale is 1:1 for them.
   ---------------------------------------------------------------------------

   SAFETY. This module renders documents that are, by assumption, hostile.
   Every option below narrows what the renderer is permitted to do:

     isEvalSupported: false   no Function()/eval in the font fast-path
     enableXfa: false         XFA is an entire scripting runtime; never on
     disableAutoFetch/Stream  the whole file is already in memory; no ranged
                              refetches, so nothing in the document can steer
                              a network request
     worker + font/cmap URLs  all first-party, from public/pdfjs (see
                              scripts/sync-pdfjs-assets.mjs)

   PDF.js never executes document-level JavaScript unless a scripting handler
   is supplied, and none is supplied here.
   ========================================================================= */

/** Where scripts/sync-pdfjs-assets.mjs puts the runtime assets. */
export const PDF_ASSET_BASE = "/pdfjs/";

/** US Letter in points. The coordinate space every bbox is expressed in, and
    the box the rendered canvas is stretched to fill. Mirrors BBoxOverlay. */
export const PAGE_W = 612;
export const PAGE_H = 792;

/** The hardening, as one object, so the suite can open a genuinely hostile
    sample under the EXACT flags production uses rather than under a copy of
    them that is free to drift. See the SAFETY note above for each one. */
export const PDF_HARDENING = {
  isEvalSupported: false,
  enableXfa: false,
  disableAutoFetch: true,
  disableStream: true,
} as const;

/* eslint-disable @typescript-eslint/no-explicit-any */
type PdfjsModule = any;

let modulePromise: Promise<PdfjsModule> | null = null;

/** One import, one worker configuration, for the life of the tab. */
async function loadPdfjs(): Promise<PdfjsModule> {
  if (!modulePromise) {
    modulePromise = import("pdfjs-dist").then((mod: PdfjsModule) => {
      mod.GlobalWorkerOptions.workerSrc = `${PDF_ASSET_BASE}pdf.worker.min.mjs`;
      return mod;
    });
    // A failed import must not poison every later attempt: a transient chunk
    // load error should be retryable, and the caller falls back to the
    // synthetic surface in the meantime.
    modulePromise.catch(() => {
      modulePromise = null;
    });
  }
  return modulePromise;
}

export interface PdfDocumentHandle {
  /** Page count as the renderer sees it — not as the response claims. */
  readonly pages: number;
  /**
   * Draws `pageNumber` into `canvas` at `cssWidth` CSS pixels wide, at the
   * device pixel ratio. Resolves when the page is on the canvas; resolves
   * quietly (having drawn nothing) if `signal` aborts first.
   */
  renderPage(
    pageNumber: number,
    canvas: HTMLCanvasElement,
    cssWidth: number,
    signal?: AbortSignal,
  ): Promise<void>;
  destroy(): void;
}

/** pdf.js transfers the buffer it is given, so callers must hand over a copy
    they do not intend to reuse. `openPdfFile` below does that for them. */
export async function openPdf(data: ArrayBuffer): Promise<PdfDocumentHandle> {
  const pdfjs = await loadPdfjs();

  const doc = await pdfjs.getDocument({
    data,
    ...PDF_HARDENING,
    standardFontDataUrl: `${PDF_ASSET_BASE}standard_fonts/`,
    cMapUrl: `${PDF_ASSET_BASE}cmaps/`,
    cMapPacked: true,
  }).promise;

  let destroyed = false;

  return {
    pages: doc.numPages,

    async renderPage(pageNumber, canvas, cssWidth, signal) {
      if (destroyed || signal?.aborted) return;

      const clamped = Math.min(Math.max(1, Math.round(pageNumber)), doc.numPages);
      const page = await doc.getPage(clamped);
      if (destroyed || signal?.aborted) return;

      // Cap the DPR at 2. Beyond that the canvas costs 4x the memory for a
      // difference nobody can see, and this pane can be a full viewport tall.
      const dpr = Math.min(
        typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
        2,
      );
      const base = page.getViewport({ scale: 1 });
      const scale = Math.max(0.05, (cssWidth * dpr) / base.width);
      const viewport = page.getViewport({ scale });

      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));

      const ctx = canvas.getContext("2d");
      // jsdom, and any browser that refuses a context this large, land here.
      // Not an error worth surfacing as a scan failure — the caller degrades
      // to the synthetic surface and says so.
      if (!ctx) return;

      const task = page.render({
        canvasContext: ctx,
        viewport,
        // A PDF page is paper. Without this the transparent regions show the
        // dark app ground through the page, which reads as a rendering bug.
        background: "#ffffff",
      });

      const onAbort = () => task.cancel();
      signal?.addEventListener("abort", onAbort, { once: true });

      try {
        await task.promise;
      } catch (err) {
        // RenderingCancelledException is the expected outcome of paging fast
        // or resizing mid-render, and is not a failure.
        if (!isCancellation(err)) throw err;
      } finally {
        signal?.removeEventListener("abort", onAbort);
        page.cleanup();
      }
    },

    destroy() {
      destroyed = true;
      void doc.destroy();
    },
  };
}

function isCancellation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: unknown }).name;
  return name === "RenderingCancelledException" || name === "AbortError";
}

/**
 * Opens a `File`, reading it exactly once. The ArrayBuffer is copied because
 * pdf.js detaches whatever it is handed — without the copy, re-opening the
 * same File after a re-scan would fail on a zero-length buffer.
 */
export async function openPdfFile(file: File): Promise<PdfDocumentHandle> {
  const buffer = await file.arrayBuffer();
  return openPdf(buffer.slice(0));
}
