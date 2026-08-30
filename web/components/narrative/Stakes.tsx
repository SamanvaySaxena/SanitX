/* =========================================================================
   Act 1 — the stakes. FRONTEND_DESIGN.md §5.1 (60vh, no pin).
   -------------------------------------------------------------------------
   Three things happen here and nothing else does.

   1. One sentence at --h1, alone, with the grid behind it.
   2. Three tabular stat slots that are EMPTY. §5.1: "Leave the placeholders
      empty until the corpus exists." §12 open question 4: "They must be
      measured against the §6 adversarial corpus, which does not exist yet."
      §3.6 bans "any statistic we did not measure ourselves" outright. An
      unsourced number here is the fastest way to lose the only audience that
      matters, so the slots render their labels and say what they are waiting
      for. Filling them in is a data change, not a copy change.
   3. The three audiences, named. §2.6's "multiple audiences, one narrative",
      and per §5.9 it puts each audience's next step on screen two rather than
      at the bottom of a ~1800vh page.

   Motion: CSS `animation-timeline: view()` via the existing .reveal utility.
   Zero JavaScript — this is a server component and stays one.
   ========================================================================= */
import * as React from "react";

/* The three stats §5.1 names, with no values. The `value` field exists and is
   null on purpose: when the corpus lands, this array gains numbers and the
   markup below needs no edit. */
interface StatSlot {
  id: string;
  label: string;
  /** Null until measured against the §6 adversarial corpus. */
  value: string | null;
}

const STAT_SLOTS: StatSlot[] = [
  { id: "coverage", label: "Detection coverage across the corpus", value: null },
  { id: "latency", label: "Median scan latency", value: null },
  { id: "vectors", label: "Vectors classified against a benign twin", value: null },
];

const PENDING = "pending the adversarial corpus";

export interface StakesProps {
  /** Act 3, the detection pipeline. */
  pipelineHref?: string;
  /** Act 7, the embedded instrument. /scan renders the identical component. */
  scannerHref?: string;
  /** Act 2, the threat taxonomy. */
  taxonomyHref?: string;
}

export function Stakes({
  pipelineHref = "#pipeline",
  scannerHref = "#scanner",
  taxonomyHref = "#taxonomy",
}: StakesProps) {
  const audiences = [
    { href: pipelineHref, who: "Building a RAG pipeline", to: "the detection pipeline" },
    { href: scannerHref, who: "Screening documents at scale", to: "the scanner" },
    {
      href: taxonomyHref,
      who: "Evaluating this as a control",
      to: "the threat taxonomy",
    },
  ];

  return (
    <section id="stakes" className="stakes" aria-labelledby="stakes-heading">
      {/* §3.4 — the blueprint grid sits behind the sentence and stops before
          the copy below it. "Never behind body copy." Decorative, so it is
          a sibling element and not a background on the text container. */}
      <div className="stakes-ground blueprint" aria-hidden="true" />

      <div className="stakes-inner">
        {/* One sentence at --h1, alone. h2 because Act 0 owns the page's only
            h1 (§7.3); the size token and the heading level are independent. */}
        <h2 id="stakes-heading" className="stakes-line about-document reveal">
          Every RAG pipeline, résumé screener, invoice parser and document agent
          in production today reads the text layer of a PDF.{" "}
          <strong className="stakes-emphasis">None of them read the page.</strong>
        </h2>

        <dl className="stakes-stats reveal">
          {STAT_SLOTS.map((slot) => (
            <div className="stakes-stat" key={slot.id}>
              <dt className="stakes-stat-label about-document">{slot.label}</dt>
              <dd className="stakes-stat-value">
                {slot.value === null ? (
                  <>
                    {/* Decorative rule standing in for the digits. Hidden from
                        assistive tech because the real answer is the sentence
                        beneath it, not a dash. */}
                    <span
                      className="stakes-stat-slot from-document tabular"
                      aria-hidden="true"
                    >
                      —
                    </span>
                    <span className="stakes-stat-pending about-document">
                      {PENDING}
                    </span>
                  </>
                ) : (
                  <span className="stakes-stat-measured from-document tabular">
                    {slot.value}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        <p className="stakes-note about-document reveal">
          Three numbers belong in those slots. They are empty because the
          adversarial corpus they must be measured against does not exist yet —
          every vector needs a crafted PDF and a benign near-miss twin before a
          coverage figure means anything. We would rather show the gap than
          borrow a number.
        </p>

        <nav className="stakes-audiences reveal" aria-label="Where to go next">
          {audiences.map((a) => (
            <a className="stakes-audience" href={a.href} key={a.href + a.to}>
              <span className="stakes-audience-who">{a.who}</span>
              <span className="stakes-audience-arrow" aria-hidden="true">
                →
              </span>
              <span className="stakes-audience-to from-document">{a.to}</span>
            </a>
          ))}
        </nav>
      </div>
    </section>
  );
}
