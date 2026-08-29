"use client";

/* =========================================================================
   The empty state — FRONTEND_DESIGN.md §6.5, and all of §6.3.
   -------------------------------------------------------------------------
   §6.5: "drop zone, three sample documents (clean / borderline / malicious),
   and the size and page caps stated BEFORE upload rather than in an error."

   §6.3 is implemented in full, in order, before anything leaves the browser:
     - size / MIME checked against the SAME constants the API enforces, and
       the refusal names the actual limit — "never after a 40-second upload"
     - the magic header is verified client-side, so a .pdf that is not a PDF
       is caught here rather than by the parser

   The refusal is a persistent region, not a toast. A message that vanishes is
   one you cannot re-read while you fix the file, and §6.3 bans the generic
   red toast outright.
   ========================================================================= */

import * as React from "react";
import { LIMITS, formatBytes, precheckFile, verifyMagicHeader } from "@/lib/api";
import {
  SAMPLES,
  SAMPLE_LABELS,
  SAMPLE_ORDER,
  type SampleId,
} from "@/lib/fixtures/scans";
import { VERDICT_PRESENTATION } from "@/lib/scoring";

export interface DropZoneProps {
  onSample: (id: SampleId) => void;
  /** Called only after BOTH client-side gates pass (§6.3). */
  onAccept: (file: File) => void;
  disabled?: boolean;
}

export function DropZone({ onSample, onAccept, disabled = false }: DropZoneProps) {
  const [drag, setDrag] = React.useState(false);
  const [refusal, setRefusal] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const handle = React.useCallback(
    async (file: File | undefined | null) => {
      if (!file) return;
      setRefusal(null);

      // Cheap synchronous gates first: extension, MIME and size.
      const pre = precheckFile(file);
      if (!pre.ok) {
        setRefusal(pre.reason);
        return;
      }

      // Then the magic header. Reading five bytes is still cheaper than an
      // upload by four orders of magnitude.
      const magic = await verifyMagicHeader(file);
      if (!magic.ok) {
        setRefusal(magic.reason);
        return;
      }

      onAccept(file);
    },
    [onAccept],
  );

  return (
    <div className="sx-empty">
      <div>
        <div
          className="sx-dropzone"
          data-drag={drag ? "true" : "false"}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void handle(e.dataTransfer?.files?.[0]);
          }}
        >
          {/* The real control covers the whole zone, so a click anywhere opens
              the picker while keyboard and screen-reader behaviour stay
              native. The focus ring is drawn on the parent via :focus-within
              — never outline: none (§6.4). */}
          <input
            ref={inputRef}
            id="sx-file"
            className="sx-file-input"
            type="file"
            accept="application/pdf,.pdf"
            disabled={disabled}
            aria-describedby="sx-caps"
            onChange={(e) => {
              void handle(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <label htmlFor="sx-file" className="sx-dropzone-title about-document">
            Choose a PDF, or drop one here
          </label>

          {/* §6.5 — the caps are stated BEFORE upload. This list is the whole
              point of the empty state, so it is not a tooltip or a footnote. */}
          <ul className="sx-caps about-document" id="sx-caps">
            <li>
              PDF only — <span className="from-document">%PDF-</span> header
              verified in your browser
            </li>
            <li>
              Up to <span className="from-document tabular">{formatBytes(LIMITS.maxBytes)}</span>
            </li>
            <li>
              Up to <span className="from-document tabular">{LIMITS.maxPages}</span> pages
            </li>
          </ul>
          <p className="sx-note about-document">
            Nothing is uploaded until these three checks pass.
          </p>
        </div>

        {refusal && (
          <p className="sx-refusal about-document" role="alert">
            {refusal}
          </p>
        )}
      </div>

      <div>
        <span className="sx-label about-document">Sample documents</span>
        <ul className="sx-samples">
          {SAMPLE_ORDER.map((id) => {
            const s = SAMPLES[id];
            const pres = VERDICT_PRESENTATION[s.verdict];
            return (
              <li key={id}>
                <button
                  type="button"
                  className="sx-sample"
                  disabled={disabled}
                  onClick={() => onSample(id)}
                >
                  <span>
                    <span className="sx-sample-name about-document">
                      {SAMPLE_LABELS[id]}
                    </span>
                    <span className="sx-sample-meta from-document tabular">
                      {s.document.filename} · {s.document.pages} pages ·{" "}
                      {formatBytes(s.document.bytes)}
                    </span>
                  </span>
                  {/* Colour + glyph + word, on the sample card too (§3.2 law 2). */}
                  <span
                    className="sx-sev"
                    style={{ color: pres.token }}
                    data-verdict={s.verdict}
                  >
                    <span aria-hidden="true">{pres.glyph}</span>
                    <span>{pres.word}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="sx-note about-document">
          Each sample is a complete, hand-authored fixture response — the same
          shape the API returns. Loading one reaches a real verdict without
          possessing a malicious PDF.
        </p>
      </div>
    </div>
  );
}
