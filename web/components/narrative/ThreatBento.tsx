/* =========================================================================
   Act 2 — the threat taxonomy. FRONTEND_DESIGN.md §5.2 (bento, ~120vh).
   -------------------------------------------------------------------------
   "This section is the hero's receipt. Act 0 claims ten vectors; this is the
   list." The count is never typed here — both this grid and the hero read
   VECTOR_COUNT from lib/vectors.ts, so the two cannot drift (§5.2's warning
   about "a hero that promises ten and a grid that shows eight").

   PROGRESSIVE DISCLOSURE (§5.2): "collapsed by default to name + mechanism.
   Expanding a cell reveals the detection approach and the relevant PyMuPDF
   call. Casual users read ten names and understand the surface area is large.
   Engineers open three cells and find get_text('rawdict')… Both audiences
   served by one component."

   That is a <details>/<summary>, not a JavaScript accordion. Three reasons it
   has to be:
     - This stays a SERVER component with zero client JS, which is what keeps
       Act 2 off the critical path entirely (§8).
     - Browser find-in-page opens a closed <details>, so an engineer who
       Ctrl+Fs "ToUnicode" lands inside the right cell.
     - Disclosure state is native, so keyboard and screen-reader behaviour are
       correct by construction rather than by aria bookkeeping (§7.3).

   WHAT IS DELIBERATELY NOT HERE — the micro-demos. §5.2 specifies a 6-frame
   loop on the three hero cells, IntersectionObserver-gated, one at a time.
   §10.3 sequences those explicitly as "static cells first, micro-demos
   after", and §8 requires poster frames as AVIF with preload="none" on video
   assets that do not exist yet. A placeholder animation here would violate
   §4.1 — motion that reveals nothing the pipeline does. The static content
   §5.2 asks for is the cell's own text: one mechanism, one detection, which
   is exactly the "single decision moment" the benchmark calls for.
   ========================================================================= */
import * as React from "react";
import {
  HERO_VECTORS,
  STANDARD_VECTORS,
  VECTOR_COUNT,
  VECTOR_COUNT_WORD,
  type Vector,
} from "@/lib/vectors";

/** Cells render in spec order: the three that defeat every physical check
    first, because they are the argument for the discrepancy gate. */
const ORDERED: Vector[] = [...HERO_VECTORS, ...STANDARD_VECTORS];

export function ThreatBento() {
  return (
    <section id="taxonomy" className="bento" aria-labelledby="bento-heading">
      {/* §3.4 — a section ground, aria-hidden, never behind the body copy. */}
      <div className="bento-ground blueprint" aria-hidden="true" />

      <div className="bento-inner">
        <h2 id="bento-heading" className="bento-head about-document reveal">
          The {VECTOR_COUNT_WORD} vectors, and how each one is caught.
        </h2>

        <p className="bento-lede about-document reveal">
          Act 0 claims {VECTOR_COUNT_WORD}. This is the list. The first three
          survive every check that looks only at the page — they are the reason
          the pipeline compares what is rendered against what is extracted
          rather than trusting either alone. Open a cell for the detection
          approach and the call that implements it.
        </p>

        <ul className="bento-grid" role="list">
          {ORDERED.map((v, i) => (
            <li key={v.id} className="contents">
              <BentoCell vector={v} index={i + 1} />
            </li>
          ))}
        </ul>

        {/* The receipt, stated as numbers so the claim stays checkable. */}
        <p className="bento-count from-document tabular">
          {VECTOR_COUNT} vectors · {HERO_VECTORS.length} that defeat every
          physical check · {STANDARD_VECTORS.length} caught structurally
        </p>
      </div>
    </section>
  );
}

function BentoCell({ vector, index }: { vector: Vector; index: number }) {
  return (
    <details
      className="bento-cell reveal"
      data-hero={vector.hero || undefined}
      /* §5.2 — cells are revealed by view() and staggered from --index. */
      style={{ "--index": index } as React.CSSProperties}
    >
      <summary className="bento-summary">
        <span className="bento-index">
          {String(index).padStart(2, "0")}
          {vector.hero ? " · defeats physical checks" : ""}
        </span>

        <strong className="bento-name about-document">{vector.name}</strong>

        <p className="bento-mechanism about-document">{vector.mechanism}</p>

        {/* The affordance carries a word, not only a glyph. */}
        <span className="bento-more from-document" aria-hidden="true">
          <span className="bento-more-closed">+ detection</span>
          <span className="bento-more-open">− close</span>
        </span>
      </summary>

      <dl className="bento-detail">
        <dt>Detection</dt>
        <dd className="about-document">{vector.detection}</dd>

        <dt>Call</dt>
        <dd>
          {/* §5.9 — the implementing call, attached to the individual
              detection claim rather than sitting in a badge row. It came out
              of the library, so it is mono (§3.3). */}
          <code className="bento-call">{vector.call}</code>
        </dd>

        <dt>Resolved by</dt>
        <dd>
          <span className="bento-phase">PHASE {vector.phase}</span>
        </dd>
      </dl>
    </details>
  );
}
