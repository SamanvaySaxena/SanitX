/* =========================================================================
   Act 7 — the instrument, embedded. §5.7 (auto height).
   -------------------------------------------------------------------------
   "The real scanner (§6), inline. Pre-loaded with a malicious sample so a
   first-time visitor reaches a real verdict without possessing a malicious
   PDF. /scan renders the identical component full-bleed."

   Identical is the operative word, and it is enforced structurally: this file
   renders `Scanner` and passes two props. There is no embedded variant of the
   scanner, no cut-down version, no second implementation — the only thing
   `embedded` changes is that the root sits in flow with a border rather than
   owning the viewport (.sx-root[data-embedded] in scanner.css).

   Why that matters beyond tidiness (§2.5, §5.9): "The single strongest trust
   signal on this site is that a visitor can run the thing in ten seconds and
   check whether it does what Act 0 claimed." A demo that is not the product
   forfeits exactly that, and nobody evaluating a security tool would miss the
   difference.

   "From here down, decorative motion is zero." Nothing in this file animates,
   and the Scanner imports no animation library at all (§8).

   This section owns the #scanner anchor that the skip link and Act 1's
   audience row both target.
   ========================================================================= */
import * as React from "react";
import { Scanner } from "@/components/scanner/Scanner";

export function EmbeddedInstrument() {
  return (
    <section id="scanner" className="embed" aria-labelledby="embed-heading">
      <div className="embed-inner">
        <h2 id="embed-heading" className="embed-head about-document">
          Run it.
        </h2>

        <p className="embed-lede about-document">
          The scanner below is the same component <code>/scan</code> serves,
          pre-loaded with a malicious sample so you reach a real verdict
          without having to own a malicious PDF. Press{" "}
          <kbd className="embed-kbd from-document">?</kbd> for the shortcuts,
          or start a new scan to drop in a file of your own.
        </p>

        {/* §5.7 — pre-loaded with the malicious sample. The demo flag inside
            the verdict panel says where the numbers came from (§10.2); this
            component does not restate it, because the same claim repeated
            twice at different volumes reads as a hedge. */}
        <Scanner initialSample="malicious" embedded />
      </div>
    </section>
  );
}
