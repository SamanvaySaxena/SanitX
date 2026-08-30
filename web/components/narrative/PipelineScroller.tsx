"use client";

/* =========================================================================
   Act 3 — the pipeline. §5.3 (pinned, 600vh) — GSAP.
   -------------------------------------------------------------------------
   "The structural centrepiece. Six phases of PIPELINE_IMPROVEMENTS §5, one
   document travelling through all of them."

   THE RULE FOR THIS ACT (§5.3, Rev 2): "the sticky pane is the real scanner
   UI, not a drawing of it. Each scene advances the ACTUAL PRODUCT through the
   state it would be in at that phase — the same components Zone B ships,
   driven by fixture data. The user is watching a real scan, slowed down and
   narrated."

   So the sticky pane below is composed of PhaseLedger, PageViewer,
   FindingsList and VerdictPanel — the exact components /scan renders. Not
   copies, not simplified variants. Three things that buys (§5.3):

     1. It cannot lie. A screen rendered from the real component against the
        real response schema can only show fields that exist (§9.3).
     2. It is less work. Act 3 stops being six bespoke animations and becomes
        six states of components already built.
     3. It makes Act 7 land, because the visitor has already watched the tool
        work by the time they reach it.

   WHY THIS IS A COMPOSITION AND NOT `<Scanner>`: Scanner owns a state machine
   driven by a stream (§6.2). Act 3 needs that state driven by SCROLL instead.
   Feeding it a fake stream would make the narration hostage to timing rather
   than to the reader's finger, which is the one thing a scrubbed scene must
   never be. So this file assembles the same leaf components against a scene
   index. The leaves are shared; only the driver differs.

   §7.2 — THE STATIC COMPOSITION. The right column renders all six phase
   blocks, stacked and readable at all times, and the sticky pane defaults to
   the FINAL scene. A reader with motion off, or with JavaScript off, gets the
   complete narration and the finished scan — which is what §5.3's "six
   stacked cards" fallback asks for. The timeline, when created, rewinds to
   scene 1 and plays forward.

   §10.3 names this act cuttable, which is why it is a leaf import in page.tsx
   and touches no other act.
   ========================================================================= */

import * as React from "react";
import { createPinnedScene } from "@/lib/motion/timeline";
import { PhaseLedger } from "@/components/scanner/PhaseLedger";
import { PageViewer } from "@/components/scanner/PageViewer";
import { FindingsList } from "@/components/scanner/FindingsList";
import { VerdictPanel } from "@/components/scanner/VerdictPanel";
import { MALICIOUS } from "@/lib/fixtures/scans";
import type { PhaseId } from "@/lib/types";

/* -------------------------------------------------------------------------
   The six scenes, from §5.3's table. Each readout is quoted from the
   fixture's own phase row rather than retyped, so narration and product agree.
   ------------------------------------------------------------------------- */
interface Scene {
  id: PhaseId;
  title: string;
  copy: string;
}

const SCENES: Scene[] = [
  {
    id: 1,
    title: "Hardened ingestion",
    copy: "Before anything is read, the file is bounded and stripped. Size, page count and compression ratio are checked against fixed caps, and every active-content object — JavaScript, embedded files, launch actions, auto-actions — is removed and listed by name. A decompression bomb never reaches the parser, because the ratio check runs before the parse does.",
  },
  {
    id: 2,
    title: "Structural scan",
    copy: "Every span on every page is examined in its own graphics state: render mode, fill alpha, colour against its background, font size, position relative to the crop box, and z-order against whatever is drawn over it. Benign spans never get a box on the preview — only the anomalies do, which is what keeps the page legible at 1,284 spans.",
  },
  {
    id: 3,
    title: "Discrepancy gate",
    copy: "The page is rasterised and read back with OCR — what a person sees — then compared against the cleaned corpus a model would ingest. Lexical overlap and semantic invariance are computed over the pair. This is the only check that catches a CMap remap or an /ActualText override, because both are invisible to anything inspecting the file alone.",
  },
  {
    id: 4,
    title: "Semantic scan",
    copy: "Three tiers, cheapest first. Deterministic signatures resolve the overwhelming majority; a local classifier takes what survives; the generative evaluator sees only what the first two could not settle. That ordering is a cost architecture and an injection-resistance argument at once — the model that could itself be manipulated is the last resort, not the first.",
  },
  {
    id: 5,
    title: "Risk scoring",
    copy: "The three component scores are weighted into one composite R, and R falls into a band. The weights are a deployment decision rather than a fact: a hiring pipeline and a hospital ingestion queue should not share a blocking threshold. The boundaries are proposed, and pending calibration against a corpus that does not exist yet.",
  },
  {
    id: 6,
    title: "Response",
    copy: "One typed response, streamed phase by phase and complete at the end: verdict, composite score, component scores, every finding with its coordinates and reason codes, per-phase timings, and the divergence pair. This is the literal JSON a caller receives — the same object every screen above was rendered from.",
  },
];

const LAST = SCENES.length;

/** The fixture's state as of scene N: phases 1..N complete, the rest pending,
    and only the results those phases would have produced by then. */
function stateAt(scene: number) {
  return {
    phases: MALICIOUS.phases.map((p) =>
      p.id <= scene
        ? p
        : { ...p, status: "pending" as const, ms: null, readout: null },
    ),
    // Findings land with phase 2, the divergence with 3, the tiers with 4.
    findings: scene >= 2 ? MALICIOUS.findings : [],
    divergence: scene >= 3 ? MALICIOUS.divergence : null,
    tiers: scene >= 4 ? MALICIOUS.tiers : null,
    // The verdict assembles last (§6.2), so the panel settles only at 5+.
    response: scene >= 5 ? MALICIOUS : null,
  };
}

export function PipelineScroller() {
  const sectionRef = React.useRef<HTMLElement | null>(null);
  const stickyRef = React.useRef<HTMLDivElement | null>(null);

  /* §7.2 — the static composition is the FINISHED scan. */
  const [scene, setScene] = React.useState(LAST);

  React.useEffect(() => {
    const section = sectionRef.current;
    const sticky = stickyRef.current;
    if (!section || !sticky) return;

    let cancelled = false;
    let teardown: (() => void) | null = null;

    void (async () => {
      const t = await createPinnedScene({
        pinTarget: section,
        // §5.3 — 600vh, one hundred per scene.
        end: "+=600%",
        willChangeTargets: [sticky],
        build: ({ tl }) => {
          // Rewind past first paint, so the static render stands alone.
          setScene(1);

          /* One step per scene. setScene fires at most six times across the
             whole scroll — a discrete advance, not a per-frame render, so
             §8's INP budget is never in play. */
          SCENES.forEach((s, i) => {
            tl.to({}, { duration: 1, onUpdate: () => setScene(s.id) }, i);
          });
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

  const s = stateAt(scene);
  const doc = MALICIOUS.document;

  return (
    <section
      id="pipeline"
      ref={sectionRef}
      className="pipe"
      aria-labelledby="pipe-heading"
    >
      <div className="pipe-inner">
        <h2 id="pipe-heading" className="pipe-head about-document">
          One document, six phases.
        </h2>

        <div className="pipe-cols">
          {/* ---- The sticky pane: the REAL scanner UI (§5.3). ---------- */}
          <div className="pipe-sticky" ref={stickyRef}>
            {/* aria-hidden because the narration beside it carries the same
                argument in prose, and a screen reader walking a scrubbed
                product screen would hear the findings list six times over.
                §7.2's content test is met by the right column, which is the
                accessible path through this act. */}
            <div className="pipe-ui sx-root" aria-hidden="true">
              <div className="pipe-ui-head">
                <span className="sx-wordmark">SanitX</span>
                <span className="sx-docmeta from-document">
                  {doc.filename} · {doc.pages} pages
                </span>
                <span className="pipe-scene from-document tabular">
                  PHASE {scene} / {LAST}
                </span>
              </div>

              <div className="pipe-ui-body">
                <div className="pipe-ui-pane">
                  <PhaseLedger
                    phases={s.phases}
                    totalMs={scene >= LAST ? MALICIOUS.totalMs : null}
                  />
                  {scene >= 2 && (
                    <PageViewer
                      filename={doc.filename}
                      pages={doc.pages}
                      page={1}
                      onPageChange={() => {}}
                      findings={s.findings}
                      selectedId={null}
                      pulseKey={scene}
                      demo
                    />
                  )}
                </div>

                <div className="pipe-ui-pane">
                  {scene >= 2 && (
                    <>
                      <h3 className="sx-pane-title">
                        <span>Findings</span>
                        <span className="sx-pane-title-count from-document tabular">
                          {s.findings.length}
                        </span>
                      </h3>
                      <FindingsList
                        findings={s.findings}
                        selectedId={null}
                        expandedId={null}
                        onSelect={() => {}}
                        onToggleExpand={() => {}}
                        focusKey={0}
                        scanning={false}
                        settled={scene >= LAST}
                      />
                    </>
                  )}
                  {scene >= 3 && (
                    <VerdictPanel
                      status={scene >= 5 ? "complete" : "scanning"}
                      response={s.response}
                      divergence={s.divergence}
                      tiers={s.tiers}
                      failure={null}
                      demo
                      onExportJson={() => {}}
                      copied={false}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ---- The narration. All six blocks, always readable. ------- */}
          <ol className="pipe-copy">
            {SCENES.map((sc) => {
              const row = MALICIOUS.phases.find((p) => p.id === sc.id);
              return (
                <li
                  key={sc.id}
                  className="pipe-scene-block"
                  data-active={sc.id === scene || undefined}
                >
                  <h3 className="pipe-scene-title about-document">
                    <span className="pipe-scene-num from-document">
                      PHASE {sc.id}
                    </span>
                    {sc.title}
                  </h3>
                  <p className="pipe-scene-copy about-document">{sc.copy}</p>
                  {row?.readout && (
                    <p className="pipe-scene-readout from-document tabular">
                      {row.readout}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
