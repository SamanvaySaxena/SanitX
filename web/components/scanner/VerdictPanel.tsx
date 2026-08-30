"use client";

/* =========================================================================
   The verdict panel — FRONTEND_DESIGN.md §6.1 (pane 3), §6.3, §6.5, §3.6.
   -------------------------------------------------------------------------
   The rules that shape every line of this file:

   §6.5 CLEAN RESULT: "do not celebrate. ✓ VERIFIED SAFE, R = 0.08, the
   component breakdown, and the list of checks that ran. A security tool that
   congratulates you trains you to skim it." So the safe branch is the same
   layout as the blocked branch with different numbers — no green banner, no
   confetti, no exclamation mark anywhere in this file.

   §6.3 FAIL-CLOSED: "When a phase errors… the verdict panel states explicitly
   that the document was NOT cleared. Never a generic red toast." The failure
   notice is a region inside the panel, it names the phase, and it says the
   words. It also SUPPRESSES the verdict badge — a degraded run has no verdict
   to show, and showing the last-known one would be the exact lie §6.3 guards
   against.

   §6.3 DISABLE, DON'T VALIDATE: exports are disabled until a scan settles,
   and the reason travels with the disabled control via .sx-tip rather than
   arriving as an error after the click.

   §11 bans animated number counters here. Every number is printed.

   §5.5's calculator and this panel share `computeRisk` and `Meter`; neither
   reimplements the maths or the meter.
   ========================================================================= */

import * as React from "react";
import { Meter, VerdictBadge } from "@/components/primitives/Meter";
import { Button } from "@/components/primitives/Button";
import { DivergencePanel } from "./DivergencePanel";
import {
  DEFAULT_WEIGHTS,
  PROFILES,
  clampWeight,
  computeRisk,
} from "@/lib/scoring";
import type {
  ComponentScores,
  Divergence,
  ScanResponse,
  TierBreakdown,
  Weights,
} from "@/lib/types";
import type { ScanFailure, ScanStatus } from "./useScan";

const COMPONENT_KEYS: (keyof ComponentScores)[] = ["s", "d", "m"];

const COMPONENT_NAMES: Record<keyof ComponentScores, string> = {
  s: "structural",
  d: "divergence",
  m: "semantic",
};

const PROFILE_STORAGE_KEY = "sanitx.profile";

export interface VerdictPanelProps {
  status: ScanStatus;
  response: ScanResponse | null;
  divergence: Divergence | null;
  tiers: TierBreakdown | null;
  failure: ScanFailure | null;
  /** §10.2 — fixtures are serving. Labelled visibly, never silently. */
  demo: boolean;
  onExportJson: () => void;
  /** True briefly after the `c` shortcut or the JSON button copies. */
  copied: boolean;
}

export function VerdictPanel({
  status,
  response,
  divergence,
  tiers,
  failure,
  demo,
  onExportJson,
  copied,
}: VerdictPanelProps) {
  /* Weights are local and adjustable here for the same reason Act 5 exists:
     the band is a deployment decision, not a fact. §6.3 "smart defaults" —
     the profile preset seeds them, and the last-used profile persists. */
  const [profileId, setProfileId] = React.useState(PROFILES[0].id);
  const [weights, setWeights] = React.useState<Weights>(DEFAULT_WEIGHTS);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PROFILE_STORAGE_KEY);
      const profile = PROFILES.find((p) => p.id === saved);
      if (profile) {
        setProfileId(profile.id);
        setWeights(profile.weights);
      }
    } catch {
      /* Storage denied (private mode, blocked cookies). The defaults are
         correct without it; a persistence failure is not a scan failure. */
    }
  }, []);

  const selectProfile = (id: string) => {
    const profile = PROFILES.find((p) => p.id === id);
    if (!profile) return;
    setProfileId(profile.id);
    setWeights(profile.weights);
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, profile.id);
    } catch {
      /* See above. */
    }
  };

  const settled = status === "complete" && response !== null;
  const degraded = status === "failed" || status === "cancelled";
  const components = response?.components ?? null;
  /* Recomputed locally so moving a weight moves the verdict — what the panel
     prints is what the pipeline would compute under THESE weights. The
     server's own R is printed beside it so the two can be compared. */
  const r = components ? computeRisk(components, weights) : null;

  return (
    <section className="sx-pane" aria-labelledby="sx-verdict-title">
      <h2 className="sx-pane-title" id="sx-verdict-title">
        <span>Verdict</span>
        {demo && (
          <span className="sx-demo-flag from-document">DEMO · FIXTURE DATA</span>
        )}
      </h2>

      {/* ---- Fail-closed notice (§6.3). Placed before the verdict, because
              it governs whether there is one at all. --------------------- */}
      {degraded && (
        <p className="sx-failclosed" role="status">
          <span className="sx-strong">
            {status === "cancelled"
              ? "Scan cancelled."
              : `Phase ${failure?.phase ?? "—"} failed.`}
          </span>{" "}
          {failure?.message ?? "The scan did not run to completion."} This
          document was <span className="sx-strong">NOT cleared</span>. An
          unresolved scan maps to REVIEW, never SAFE.
        </p>
      )}

      {status === "idle" && <p className="sx-note">No document scanned yet.</p>}

      {status === "scanning" && (
        <p className="sx-note">
          Scanning. Results appear per phase as they land; the verdict
          assembles last.
        </p>
      )}

      {/* ---- The verdict itself. Only when the run actually settled. ---- */}
      {settled && r !== null && components && response && (
        <>
          <div className="sx-verdict-head">
            <VerdictBadge value={r} />
            <span className="sx-r from-document tabular">R = {r.toFixed(2)}</span>
          </div>

          <Meter value={r} />

          <div className="sx-section sx-section-top">
            <h3 className="sx-label">Component scores</h3>
            <dl className="sx-components from-document tabular">
              {COMPONENT_KEYS.map((k) => (
                <React.Fragment key={k}>
                  <dt>{k.toUpperCase()}</dt>
                  <dd className="sx-component-name sx-dd-left">
                    {COMPONENT_NAMES[k]} · w {weights[k].toFixed(2)}
                  </dd>
                  <dd>{components[k].toFixed(2)}</dd>
                </React.Fragment>
              ))}
            </dl>
          </div>

          {/* §6.3 smart defaults + disable-don't-validate. The inputs clamp
              at the input level (min/max/step) AND in the handler. */}
          <div className="sx-section">
            <h3 className="sx-label">Deployment profile</h3>
            <select
              className="sx-select"
              value={profileId}
              onChange={(e) => selectProfile(e.target.value)}
              aria-label="Deployment profile"
            >
              {PROFILES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <div className="sx-weights sx-weights-top">
              {COMPONENT_KEYS.map((k) => (
                <div className="sx-weight" key={k}>
                  <label htmlFor={`sx-w-${k}`}>
                    w_{k} · {COMPONENT_NAMES[k]}
                  </label>
                  <input
                    id={`sx-w-${k}`}
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={weights[k]}
                    onChange={(e) =>
                      setWeights((w) => ({
                        ...w,
                        [k]: clampWeight(Number(e.target.value)),
                      }))
                    }
                  />
                </div>
              ))}
            </div>

            <p className="sx-note from-document tabular">
              Server computed R = {response.score.toFixed(2)} under its own
              weights. The value above is this profile applied to the same
              component scores.
            </p>
          </div>

          {/* Phase 4's cost architecture. An engineer reads the funnel; a
              casual user reads three numbers (§5.3 scene 4). */}
          {tiers && (
            <div className="sx-section">
              <h3 className="sx-label">Semantic tiers</h3>
              <dl className="sx-components from-document tabular">
                <dt>1</dt>
                <dd className="sx-component-name sx-dd-left">
                  deterministic signatures
                </dd>
                <dd>{tiers.tier1}</dd>
                <dt>2</dt>
                <dd className="sx-component-name sx-dd-left">
                  local classifier
                </dd>
                <dd>{tiers.tier2}</dd>
                <dt>3</dt>
                <dd className="sx-component-name sx-dd-left">
                  generative evaluator
                </dd>
                <dd>{tiers.tier3}</dd>
              </dl>
              <p className="sx-note from-document tabular">
                cost / doc ${tiers.costPerDoc.toFixed(4)}
              </p>
            </div>
          )}
        </>
      )}

      <DivergencePanel divergence={divergence} pending={status === "scanning"} />

      {/* §6.5 clean result — "the list of checks that ran". This is what
          replaces congratulation. It is also the strongest thing a SAFE
          verdict can show: not "you're fine", but "here is what was
          examined". */}
      {settled && response && response.checksRun.length > 0 && (
        <div className="sx-section">
          <h3 className="sx-label">Checks that ran</h3>
          <ul className="sx-checks">
            {response.checksRun.map((c) => (
              <li key={c}>· {c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ---- Exports (§6.1). Disabled, with the reason attached. ------- */}
      <div className="sx-section">
        <h3 className="sx-label">Export</h3>
        <div className="sx-exports">
          <PendingExport label="Cleaned corpus" />
          <PendingExport label="Redacted PDF" />
          <span
            className="sx-tip"
            data-tip={
              status === "idle"
                ? "Nothing scanned yet."
                : "Copies the response as it stands, including a partial run."
            }
          >
            <Button
              variant="secondary"
              onClick={onExportJson}
              disabled={status === "idle"}
            >
              {copied ? "JSON copied" : "JSON"}
            </Button>
          </span>
        </div>
      </div>
    </section>
  );
}

/** Exports that depend on backend Phase 2 (§10.1) are present and disabled
    with the reason stated, rather than absent — a professional evaluating the
    tool should be able to see the shape of what ships, and §6.3 says the
    reason travels with the control. */
function PendingExport({ label }: { label: string }) {
  return (
    <span
      className="sx-tip"
      data-tip="Backend Phase 2. Not wired to a live pipeline yet."
    >
      <Button variant="secondary" disabled>
        {label}
      </Button>
    </span>
  );
}
