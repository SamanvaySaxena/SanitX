/* =========================================================================
   The phase ledger — FRONTEND_DESIGN.md §6.2.
   -------------------------------------------------------------------------
   "Do not show a spinner for eight seconds. Stream the phases over SSE and
   render each as it completes… A spinner communicates nothing and feels
   broken; a phase ledger filling in communicates thoroughness and feels fast,
   at identical real latency."

   Three consequences shape this component:

   1. All six rows are present from the first frame, seeded `pending`. The
      user sees the SHAPE of the work immediately — that is what replaces the
      spinner, and it is why this renders before any data arrives.
   2. It PERSISTS after completion as the per-phase timing breakdown (§6.2
      final line). It is not a progress bar that disappears.
   3. §6.3 fail-closed messaging lives in the row, in those exact words:
      `PHASE 3 · FAILED → REVIEW`. Never a generic red toast.

   §11 bans animated number counters in Zone B, so the millisecond readouts
   are printed, not tweened.
   ========================================================================= */
import * as React from "react";
import type { Phase } from "@/lib/types";

/** Status glyph. §3.2 law 2 — never colour alone; the glyph and the row's
    text carry the state for anyone who cannot separate the hues. */
const GLYPH: Record<Phase["status"], string> = {
  pending: "·",
  running: "▸",
  complete: "✓",
  failed: "✕",
};

const WORD: Record<Phase["status"], string> = {
  pending: "pending",
  running: "running",
  complete: "complete",
  failed: "failed",
};

export interface PhaseLedgerProps {
  phases: Phase[];
  /** Total wall time, printed once the run settles. */
  totalMs?: number | null;
}

export function PhaseLedger({ phases, totalMs = null }: PhaseLedgerProps) {
  const done = phases.filter((p) => p.status === "complete").length;

  return (
    <div className="sx-section">
      <h3 className="sx-pane-title" id="sx-ledger-title">
        <span>Phases</span>
        <span className="sx-pane-title-count from-document tabular">
          {done} / {phases.length}
        </span>
      </h3>

      {/* A real list (§7.3). aria-live is deliberately absent: the rows are
          read on demand, and the single completion announcement is made by
          the Scanner's status line rather than by six competing regions. */}
      <ol className="sx-ledger from-document" aria-labelledby="sx-ledger-title">
        {phases.map((p) => (
          <li key={p.id} className="sx-phase" data-status={p.status}>
            <span aria-hidden="true">{GLYPH[p.status]}</span>

            <span className="sx-phase-name">
              <span className="sx-strong">
                PHASE {p.id}
              </span>{" "}
              · {p.name}

              {p.status === "failed" ? (
                /* §6.3, verbatim: the row says PHASE n · FAILED → REVIEW. */
                <span className="sx-phase-readout">
                  FAILED → REVIEW · {p.error ?? "No reason reported."}
                </span>
              ) : p.readout ? (
                <span className="sx-phase-readout">{p.readout}</span>
              ) : null}
            </span>

            {/* Status as a WORD, visibly. §7.1 treats visually-hidden text as
                a blocking defect on this product of all products, so the
                glyph's meaning is printed rather than hidden in an sr-only
                span — sighted and screen-reader users read the same row. */}
            <span className="sx-phase-ms tabular">
              {WORD[p.status]}
              {p.ms === null ? "" : ` · ${p.ms} ms`}
            </span>
          </li>
        ))}
      </ol>

      {totalMs !== null && (
        <p className="sx-note from-document tabular">
          total <span className="sx-strong">{totalMs} ms</span>
        </p>
      )}
    </div>
  );
}
