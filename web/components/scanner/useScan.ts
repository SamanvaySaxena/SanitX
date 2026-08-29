"use client";

/* =========================================================================
   The scan state machine — FRONTEND_DESIGN.md §6.2, §6.3, §6.5.
   -------------------------------------------------------------------------
   §6.2 is the whole reason this hook exists: "Stream the phases over SSE and
   render each as it completes… A spinner communicates nothing and feels
   broken; a phase ledger filling in communicates thoroughness and feels
   fast, at identical real latency."

   So the state is deliberately NOT `{ loading, data }`. It is the six phase
   rows plus whatever results have landed so far, and every consumer renders
   the partial truth rather than waiting for the whole.

   §6.3 fail-closed is enforced here rather than in the view: there is no
   transition in this reducer from a failed or cancelled run to a SAFE
   verdict, and a stream that ends without a `verdict` frame settles into
   `failed` rather than into `complete`.
   ========================================================================= */

import * as React from "react";
import { streamDemoScan, type ScanOptions } from "@/lib/api";
import type { SampleId } from "@/lib/fixtures/scans";
import type {
  Divergence,
  DocumentMeta,
  Finding,
  Phase,
  PhaseId,
  ScanEvent,
  ScanResponse,
  TierBreakdown,
} from "@/lib/types";

/** `cancelled` and `failed` are distinct: one is the user's decision and one
    is the pipeline's. Both are non-clearing, and the panel says so in
    different words because the remedy differs. */
export type ScanStatus =
  | "idle"
  | "scanning"
  | "complete"
  | "failed"
  | "cancelled";

/**
 * The injection seam. Defaults to `streamDemoScan`; §10.3 step 8 swaps in
 * `streamLiveScan` once the backend produces a verdict (§10.1), and the test
 * suite passes deterministic streams — including ones that fail mid-run,
 * which the fixtures deliberately never do.
 */
export type ScanStreamFactory = (
  sample: SampleId,
  opts: ScanOptions,
) => AsyncIterable<ScanEvent>;

/** The six phases of PIPELINE_IMPROVEMENTS §5, seeded before the first frame
    arrives so the user sees the SHAPE of the work immediately — that is what
    replaces the spinner. Names are the ones every fixture uses. */
export const PHASE_NAMES: Record<PhaseId, string> = {
  1: "Hardened ingestion",
  2: "Structural scan",
  3: "Discrepancy gate",
  4: "Semantic scan",
  5: "Risk scoring",
  6: "Response",
};

export const PHASE_IDS: PhaseId[] = [1, 2, 3, 4, 5, 6];

const seedPhases = (): Phase[] =>
  PHASE_IDS.map((id) => ({
    id,
    name: PHASE_NAMES[id],
    status: "pending",
    ms: null,
    readout: null,
    error: null,
  }));

export interface ScanFailure {
  phase: PhaseId | null;
  message: string;
}

export interface ScanState {
  status: ScanStatus;
  sample: SampleId | null;
  document: DocumentMeta | null;
  /** Name of the local file when a real upload is in play (§6.3 precheck). */
  uploadName: string | null;
  phases: Phase[];
  findings: Finding[];
  divergence: Divergence | null;
  tiers: TierBreakdown | null;
  response: ScanResponse | null;
  failure: ScanFailure | null;
}

const INITIAL: ScanState = {
  status: "idle",
  sample: null,
  document: null,
  uploadName: null,
  phases: seedPhases(),
  findings: [],
  divergence: null,
  tiers: null,
  response: null,
  failure: null,
};

type Action =
  | { kind: "start"; sample: SampleId; uploadName: string | null }
  | { kind: "event"; event: ScanEvent }
  | { kind: "settle" }
  | { kind: "cancel" }
  | { kind: "reset" };

const FAILCLOSED_SUFFIX = "The document was NOT cleared.";

function applyEvent(state: ScanState, event: ScanEvent): ScanState {
  switch (event.type) {
    case "document":
      return { ...state, document: event.document };

    case "phase":
      return {
        ...state,
        phases: state.phases.map((p) =>
          p.id === event.phase.id ? event.phase : p,
        ),
      };

    // Results land as their phase completes, not all at the end (§6.2).
    // Ordered by score so `j`/`k` walks the list worst-first.
    case "findings":
      return {
        ...state,
        findings: [...event.findings].sort((a, b) => b.score - a.score),
      };

    case "divergence":
      return { ...state, divergence: event.divergence };

    case "tiers":
      return { ...state, tiers: event.tiers };

    case "verdict":
      return {
        ...state,
        status: "complete",
        response: event.response,
        document: event.response.document,
        // The response is authoritative for the rows it carries; anything the
        // stream never reached stays exactly as it was.
        phases: state.phases.map(
          (p) => event.response.phases.find((q) => q.id === p.id) ?? p,
        ),
        findings:
          state.findings.length > 0
            ? state.findings
            : [...event.response.findings].sort((a, b) => b.score - a.score),
        divergence: state.divergence ?? event.response.divergence,
        tiers: state.tiers ?? event.response.tiers,
      };

    // §6.3 — completed phases KEEP their results; the failed phase is named;
    // the verdict degrades to REVIEW with the reason stated (§6.5).
    case "error":
      return {
        ...state,
        status: "failed",
        failure: { phase: event.phase, message: event.message },
        phases: state.phases.map((p) =>
          p.id === event.phase || (event.phase === null && p.status === "running")
            ? { ...p, status: "failed", error: event.message }
            : p,
        ),
      };
  }
}

function reduce(state: ScanState, action: Action): ScanState {
  switch (action.kind) {
    case "start":
      return {
        ...INITIAL,
        phases: seedPhases(),
        status: "scanning",
        sample: action.sample,
        uploadName: action.uploadName,
      };

    case "event":
      return applyEvent(state, action.event);

    // A stream that ended without a verdict frame is not a success. Fail
    // closed: an unresolved run maps to REVIEW, never SAFE (§5.8, §6.3).
    case "settle":
      if (state.status !== "scanning") return state;
      return {
        ...state,
        status: "failed",
        failure: {
          phase: state.phases.find((p) => p.status !== "complete")?.id ?? null,
          message: `The scan ended before a verdict was produced. ${FAILCLOSED_SUFFIX}`,
        },
        phases: state.phases.map((p) =>
          p.status === "running"
            ? { ...p, status: "failed", error: "Stream ended mid-phase." }
            : p,
        ),
      };

    case "cancel":
      if (state.status !== "scanning") return state;
      return {
        ...state,
        status: "cancelled",
        phases: state.phases.map((p) =>
          p.status === "running" ? { ...p, status: "pending" } : p,
        ),
      };

    case "reset":
      return { ...INITIAL, phases: seedPhases() };
  }
}

export interface UseScanResult extends ScanState {
  /** True while a run is in flight — the only thing that should gate a
      "cancel" affordance. There is no separate spinner flag on purpose. */
  scanning: boolean;
  start: (sample: SampleId, uploadName?: string | null) => void;
  /** §6.5 — "cancel button that actually aborts the request." */
  cancel: () => void;
  reset: () => void;
}

export function useScan(stream?: ScanStreamFactory): UseScanResult {
  const [state, dispatch] = React.useReducer(reduce, INITIAL);
  const abortRef = React.useRef<AbortController | null>(null);
  const runRef = React.useRef(0);
  const streamRef = React.useRef<ScanStreamFactory | undefined>(stream);
  streamRef.current = stream;

  // Abort on unmount. An orphaned generator would keep dispatching into a
  // dead reducer, which is the classic streaming-UI leak.
  React.useEffect(
    () => () => {
      abortRef.current?.abort();
      runRef.current += 1;
    },
    [],
  );

  const cancel = React.useCallback(() => {
    runRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ kind: "cancel" });
  }, []);

  const reset = React.useCallback(() => {
    runRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ kind: "reset" });
  }, []);

  const start = React.useCallback(
    (sample: SampleId, uploadName: string | null = null) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const run = ++runRef.current;

      dispatch({ kind: "start", sample, uploadName });

      const factory = streamRef.current ?? streamDemoScan;
      const live = () => run === runRef.current && !controller.signal.aborted;

      void (async () => {
        try {
          for await (const event of factory(sample, {
            signal: controller.signal,
          })) {
            if (!live()) return;
            dispatch({ kind: "event", event });
          }
        } catch (err) {
          if (!live()) return;
          // Never a generic red toast (§6.3). Name what broke, then say
          // plainly what it means for the document.
          dispatch({
            kind: "event",
            event: {
              type: "error",
              phase: null,
              message: `${
                err instanceof Error ? err.message : "The scan stream failed."
              } ${FAILCLOSED_SUFFIX}`,
            },
          });
          return;
        }
        if (!live()) return;
        dispatch({ kind: "settle" });
      })();
    },
    [],
  );

  return {
    ...state,
    scanning: state.status === "scanning",
    start,
    cancel,
    reset,
  };
}

/** The `[ JSON ]` export and the `c` shortcut (§6.4) serialise this. During a
    partial run it is the partial truth, which is the honest thing to hand an
    engineer who is debugging a failure. */
export function scanToJson(state: ScanState): string {
  if (state.response) return JSON.stringify(state.response, null, 2);
  return JSON.stringify(
    {
      status: state.status,
      cleared: false,
      document: state.document,
      phases: state.phases,
      findings: state.findings,
      divergence: state.divergence,
      tiers: state.tiers,
      failure: state.failure,
      note: `Partial result. ${FAILCLOSED_SUFFIX}`,
    },
    null,
    2,
  );
}
