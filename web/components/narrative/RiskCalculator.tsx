"use client";

/* =========================================================================
   Act 5 — the verdict, made interactive. FRONTEND_DESIGN.md §5.5 (~90vh).
   -------------------------------------------------------------------------
   "Deliberate change of gear: after two pinned scrubbed sequences, hand the
   user the controls." This is the site's ONE non-scroll interaction, which is
   why it earns state and a "use client" boundary and nothing else in Zone A
   does.

   What it argues: binary BLOCKED/SAFE is wrong. §5.5 — it "converts open
   question #4 in PIPELINE_IMPROVEMENTS §8 — where do false positives hurt
   more than false negatives? — from an unresolved design problem into the
   most persuasive interaction on the page", by letting the visitor feel the
   band move under a deployment they recognise.

   Four rules hold here:
   - The maths is `computeRisk` from lib/scoring.ts. Not reimplemented, not
     approximated. What the page prints is what the pipeline would compute.
   - The meter is `Meter` from components/primitives. Not a second meter.
     It carries role="meter", aria-valuetext, and BAND_STATUS, and none of
     those are suppressed here.
   - §6.3 "disable, don't validate": weights clamp to [0,1] at the input via
     clampWeight, rather than being validated after the fact.
   - No colour-only encoding (§3.2 law 2). Every value on screen is also a
     number, and the verdict carries glyph + word + colour + position.
   ========================================================================= */

import * as React from "react";
import { Meter, VerdictBadge } from "@/components/primitives/Meter";
import { Button } from "@/components/primitives/Button";
import {
  BAND_STATUS,
  clampWeight,
  computeRisk,
  DEFAULT_WEIGHTS,
  PROFILES,
  verdictFor,
} from "@/lib/scoring";
import type { ComponentScores, Weights } from "@/lib/types";

type TermKey = "s" | "d" | "m";

const TERMS: {
  key: TermKey;
  symbol: string;
  weightSymbol: string;
  name: string;
  /** One line. What this component actually measures, from PIPELINE_IMPROVEMENTS §5. */
  source: string;
}[] = [
  {
    key: "s",
    symbol: "S",
    weightSymbol: "w_s",
    name: "Structural anomaly",
    source: "Phase 2 — render mode, opacity, OCG, occlusion, rotation.",
  },
  {
    key: "d",
    symbol: "D",
    weightSymbol: "w_d",
    name: "Divergence penalty",
    source: "Phase 3 — inverse of the Jaccard and cosine similarities.",
  },
  {
    key: "m",
    symbol: "M",
    weightSymbol: "w_m",
    name: "Semantic confidence",
    source: "Phase 4 — classifier probabilities.",
  },
];

/* Opens on the malicious sample's component scores (§6.1), so the first thing
   the visitor sees is a document that is genuinely in the blocked band rather
   than a neutral 0.5 that argues nothing. */
const INITIAL_COMPONENTS: ComponentScores = { s: 0.88, d: 0.93, m: 0.61 };

const fmt = (n: number) => n.toFixed(2);

export function RiskCalculator() {
  const [components, setComponents] =
    React.useState<ComponentScores>(INITIAL_COMPONENTS);
  const [weights, setWeights] = React.useState<Weights>(DEFAULT_WEIGHTS);
  const [profileId, setProfileId] = React.useState<string | null>(PROFILES[0].id);
  /* Which term last changed — drives the "terms light up" behaviour. It is a
     redundancy cue only: every term prints its own numbers at all times, so
     nothing is encoded by the highlight alone. */
  const [active, setActive] = React.useState<TermKey | null>(null);

  const r = computeRisk(components, weights);
  const verdict = verdictFor(r);
  const profile = PROFILES.find((p) => p.id === profileId) ?? null;

  const setComponent = (key: TermKey, value: number) => {
    setActive(key);
    setComponents((c) => ({ ...c, [key]: value }));
  };

  /* §6.3 — clamp at the input level. clampWeight also maps NaN (an emptied
     number field) to 0 rather than letting it poison the formula. */
  const setWeight = (key: TermKey, raw: number) => {
    setActive(key);
    setProfileId(null); // an edited weight is no longer a named profile
    setWeights((w) => ({ ...w, [key]: clampWeight(raw) }));
  };

  const applyProfile = (id: string) => {
    const p = PROFILES.find((x) => x.id === id);
    if (!p) return;
    setProfileId(p.id);
    setWeights(p.weights);
    setActive(null);
  };

  return (
    <section id="risk" className="rc" aria-labelledby="rc-heading">
      <div className="rc-inner">
        <header className="rc-head reveal">
          <h2 id="rc-heading" className="rc-title about-document">
            One score, three components, and weights you choose.
          </h2>
          <p className="rc-lede about-document">
            A hiring pipeline and a hospital ingestion layer want opposite
            settings, so the verdict is a band rather than a switch. Move the
            components, change the weights, and watch where the document lands.
          </p>
        </header>

        <div className="rc-body">
          {/* ---------------- Controls ---------------------------------- */}
          <div className="rc-controls">
            <fieldset className="rc-fieldset">
              <legend className="rc-legend about-document">
                Component scores
              </legend>
              {TERMS.map((t) => (
                <div
                  className="rc-row"
                  key={t.key}
                  data-active={active === t.key ? "true" : "false"}
                >
                  <label className="rc-label about-document" htmlFor={`rc-${t.key}`}>
                    <span className="rc-symbol from-document">{t.symbol}</span>
                    <span className="rc-name">{t.name}</span>
                  </label>
                  <input
                    id={`rc-${t.key}`}
                    className="rc-slider"
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={components[t.key]}
                    aria-valuetext={`${fmt(components[t.key])}, ${t.name.toLowerCase()}`}
                    aria-describedby={`rc-${t.key}-src`}
                    onChange={(e) => setComponent(t.key, Number(e.target.value))}
                  />
                  <output
                    className="rc-readout from-document tabular"
                    htmlFor={`rc-${t.key}`}
                  >
                    {fmt(components[t.key])}
                  </output>
                  <p id={`rc-${t.key}-src`} className="rc-source about-document">
                    {t.source}
                  </p>
                </div>
              ))}
            </fieldset>

            <fieldset className="rc-fieldset">
              <legend className="rc-legend about-document">
                Weights — clamped to 0–1 at the input
              </legend>
              <div className="rc-weights">
                {TERMS.map((t) => (
                  <div
                    className="rc-weight"
                    key={t.key}
                    data-active={active === t.key ? "true" : "false"}
                  >
                    <label
                      className="rc-weight-label from-document"
                      htmlFor={`rc-w-${t.key}`}
                    >
                      {t.weightSymbol}
                    </label>
                    <input
                      id={`rc-w-${t.key}`}
                      className="rc-number from-document tabular"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={1}
                      step={0.01}
                      value={weights[t.key]}
                      aria-label={`Weight for ${t.name.toLowerCase()}`}
                      onChange={(e) => setWeight(t.key, Number(e.target.value))}
                    />
                  </div>
                ))}
              </div>
            </fieldset>

            <fieldset className="rc-fieldset">
              <legend className="rc-legend about-document">
                Deployment profile
              </legend>
              <div className="rc-presets">
                {PROFILES.map((p) => {
                  const on = p.id === profileId;
                  return (
                    <Button
                      key={p.id}
                      size="sm"
                      variant={on ? "primary" : "secondary"}
                      aria-pressed={on}
                      onClick={() => applyProfile(p.id)}
                    >
                      {p.name}
                    </Button>
                  );
                })}
              </div>
              <p className="rc-rationale about-document">
                {profile ? (
                  profile.rationale
                ) : (
                  <>
                    Custom weights. These no longer match a named profile —
                    pick one above to return to a stated position.
                  </>
                )}
              </p>
            </fieldset>
          </div>

          {/* ---------------- Formula, meter, verdict -------------------- */}
          <div className="rc-result">
            <div className="rc-formula from-document tabular" aria-hidden="true">
              <span className="rc-f-lhs">R = clamp(0, 1,</span>
              {TERMS.map((t, i) => (
                <span
                  className="rc-term"
                  key={t.key}
                  data-active={active === t.key ? "true" : "false"}
                >
                  {i > 0 && <span className="rc-op"> + </span>}
                  <span className="rc-term-w">{t.weightSymbol}</span>
                  <span className="rc-op">·</span>
                  <span className="rc-term-c">{t.symbol}</span>
                </span>
              ))}
              <span className="rc-f-rhs">)</span>
            </div>

            {/* The substituted form. Kept beside the symbolic one so the
                formula is checkable by hand rather than asserted — the same
                move as Act 4's reversible scrub. */}
            <div className="rc-substituted from-document tabular" aria-hidden="true">
              <span className="rc-f-lhs">R = clamp(0, 1,</span>
              {TERMS.map((t, i) => (
                <span
                  className="rc-term"
                  key={t.key}
                  data-active={active === t.key ? "true" : "false"}
                >
                  {i > 0 && <span className="rc-op"> + </span>}
                  <span className="rc-term-w">{fmt(weights[t.key])}</span>
                  <span className="rc-op">·</span>
                  <span className="rc-term-c">{fmt(components[t.key])}</span>
                </span>
              ))}
              <span className="rc-f-rhs">) = {fmt(r)}</span>
            </div>

            <div className="rc-verdict">
              <span className="rc-score from-document tabular" data-testid="rc-score">
                R = {fmt(r)}
              </span>
              <VerdictBadge value={r} />
            </div>

            {/* role="meter", aria-valuetext and BAND_STATUS all come from the
                primitive. §5.5's honesty requirement is satisfied by NOT
                passing showBands={false} here. */}
            <Meter value={r} />

            {/* The formula display is aria-hidden because a screen reader
                reading three symbol spans is noise; this sentence is the
                accessible equivalent and carries the same information. */}
            <p className="rc-status about-document" role="status">
              R = {fmt(r)} · {verdict === "SAFE" ? "verified safe" : verdict.toLowerCase()}.
              Band boundaries are {BAND_STATUS}.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
