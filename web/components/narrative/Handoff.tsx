/* =========================================================================
   Act 6 — the handoff. FRONTEND_DESIGN.md §5.6 (60vh).
   -------------------------------------------------------------------------
   "The design's hinge." Three beats:

     1. Narrative type stops. The last sentence is short and low.
     2. The blueprint grid fades to zero — the wallpaper is removed because
        the tool does not need it (§3.4: "never in Zone B; a working tool does
        not need wallpaper").
     3. The tool section begins.

   Beat 3 is Act 7, which follows this element in the page. What this
   component owns is the boundary itself: after it, the ground is plain.

   ---------------------------------------------------------------------------
   DEFERRED STRETCH GOAL — the FLIP.
   §5.6's third beat also describes the Act 5 verdict meter performing a
   FLIP/shared-element morph into the position it occupies in the real scanner
   panel, with the three-pane instrument assembling around it. That is
   deliberately NOT implemented here.

   §5.6 is explicit: "Ship the simple version first: a hard rule, grid off,
   tool section begins. The morph is a stretch goal and must never be the
   reason the tool renders late. If the FLIP is not measurably smooth, cut it
   — a janky handoff would undermine precisely the claim the transition exists
   to make."

   So: hard rule, grid off, tool section begins. If the morph is picked up
   later it belongs in a client component wrapping Act 5's meter and Act 7's
   verdict panel, and it must not block Act 7's first paint.
   ---------------------------------------------------------------------------

   Zero JavaScript: server component, no state, no animation library. The
   grid's fade is a static mask, not a scroll-bound animation, so §8's
   transform/opacity rule is not in play.
   ========================================================================= */
import * as React from "react";

export function Handoff() {
  return (
    <section className="handoff" aria-labelledby="handoff-heading">
      {/* Beat 2. The grid is a real .blueprint layer masked to zero on its way
          down, so the wallpaper is removed in front of the reader rather than
          simply being absent from the next section. Decorative and hidden. */}
      <div className="handoff-ground blueprint" aria-hidden="true" />

      <div className="handoff-inner">
        {/* Beat 1. Short, and low in the frame — the type stops here. Set at
            --h2 rather than --h1: the narrative is winding down, and a
            sentence that shouts would contradict what it says. */}
        <h2 id="handoff-heading" className="handoff-line about-document reveal">
          That is the argument. Here is the instrument.
        </h2>
      </div>

      {/* The hard rule. One hairline, full width — the last piece of Zone A
          chrome the reader sees. Beat 3 begins immediately below it. */}
      <hr className="handoff-rule" />
    </section>
  );
}
