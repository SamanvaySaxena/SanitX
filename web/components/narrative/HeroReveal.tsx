import { LinkButton } from "@/components/primitives/Button";
import { VECTOR_COUNT_WORD } from "@/lib/vectors";
import { ReplayButton } from "./ReplayButton";
import { ResumePage } from "./ResumePage";

/* =========================================================================
   Act 0 — the reveal (§5.0). The most important four seconds on the site.
   -------------------------------------------------------------------------
   This is a SERVER component. The always-on line, the paper, the payload
   layer, the labels and the headline are all in the initial HTML, and the
   entire choreography is CSS keyframes in styles/globals.css. §8: "Nothing in
   Act 0 waits on JavaScript — if GSAP fails to load, the hero still shows the
   reveal end state and the headline."

   The Rev 2 correction (§5.0) is why the copy is ordered this way: the
   original withheld all explanation for 2300ms and then led with a threat
   framing. Both are things the best sites in this category have stopped
   doing. The reveal is unchanged — it is demonstration, not fear — but a
   plain one-sentence statement of what SanitX takes and what it looks for is
   now present from the first frame, and the headline states a capability with
   a countable claim.
   ========================================================================= */

export function HeroReveal() {
  return (
    <section
      aria-labelledby="hero-headline"
      className="relative isolate overflow-hidden border-b border-[var(--line-soft)]"
    >
      {/* The blueprint grid sits on the section ground, never behind body
          copy (§3.4). It falls away toward the content column. */}
      <div
        aria-hidden="true"
        className="blueprint pointer-events-none absolute inset-0 -z-10 opacity-70 [mask-image:radial-gradient(ellipse_at_50%_0%,#000_25%,transparent_75%)]"
      />

      <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 items-start gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1fr_minmax(340px,470px)] lg:gap-14 lg:pb-24 lg:pt-24">
        {/* ---------------------------------------------------------------
            The copy column.
            --------------------------------------------------------------- */}
        <div className="hero-copy order-2 lg:order-1">
          {/* THE ALWAYS-ON LINE. In the initial HTML at t=0, never gated on
              JavaScript. One plain sentence, no metaphor, no scare — and it
              names both accepted formats, so the claim matches what the drop
              zone actually takes. §5.0 calls this non-negotiable: a visitor
              who lands and leaves in two seconds still knows what this is.

              It is typed in over 1.5s, which is a presentation of the line
              rather than a delay of it: the effect is a clip edge walking
              across type that is ALREADY in the document. The sentence is a
              single server-rendered text node — never assembled from
              per-character spans — so it is in the DOM, in the accessibility
              tree and in the crawler's copy of the page whether or not the
              animation ever runs, and the CSS fallback is the finished line,
              not an empty one. The effect also stands down entirely in a
              copy column narrow enough to wrap the sentence, since a clip
              edge across two lines reads as a fault. See the Act 0 block in
              styles/globals.css. */}
          <p className="about-document text-[length:var(--lede)] leading-snug text-[var(--text-hi)]">
            <span className="hero-typeline">
              <span className="hero-typeline-text">
                SanitX scans PDFs and Markdown for hidden prompt injections.
              </span>
              <span className="hero-typeline-caret" aria-hidden="true" />
            </span>
          </p>

          {/* The headline resolves in at 2300ms. It states a capability with
              a countable claim — Chainguard's move — and "Ten" is not typed
              here: it is derived from the taxonomy in lib/vectors.ts, so the
              hero and Act 2 cannot drift apart (§5.2). */}
          {/* Sized at --h1 rather than --display: --display (up to 6rem) is
              authored for SHORT display type, and this headline is two full
              sentences. At 96px in this column it fragments to one word per
              line, which destroys the countable claim it exists to make.
              --h1 keeps the oversized register §3.3 asks for while letting
              each sentence read as a sentence. */}
          <h1
            id="hero-headline"
            className="hero-headline mt-6 max-w-[19ch] text-[length:var(--h1)] font-medium leading-[1.02] tracking-[-0.025em] text-[var(--text-hi)]"
          >
            {VECTOR_COUNT_WORD} ways a PDF can hide an instruction.
            <br />
            We check for all of them.
          </h1>

          <p className="about-document mt-6 max-w-[62ch] text-[length:var(--lede)] leading-[1.6] text-[var(--text-mid)]">
            Text sized to nothing, coloured to match the page, buried under
            images, or remapped so the glyphs and the characters disagree. In
            Markdown, the same instruction hides in a comment, a CSS-hidden
            span or an embedded HTML tag. SanitX finds it before the model
            that would obey it does.
          </p>

          {/* §2.5 / §3.6 — the scanner is not behind a signup, and the CTAs
              are low-pressure and evidence-inviting. The second drops the
              visitor into a real verdict on a malicious sample they do not
              have to own. */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <LinkButton href="/scan" variant="primary">
              Scan a document
            </LinkButton>
            <LinkButton href="/scan?sample=malicious" variant="secondary">
              Use a malicious sample <span aria-hidden="true">→</span>
            </LinkButton>
            <ReplayButton targetId="hero-figure" />
          </div>

          {/* §5.9 — trust signals distributed, not stacked at the bottom.
              These attach to the hero's "ten vectors" claim, on the first
              screen, as small links rather than badges. */}
          <nav
            aria-label="Methodology"
            className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--line-hair)] pt-5 text-[length:var(--ui-sm)]"
          >
            <a
              className="text-[var(--text-low)] underline decoration-[var(--line-strong)] underline-offset-4 transition-colors duration-[var(--t-snap)] hover:text-[var(--text-hi)]"
              href="#taxonomy"
            >
              Open methodology
            </a>
            <a
              className="text-[var(--text-low)] underline decoration-[var(--line-strong)] underline-offset-4 transition-colors duration-[var(--t-snap)] hover:text-[var(--text-hi)]"
              href="#taxonomy"
            >
              Adversarial corpus
            </a>
          </nav>
        </div>

        {/* ---------------------------------------------------------------
            The paper. The only bright object on the screen, so it is the
            focal point in every section for free (§3.1).
            --------------------------------------------------------------- */}
        <figure
          id="hero-figure"
          className="hero-figure hero-armed order-1 m-0 lg:order-2"
        >
          <ResumePage titleId="hero-page-title" descId="hero-page-desc" />

          {/* §7.1 — a real <figcaption>, not a visually-hidden div. The
              caption states in words exactly what the animation states in
              pixels, which passes the §7.2 content test by construction. */}
          <figcaption className="from-document mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[length:var(--ui-xs)] text-[var(--text-low)]">
            <span>resume.pdf · 1 page · 612 × 792 pt</span>
            <span aria-hidden="true">·</span>
            <span>
              3 spans present in the file, absent from the page:{" "}
              <span className="text-[var(--accent)]">1.4pt</span>,{" "}
              <span className="text-[var(--accent)]">Δcontrast 3/255</span>,{" "}
              <span className="text-[var(--accent)]">occluded by /Image</span>
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
