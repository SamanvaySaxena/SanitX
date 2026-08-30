/* =========================================================================
   Act 8 — for engineers, and what we do not catch. §5.8 (auto height).
   -------------------------------------------------------------------------
   "Two columns, mono, dense, no animation beyond a 120ms fade."

   LEFT — the contract: a curl example, the full JSON response schema, the
   error taxonomy, and the fail-closed guarantee stated plainly.

   RIGHT — known limitations: a literal, current list of vectors not yet
   covered, each marked with the stage that will address it.

   §5.8 on why the right column is not a liability: "it is the strongest trust
   signal available to a project with no logos and no customers. Security
   professionals discount any tool that claims total coverage, because they
   know none exists. Publishing the gap list buys more credibility than any
   badge row could, and it is honest, which for a security product is the
   whole business."

   Everything rendered here comes from lib/limitations.ts, which derives the
   schema table field-for-field from ScanResponse in lib/types.ts (§9.3). The
   consequence is the one that matters: this page cannot advertise a field the
   API does not return, which is the failure mode that makes marketing sites
   lie.

   This section owns the #api-contract and #limitations anchors that Act 0's
   trust links and Act 1's audience row both point at (§5.9).

   Zero client JavaScript. §5.7 set decorative motion to zero from Act 7 down,
   and the only motion here is the 120ms fade §5.8 permits, applied in CSS.
   ========================================================================= */
import * as React from "react";
import {
  CONTRACT_STATUS,
  CURL_EXAMPLE,
  ERROR_TAXONOMY,
  FAIL_CLOSED,
  LIMITATIONS,
  RESPONSE_SCHEMA,
  limitationsByStage,
} from "@/lib/limitations";

export function EngineeringContract() {
  const groups = limitationsByStage();

  return (
    <section className="eng" aria-labelledby="eng-heading">
      <div className="eng-inner">
        <h2 id="eng-heading" className="eng-head about-document">
          The contract, and the gaps.
        </h2>

        <div className="eng-cols">
          {/* ================= LEFT — the contract ==================== */}
          <div id="api-contract" className="eng-col">
            <h3 className="eng-col-head about-document">The contract</h3>

            {/* §5.9 — the qualifier sits beside the claim it qualifies, so it
                reads as precision rather than as a disclaimer. */}
            <p className="eng-status about-document">{CONTRACT_STATUS}</p>

            <h4 className="eng-label">Request</h4>
            <pre className="eng-code from-document">
              <code>{CURL_EXAMPLE}</code>
            </pre>

            <h4 className="eng-label">Response schema</h4>
            <div className="eng-scroll">
              <table className="eng-table from-document">
                <caption className="eng-caption about-document">
                  Every field the API returns, derived from the same TypeScript
                  types this site renders from.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Path</th>
                    <th scope="col">Type</th>
                    <th scope="col">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {RESPONSE_SCHEMA.map((f) => (
                    <tr key={f.path}>
                      <th scope="row" className="eng-path">
                        {f.path}
                      </th>
                      <td className="eng-type">{f.type}</td>
                      <td className="eng-note about-document">{f.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4 className="eng-label">Error taxonomy</h4>
            <div className="eng-scroll">
              <table className="eng-table from-document">
                <caption className="eng-caption about-document">
                  Each error states its outcome explicitly, so the guarantee
                  below is checkable rather than asserted.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Code</th>
                    <th scope="col">HTTP</th>
                    <th scope="col">Meaning and outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {ERROR_TAXONOMY.map((e) => (
                    <tr key={e.code}>
                      <th scope="row" className="eng-path">
                        {e.code}
                      </th>
                      <td className="eng-type tabular">{e.http}</td>
                      <td className="eng-note about-document">
                        {e.meaning}{" "}
                        <span className="eng-outcome">{e.outcome}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* §5.8 — the fail-closed guarantee, stated plainly. */}
            <p className="eng-guarantee about-document">
              <strong>Fail closed.</strong> {FAIL_CLOSED}
            </p>
          </div>

          {/* ================ RIGHT — the limitations ================= */}
          <div id="limitations" className="eng-col">
            <h3 className="eng-col-head about-document">
              What we do not catch yet
            </h3>

            <p className="eng-status about-document">
              {LIMITATIONS.length} known gaps, each marked with the stage that
              closes it. The list is current, not aspirational: an entry leaves
              it only when a detector and a benign near-miss twin both exist.
            </p>

            {groups.map((group) => (
              <section
                key={group.stage}
                className="eng-stage"
                aria-labelledby={`stage-${group.stage}`}
              >
                <h4 className="eng-label" id={`stage-${group.stage}`}>
                  {group.label}
                </h4>
                <ul className="eng-gaps">
                  {group.items.map((l) => (
                    <li key={l.id} className="eng-gap">
                      <p className="eng-gap-title about-document">
                        {l.title}
                        {/* The kind, because a missing detector and an
                            uncalibrated threshold are not the same claim. */}
                        <span className="eng-kind from-document">{l.kind}</span>
                      </p>
                      <p className="eng-gap-detail about-document">{l.detail}</p>
                      <p className="eng-gap-source from-document">{l.source}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
