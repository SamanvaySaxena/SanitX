/* =========================================================================
   The divergence panel — FRONTEND_DESIGN.md §6.1, §10.1 ("Scanner:
   divergence panel — Stage 3"), and the in-product form of Act 4 (§5.4).
   -------------------------------------------------------------------------
   PIPELINE_IMPROVEMENTS §6 calls this "the most demonstrable single feature
   in the entire plan: two columns of text that should be identical and are
   not." In the narrative site it gets 400vh and a light inversion. Here it
   gets a pane, because Zone B sells nothing (§11) — the user already
   converted and wants the finding, not the argument.

   What is shared with Act 4 is the DATA, not the presentation: both render
   `Divergence` from lib/types, so the site cannot show a divergence the
   contract cannot produce (§9.3).

   Line pairing rule: the two columns are zipped by index. A line present on
   the right with no counterpart on the left is the injection — it is in the
   file and not on the page — and it is marked as such in text, not only in
   colour (§3.2 law 2).
   ========================================================================= */
import * as React from "react";
import type { Divergence } from "@/lib/types";

/** Below a threshold the metric is a failure, not a low number. Both are
    printed with their thresholds so the reader can check the call. */
const failed = (value: number, threshold: number) => value < threshold;

export interface DivergencePanelProps {
  divergence: Divergence | null;
  /** True while phase 3 has not landed yet — "not computed" is not "clean". */
  pending: boolean;
}

export function DivergencePanel({ divergence, pending }: DivergencePanelProps) {
  if (!divergence) {
    return (
      <div className="sx-section">
        <h3 className="sx-label">Render / extract divergence</h3>
        <p className="sx-note">
          {pending
            ? "Phase 3 has not completed. No comparison has been made yet."
            : "Not computed for this document."}
        </p>
      </div>
    );
  }

  const { rendered, extracted, jaccard, cosine } = divergence;
  const rows = Math.max(rendered.length, extracted.length);
  const jFail = failed(jaccard, divergence.jaccardThreshold);
  const cFail = failed(cosine, divergence.cosineThreshold);

  return (
    <div className="sx-section">
      <h3 className="sx-label">Render / extract divergence</h3>

      {/* Column headers say what each side IS, not just what it is called.
          "what a person reads" / "what the model ingests" is the whole
          argument in eight words (§5.4). */}
      <div className="sx-diverge from-document" data-diverged={jFail || cFail}>
        <div className="sx-diverge-head">
          <span className="sx-strong">RENDERED</span>
          <span className="sx-diverge-sub">what a person reads</span>
        </div>
        <div className="sx-diverge-head">
          <span className="sx-strong">EXTRACTED</span>
          <span className="sx-diverge-sub">what the model ingests</span>
        </div>

        {Array.from({ length: rows }, (_, i) => {
          const l = rendered[i] ?? null;
          const r = extracted[i] ?? null;
          const injected = l === null && r !== null;
          return (
            <React.Fragment key={i}>
              <p className="sx-diverge-line" data-state={injected ? "absent" : "match"}>
                {l ?? <span className="sx-diverge-void">— not on the page —</span>}
              </p>
              <p
                className="sx-diverge-line"
                data-state={injected ? "injected" : "match"}
              >
                {r ?? <span className="sx-diverge-void">—</span>}
                {injected && (
                  <span className="sx-diverge-tag">in file, not on page</span>
                )}
              </p>
            </React.Fragment>
          );
        })}
      </div>

      {/* Metrics, each beside its threshold. Printed, not animated — §11 bans
          animated counters in Zone B. */}
      <dl className="sx-metrics from-document tabular">
        <div>
          <dt>Jaccard</dt>
          <dd data-fail={jFail}>
            {jaccard.toFixed(2)}{" "}
            <span className="sx-metric-thresh">
              {jFail ? "<" : "≥"} {divergence.jaccardThreshold.toFixed(2)}
              {jFail ? " · fails" : " · passes"}
            </span>
          </dd>
        </div>
        <div>
          <dt>Cosine</dt>
          <dd data-fail={cFail}>
            {cosine.toFixed(2)}{" "}
            <span className="sx-metric-thresh">
              {cFail ? "<" : "≥"} {divergence.cosineThreshold.toFixed(2)}
              {cFail ? " · fails" : " · passes"}
            </span>
          </dd>
        </div>
      </dl>

      {jFail && cFail && (
        <p className="sx-note sx-strong">
          Failing both metrics is a definitive structural-manipulation signal.
        </p>
      )}
    </div>
  );
}
