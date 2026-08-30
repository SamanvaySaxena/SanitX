"use client";

/* =========================================================================
   Page preview — FRONTEND_DESIGN.md §6.1 pane 1.
   -------------------------------------------------------------------------
   §3.1: the paper is the only bright object on the screen, so it is the focal
   point in every section for free. This pane is the one place in Zone B that
   carries .paper-surface and the one shadow the system allows.

   TWO SURFACES, ONE OVERLAY.

     - A real file in play (a live scan of an upload or of a sample fetched
       from the backend) rasterises the actual page through PDF.js, so a
       bounding box sits on the glyphs it describes.

     - No file (demo mode replaying a fixture, or a renderer that could not
       open the document) falls back to a SYNTHETIC page in the same 612x792
       space, labelled as synthetic in the UI.

   BBoxOverlay is expressed in PDF user space as percentages of 612x792, so it
   sits correctly over either surface at any size. The overlay is the
   contract; the surface underneath it is an implementation detail — which is
   why swapping in the real page changed nothing about the boxes.

   §10.2's rule — a security tool must not silently present fabricated
   material as real — is why the caption below is driven by what is ACTUALLY
   on the canvas rather than by whether a file was supplied. A file that fails
   to render says so, in the same place, in its own words.
   ========================================================================= */

import * as React from "react";
import { BBoxOverlay } from "./BBoxOverlay";
import { PdfPage, type PdfPageStatus } from "./PdfPage";
import { MarkdownPage, type MarkdownPageStatus } from "./MarkdownPage";
import type { DocumentKind, Finding } from "@/lib/types";

export interface PageViewerProps {
  filename: string;
  /** Which surface to draw. A PDF gets a rasterised page with boxes on it; a
      Markdown document gets its own SOURCE with the flagged lines marked,
      because rendering the Markdown would hide exactly what the scan found.
      This comes from the response, never from the filename. */
  kind: DocumentKind;
  pages: number;
  page: number;
  onPageChange: (page: number) => void;
  findings: Finding[];
  selectedId: string | null;
  pulseKey: number;
  /** True while fixtures are serving. Drives the synthetic-page caption. */
  demo: boolean;
  /** The scanned document itself, when there is one. Absent in demo mode. */
  file?: File | null;
}

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
    <div className="sx-page-surface from-document" data-surface="synthetic">
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
  kind,
  pages,
  page,
  onPageChange,
  findings,
  selectedId,
  pulseKey,
  demo,
  file = null,
}: PageViewerProps) {
  const markdown = kind === "markdown";
  const clamped = Math.min(Math.max(1, page), Math.max(1, pages));
  // A PDF finding is anchored on a page, a Markdown finding on a line. The
  // count in the pane title is whichever of the two this document has.
  const onThisPage = markdown
    ? findings.filter((f) => f.line != null).length
    : findings.filter((f) => f.bbox?.page === clamped).length;

  const [render, setRender] = React.useState<
    PdfPageStatus | MarkdownPageStatus
  >({ kind: "loading" });
  // A new file is a new render attempt; without this reset, a file that
  // failed would keep its failure caption under the next document.
  React.useEffect(() => {
    setRender({ kind: "loading" });
  }, [file]);

  const boxes = markdown
    ? `${onThisPage} flagged line${onThisPage === 1 ? "" : "s"}`
    : `${onThisPage} finding bounding box${onThisPage === 1 ? "" : "es"}`;

  /* One decision, read by the aria-label, the caption and the surface, so
     the three can never describe different things. Markdown has no synthetic
     stand-in: greeked lines would say nothing about a document whose whole
     point is its literal text, so a source that cannot be read shows an empty
     surface and says why. */
  const surface: "document" | "source" | "synthetic" =
    file && render.kind !== "unavailable"
      ? markdown
        ? "source"
        : "document"
      : markdown
        ? "source"
        : "synthetic";

  /* The renderer's own words, ended with a full stop exactly once however
     the underlying library phrased them. */
  const reason =
    render.kind === "unavailable"
      ? /[.!?]$/.test(render.reason)
        ? render.reason
        : `${render.reason}.`
      : "The renderer is unavailable.";

  const label = markdown
    ? file && render.kind !== "unavailable"
      ? `The Markdown source of ${filename}, with ${boxes} marked in it.`
      : demo
        ? `Markdown source preview for ${filename} is unavailable in demo mode. ${boxes} are listed beside it.`
        : `The Markdown source of ${filename} could not be read. ${boxes} are still reported.`
    : surface === "document"
      ? `Page ${clamped} of ${pages} of ${filename}, rendered from the scanned file, with ${boxes} drawn on it.`
      : demo
        ? `Synthetic stand-in for page ${clamped} of ${pages} of ${filename}. ` +
          `${boxes} are drawn on it. ` +
          "Demo mode renders a placeholder page; the bounding boxes are the fixture's own coordinates."
        : `Synthetic stand-in for page ${clamped} of ${pages} of ${filename}, because the file could not be rendered. ` +
          `${boxes} are drawn on it, in the coordinates the scan reported.`;

  const note = markdown
    ? file && render.kind !== "unavailable"
      ? "The Markdown source itself, not its rendering. Rendering it would hide the very lines the scan flagged — a comment, a display:none span and a zero-width character all disappear on the page and survive into the text a model reads."
      : demo
        ? "Demo mode has no file to read. The findings are the fixture's own, anchored to source lines."
        : `The source could not be read — ${reason} The findings are still the scan's own, anchored to source lines.`
    : surface === "document"
      ? "The scanned page itself, rendered in your browser. Boxes are drawn in the PDF's own 612 × 792 point coordinate space."
      : demo
        ? "Demo mode renders a synthetic page. The boxes are the fixture's own coordinates in the PDF's 612 × 792 point space; the real page is rendered once a file is scanned."
        : `The page itself could not be rendered — ${reason} The boxes are still the scan's own coordinates, in the PDF's 612 × 792 point space.`;

  return (
    <div className="sx-page-wrap">
      <h2 className="sx-pane-title about-document">
        <span>{markdown ? "Source preview" : "Page preview"}</span>
        <span className="sx-pane-title-count from-document tabular">
          {markdown
            ? `${onThisPage} line${onThisPage === 1 ? "" : "s"}`
            : `${onThisPage} box${onThisPage === 1 ? "" : "es"}`}
        </span>
      </h2>

      <div
        className="sx-page paper-surface"
        data-surface={surface}
        data-kind={kind}
        role="img"
        aria-label={label}
      >
        {markdown ? (
          file ? (
            <MarkdownPage
              file={file}
              findings={findings}
              selectedId={selectedId}
              pulseKey={pulseKey}
              onStatus={setRender}
            />
          ) : (
            <div className="sx-page-surface sx-md-surface" data-surface="source" />
          )
        ) : (
          <>
            {file ? (
              <PdfPage file={file} page={clamped} onStatus={setRender} />
            ) : (
              <SyntheticPage page={clamped} />
            )}
            {/* A file that failed to open still gets a surface to annotate:
                the boxes are the scan's own finding, and withholding them
                because the picture is missing would hide a real result. */}
            {file && render.kind === "unavailable" && (
              <SyntheticPage page={clamped} />
            )}
            <BBoxOverlay
              page={clamped}
              findings={findings}
              selectedId={selectedId}
              pulseKey={pulseKey}
            />
          </>
        )}
      </div>

      {/* §6.1 — "◀ 1 / 12 ▶". Both controls clear the 24px target floor.
          Markdown is one continuous document, so there is nothing to page
          through: the source scrolls, and a pager that could only ever read
          "1 / 1" would be a control that does nothing. */}
      {!markdown && (
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
      )}

      <p className="sx-note about-document">{note}</p>
    </div>
  );
}
