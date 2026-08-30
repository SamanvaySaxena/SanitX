"use client";

/* =========================================================================
   Findings — FRONTEND_DESIGN.md §6.1, §3.2 law 2, §3.3, §7.3.
   -------------------------------------------------------------------------
   §7.3: "The findings list is a real list." Not a div tree with role="list"
   bolted on — a <ul> of <li>, one button per row, so the browser's own list
   semantics, count announcement and navigation all come for free.

   §6.1: "Selecting a finding scrolls the preview to its page, pulses its bbox
   once (120ms), and expands its evidence: reason codes, the offending span in
   mono, coordinates, matched signature category, MITRE technique where
   mapped."

   §3.3 governs every string below: the label, the span, the reason codes and
   the coordinates came out of the PDF or out of the analysis of it, so they
   are mono; the sentence SanitX writes about them is sans.
   ========================================================================= */

import * as React from "react";
import { Chip } from "@/components/primitives/Chip";
import { DETECTOR_NAMES, VECTORS } from "@/lib/vectors";
import type { Finding, Severity } from "@/lib/types";

/**
 * Severity carries colour + glyph + WORD, exactly as §3.2 law 2 requires of
 * every verdict on the site — "roughly 1 in 12 men cannot separate --review
 * from --blocked reliably." Position is the fourth channel: the list is
 * ordered by score descending, so the worst finding is always at the top and
 * severity is legible from rank alone.
 */
export const SEVERITY_PRESENTATION: Record<
  Severity,
  { glyph: string; word: string; tone: "blocked" | "review" | "safe" }
> = {
  critical: { glyph: "●", word: "CRITICAL", tone: "blocked" },
  high: { glyph: "●", word: "HIGH", tone: "blocked" },
  medium: { glyph: "▲", word: "MEDIUM", tone: "review" },
  low: { glyph: "▲", word: "LOW", tone: "review" },
  info: { glyph: "✓", word: "INFO", tone: "safe" },
};

const vectorName = (id: Finding["vector"]): string =>
  VECTORS.find((v) => v.id === id)?.name ?? DETECTOR_NAMES[id] ?? id;

export const findingRowId = (id: string) => `sx-finding-${id}`;
export const findingPanelId = (id: string) => `sx-evidence-${id}`;

export interface FindingsListProps {
  findings: Finding[];
  selectedId: string | null;
  expandedId: string | null;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  /** Bumped by Scanner when the selection moved by keyboard (j / k / palette),
      so focus follows the caret without stealing it on a mouse click. */
  focusKey: number;
  /** Governs the empty copy: "none yet" during a scan is not "none found". */
  scanning: boolean;
  settled: boolean;
}

export function FindingsList({
  findings,
  selectedId,
  expandedId,
  onSelect,
  onToggleExpand,
  focusKey,
  scanning,
  settled,
}: FindingsListProps) {
  const firstRender = React.useRef(true);

  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!selectedId) return;
    const el = document.getElementById(findingRowId(selectedId));
    // jsdom implements neither, and a missing scroller must never break
    // keyboard navigation.
    el?.focus?.();
    el?.scrollIntoView?.({ block: "nearest" });
    // focusKey is the trigger; selectedId is read, not watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  return (
    <>
      <h2 className="sx-pane-title about-document">
        <span>Findings</span>
        <span className="sx-pane-title-count from-document tabular">
          {findings.length}
        </span>
      </h2>

      {findings.length === 0 ? (
        <p className="sx-note about-document">
          {scanning
            ? "No findings yet — Phase 2 has not reported."
            : settled
              ? "No findings. Every check below ran and returned nothing."
              : "No document scanned yet."}
        </p>
      ) : (
        <ul className="sx-findings">
          {findings.map((f) => {
            const sev = SEVERITY_PRESENTATION[f.severity];
            const selected = f.id === selectedId;
            const expanded = f.id === expandedId;
            return (
              <li
                key={f.id}
                className="sx-finding"
                data-selected={selected ? "true" : "false"}
                data-finding={f.id}
              >
                <button
                  type="button"
                  id={findingRowId(f.id)}
                  className="sx-finding-row"
                  aria-expanded={expanded}
                  aria-controls={findingPanelId(f.id)}
                  onClick={() => {
                    onSelect(f.id);
                    onToggleExpand(f.id);
                  }}
                >
                  <span className="sx-finding-page from-document tabular">
                    p{f.page}
                  </span>
                  {/* The label is a PDF operator or object name — mono (§3.3). */}
                  <span className="sx-finding-label from-document">{f.label}</span>
                  <span className="sx-sev" data-tone={sev.tone}>
                    <span aria-hidden="true">{sev.glyph}</span>
                    <span>{sev.word}</span>
                  </span>
                  <span className="sx-finding-score from-document tabular">
                    {f.score.toFixed(2)}
                  </span>
                </button>

                {expanded && (
                  <div className="sx-evidence" id={findingPanelId(f.id)}>
                    <div className="sx-evidence-group">
                      <span className="sx-evidence-key about-document">Vector</span>
                      <span className="about-document sx-strong">
                        {vectorName(f.vector)}
                      </span>{" "}
                      <span className="from-document">{f.vector}</span>
                    </div>

                    <div className="sx-evidence-group">
                      <span className="sx-evidence-key about-document">
                        Reason codes
                      </span>
                      <span className="sx-chips">
                        {f.reasonCodes.map((c) => (
                          <Chip key={c} tone="accent">
                            {c}
                          </Chip>
                        ))}
                      </span>
                    </div>

                    <div className="sx-evidence-group">
                      <span className="sx-evidence-key about-document">
                        Offending span
                      </span>
                      {f.snippet ? (
                        // Verbatim from the document, therefore mono (§3.3).
                        <pre className="sx-span from-document">{f.snippet}</pre>
                      ) : (
                        <p className="sx-detail about-document">
                          No text span — this finding is carried by a non-text
                          channel.
                        </p>
                      )}
                    </div>

                    <div className="sx-evidence-group">
                      <span className="sx-evidence-key about-document">
                        Coordinates
                      </span>
                      {f.bbox ? (
                        <span className="sx-coords from-document tabular">
                          page {f.bbox.page} · x0 {f.bbox.x0} · y0 {f.bbox.y0} ·
                          x1 {f.bbox.x1} · y1 {f.bbox.y1}
                          <span className="about-document"> (612 × 792 pt)</span>
                        </span>
                      ) : (
                        <span className="sx-coords about-document">
                          No page geometry — this finding has no bounding box.
                        </span>
                      )}
                    </div>

                    <div className="sx-evidence-group">
                      <span className="sx-evidence-key about-document">
                        MITRE ATT&amp;CK
                      </span>
                      {f.mitre ? (
                        <Chip tone="neutral">{f.mitre}</Chip>
                      ) : (
                        <span className="about-document sx-coords">
                          Not mapped.
                        </span>
                      )}
                    </div>

                    <div className="sx-evidence-group">
                      <span className="sx-evidence-key about-document">Detail</span>
                      {/* What SanitX says about the document — sans (§3.3). */}
                      <p className="sx-detail about-document">{f.detail}</p>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
