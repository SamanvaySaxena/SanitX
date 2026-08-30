"use client";

/* =========================================================================
   Act 4 — the discrepancy gate. FRONTEND_DESIGN.md §5.4. ★ the money shot.
   -------------------------------------------------------------------------
   PIPELINE_IMPROVEMENTS §6 calls this "the most demonstrable single feature
   in the entire plan: two columns of text that should be identical and are
   not." §5.4 gives it the most scroll on the site and §10.3 builds it BEFORE
   Act 3 — "more persuasive, less work."

   FOUR THINGS THIS FILE HAS TO GET RIGHT.

   1. THE GROUND INVERTS (§5.4). Both panes are already paper, so on the dark
      ground they read as two bright rectangles floating in a void — the §3.1
      rule against a second bright surface, violated twice. `data-ground=
      "paper"` swaps the token set for this section only. The light-ground
      verdict triad is authored in tokens.css and held to the AA floor by
      test/tokens.contrast.test.ts, because §5.4 warns this is "the most
      likely place for an accessibility regression on the whole site."

   2. THE NUMBERS ARE COMPUTED, NOT CANNED (§5.4, §5.9). "Let the reader scrub
      backwards and watch the metrics climb again. Reversibility signals that
      these are computed values, not a canned video, and engineers will test
      exactly this." So progress drives `lerp` in both directions and nothing
      is a keyframe.

   3. THE DATA IS THE CONTRACT (§9.3). Both columns come from the `Divergence`
      on the malicious fixture — the same object the scanner's own
      DivergencePanel renders. The narrative site cannot show a divergence the
      API could not produce.

   4. THE STATIC COMPOSITION CARRIES THE ARGUMENT (§7.2). "The test: read the
      site with motion off and check that no claim has gone missing. If Act
      4's divergence is only legible while scrubbing, the animation is
      carrying content and the scene must be restructured." So the initial
      render IS the end state — every line resolved, both metrics at final
      values, the divider red, the conclusion visible. The timeline, if it is
      created at all, rewinds and plays forward. A reader with motion off, or
      with JavaScript off, loses the scrub and nothing else.
   ========================================================================= */

import * as React from "react";
import { createPinnedScene, lerp } from "@/lib/motion/timeline";
import { MALICIOUS } from "@/lib/fixtures/scans";
import type { Divergence } from "@/lib/types";

/* The fixture is the source. If it ever loses its divergence this act does
   not invent one — it renders nothing, which is the correct failure for a
   section whose whole claim is "here are two real columns". */
const DIVERGENCE: Divergence | null = MALICIOUS.divergence;

/** Both columns zipped by index. A row with a right side and no left side is
    the injection: in the file, not on the page. */
interface Row {
  rendered: string | null;
  extracted: string | null;
  injected: boolean;
}

function rowsOf(d: Divergence): Row[] {
  const n = Math.max(d.rendered.length, d.extracted.length);
  return Array.from({ length: n }, (_, i) => {
    const rendered = d.rendered[i] ?? null;
    const extracted = d.extracted[i] ?? null;
    return {
      rendered,
      extracted,
      injected: rendered === null && extracted !== null,
    };
  });
}

/** Writes a scrubbed metric straight to the DOM. Deliberately not React
    state: §8's INP budget does not survive a setState on every scroll tick,
    and §5.4's counters are display, not application state. */
function writeMetric(
  el: HTMLElement | null,
  value: number,
  threshold: number,
): void {
  if (!el) return;
  el.textContent = value.toFixed(2);
  el.dataset.fail = String(value < threshold);
}

/* Metrics start at 1.00 — identical — and fall to the fixture's values as the
   scene scrubs. That start is the premise the reader is about to lose. */
const START = 1;

export function DiscrepancyGate() {
  const sectionRef = React.useRef<HTMLElement | null>(null);
  const stickyRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const section = sectionRef.current;
    const sticky = stickyRef.current;
    const d = DIVERGENCE;
    if (!section || !sticky || !d) return;

    const rows = rowsOf(d);
    let cancelled = false;
    let teardown: (() => void) | null = null;

    void (async () => {
      const t = await createPinnedScene({
        pinTarget: section,
        // §5.4 gives this act the most scroll on the site.
        end: "+=400%",
        willChangeTargets: [sticky],
        build: ({ tl }) => {
          const lineEls = Array.from(
            sticky.querySelectorAll<HTMLElement>("[data-line]"),
          );
          const jaccardEl =
            sticky.querySelector<HTMLElement>("[data-metric='jaccard']");
          const cosineEl =
            sticky.querySelector<HTMLElement>("[data-metric='cosine']");
          const panesEl = sticky.querySelector<HTMLElement>("[data-panes]");
          const conclusionEl =
            sticky.querySelector<HTMLElement>("[data-conclusion]");

          /* Rewind to the start of the argument. This is the ONLY place the
             end-state markup is disturbed, and it happens after first paint,
             so §7.2's static composition is what a reader without this
             timeline sees. */
          for (const el of lineEls) el.dataset.state = "idle";
          if (panesEl) panesEl.dataset.diverged = "false";
          if (conclusionEl) conclusionEl.dataset.state = "pending";
          writeMetric(jaccardEl, START, d.jaccardThreshold);
          writeMetric(cosineEl, START, d.cosineThreshold);

          /* Lines pair-highlight top to bottom (§5.4). Each tween writes an
             attribute — no layout property is touched inside the scrub. */
          rows.forEach((row, i) => {
            const pair = lineEls.filter((el) => el.dataset.line === String(i));
            tl.to(
              {},
              {
                duration: 1,
                onUpdate: () => {
                  for (const el of pair) {
                    el.dataset.state = row.injected
                      ? el.dataset.side === "extracted"
                        ? "injected"
                        : "void"
                      : "matched";
                  }
                },
              },
              i,
            );
          });

          /* The metrics count down bound to scroll progress, and climb again
             on a backwards scrub because lerp is a pure function of t. */
          const counter = { t: 0 };
          tl.to(
            counter,
            {
              t: 1,
              duration: rows.length,
              onUpdate: () => {
                const j = lerp(START, d.jaccard, counter.t);
                const c = lerp(START, d.cosine, counter.t);
                writeMetric(jaccardEl, j, d.jaccardThreshold);
                writeMetric(cosineEl, c, d.cosineThreshold);
                const failing = j < d.jaccardThreshold && c < d.cosineThreshold;
                if (panesEl) panesEl.dataset.diverged = String(failing);
                if (conclusionEl) {
                  conclusionEl.dataset.state = failing ? "landed" : "pending";
                }
              },
            },
            0,
          );
        },
      });
      if (cancelled) t();
      else teardown = t;
    })();

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, []);

  if (!DIVERGENCE) return null;
  const d = DIVERGENCE;
  const rows = rowsOf(d);
  const jFail = d.jaccard < d.jaccardThreshold;
  const cFail = d.cosine < d.cosineThreshold;

  return (
    <section
      id="discrepancy"
      ref={sectionRef}
      className="gate"
      /* §5.4's one-section ground inversion. Every colour beneath this
         attribute resolves through the light triad in tokens.css. */
      data-ground="paper"
      data-act="discrepancy"
      aria-labelledby="gate-heading"
    >
      <div className="gate-sticky" ref={stickyRef}>
        <div className="gate-inner">
          <h2 id="gate-heading" className="gate-head about-document">
            The two should say the same thing.
          </h2>

          <div className="gate-panes" data-panes data-diverged="true">
            <div className="gate-pane">
              <p className="gate-pane-head">
                <span className="gate-pane-name from-document">RENDERED</span>
                <span className="gate-pane-sub about-document">
                  what a person reads
                </span>
              </p>
              {rows.map((row, i) => (
                <p
                  key={`r${i}`}
                  className="gate-line"
                  data-line={i}
                  data-side="rendered"
                  data-state={row.injected ? "void" : "matched"}
                >
                  {/* The small --safe tick between matching pairs (§5.4). */}
                  <span className="gate-tick" aria-hidden="true">
                    {row.injected ? "" : "✓"}
                  </span>
                  {row.rendered ?? "— not on the page —"}
                </p>
              ))}
            </div>

            <div className="gate-pane">
              <p className="gate-pane-head">
                <span className="gate-pane-name from-document">EXTRACTED</span>
                <span className="gate-pane-sub about-document">
                  what the model ingests
                </span>
              </p>
              {rows.map((row, i) => (
                <p
                  key={`e${i}`}
                  className="gate-line"
                  data-line={i}
                  data-side="extracted"
                  data-state={row.injected ? "injected" : "matched"}
                >
                  <span className="gate-tick" aria-hidden="true" />
                  <span>
                    {row.extracted ?? "—"}
                    {/* §3.2 law 2 — named in words, never only in red. */}
                    {row.injected && (
                      <span className="gate-tag">in file, not on page</span>
                    )}
                  </span>
                </p>
              ))}
            </div>
          </div>

          {/* §7.3 — scrubbed counters use aria-live="off". A live region that
              fires on every scroll frame is unusable. The final values are in
              the static markup, so a screen reader reads the settled numbers
              on arrival rather than a stream of intermediate ones. */}
          <dl className="gate-metrics" aria-live="off">
            <Metric
              id="jaccard"
              name="Jaccard"
              value={d.jaccard}
              threshold={d.jaccardThreshold}
              fail={jFail}
            />
            <Metric
              id="cosine"
              name="Cosine"
              value={d.cosine}
              threshold={d.cosineThreshold}
              fail={cFail}
            />
          </dl>

          <p
            className="gate-conclusion about-document"
            data-conclusion
            data-state={jFail && cFail ? "landed" : "pending"}
          >
            Failing both metrics is a definitive structural-manipulation
            signal.
          </p>

          <p className="gate-note about-document">
            Lexical overlap and semantic invariance, computed over the rendered
            pixmap and the cleaned corpus. Scrub back up and the numbers climb
            again — they are calculated from the pair above, not played.
          </p>
        </div>
      </div>
    </section>
  );
}

function Metric({
  id,
  name,
  value,
  threshold,
  fail,
}: {
  id: string;
  name: string;
  value: number;
  threshold: number;
  fail: boolean;
}) {
  return (
    <div className="gate-metric">
      <dt className="gate-metric-name">{name}</dt>
      <dd className="gate-metric">
        <span className="gate-metric-value" data-metric={id} data-fail={fail}>
          {value.toFixed(2)}
        </span>
        <span className="gate-metric-thresh">
          threshold {threshold.toFixed(2)}
        </span>
      </dd>
    </div>
  );
}
