"use client";

import * as React from "react";
import {
  BANDS,
  BAND_STATUS,
  VERDICT_PRESENTATION,
  verdictAriaText,
  verdictFor,
} from "@/lib/scoring";

/**
 * The risk meter — §5.5, §6.1, §7.3.
 *
 * Three laws hold here simultaneously:
 *  - role="meter" with aria-valuenow and aria-valuetext ("0.81, blocked")
 *  - bands ordered left-to-right, so POSITION alone encodes severity for the
 *    ~1 in 12 men who cannot separate --review from --blocked (§3.2 law 2)
 *  - the band boundaries are labelled "proposed — pending calibration",
 *    because they are currently a guess and the site must not imply otherwise
 */
export function Meter({
  value,
  showBands = true,
  id,
}: {
  value: number;
  showBands?: boolean;
  id?: string;
}) {
  const verdict = verdictFor(value);
  const pres = VERDICT_PRESENTATION[verdict];
  const pct = Math.min(100, Math.max(0, value * 100));

  return (
    <div className="w-full">
      <div
        id={id}
        role="meter"
        aria-valuenow={Number(value.toFixed(2))}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuetext={verdictAriaText(value)}
        aria-label="Composite risk score R"
        className="relative h-2 w-full overflow-hidden rounded-[var(--r-chip)] border border-[var(--line-soft)] bg-[var(--bg-void)]"
      >
        {/* Bands, left to right: safe | review | blocked. */}
        <div className="absolute inset-0 flex" aria-hidden="true">
          <div
            className="h-full bg-[var(--safe)] opacity-25"
            style={{ width: `${BANDS.review * 100}%` }}
          />
          <div
            className="h-full bg-[var(--review)] opacity-25"
            style={{ width: `${(BANDS.blocked - BANDS.review) * 100}%` }}
          />
          <div
            className="h-full bg-[var(--blocked)] opacity-25"
            style={{ width: `${(1 - BANDS.blocked) * 100}%` }}
          />
        </div>
        {/* The needle. transform only — no width transition (§8). */}
        <div
          aria-hidden="true"
          className="absolute top-0 h-full w-[2px] bg-[var(--text-hi)]"
          style={{
            left: `${pct}%`,
            transform: "translateX(-1px)",
            backgroundColor: pres.token,
          }}
        />
      </div>

      {showBands && (
        <div className="mt-1.5 flex items-baseline justify-between">
          <div className="from-document tabular flex gap-3 text-[length:var(--ui-xs)] text-[var(--text-low)]">
            <span>SAFE &lt; {BANDS.review.toFixed(2)}</span>
            <span>
              REVIEW {BANDS.review.toFixed(2)}–{BANDS.blocked.toFixed(2)}
            </span>
            <span>BLOCKED ≥ {BANDS.blocked.toFixed(2)}</span>
          </div>
          <span className="about-document text-[length:var(--ui-xs)] text-[var(--text-low)] italic">
            {BAND_STATUS}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * The verdict badge. Colour + glyph + word, always all three (§3.2 law 2).
 * Copy is flat and factual — §3.6's hardest test is exactly this component.
 */
export function VerdictBadge({
  value,
  size = "md",
}: {
  value: number;
  size?: "md" | "sm";
}) {
  const verdict = verdictFor(value);
  const pres = VERDICT_PRESENTATION[verdict];
  return (
    <span
      className={`inline-flex items-center gap-2 font-medium ${
        size === "md" ? "text-[length:var(--ui-lg)]" : "text-[length:var(--ui)]"
      }`}
      style={{ color: pres.token }}
      data-verdict={verdict}
    >
      <span aria-hidden="true">{pres.glyph}</span>
      <span className="tracking-[0.08em]">{pres.word}</span>
    </span>
  );
}
