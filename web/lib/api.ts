/* =========================================================================
   The typed client — FRONTEND_DESIGN.md §9.1, §6.2, §10.2
   -------------------------------------------------------------------------
   One interface, two backings. Demo mode replays a fixture over the SAME
   event shape the live SSE client emits, so the scanner never learns which
   one it is talking to and the two can never diverge in behaviour.
   ========================================================================= */
import type { ScanEvent, ScanResponse } from "./types";
import { SAMPLES, type SampleId } from "./fixtures/scans";

/* --- §6.3: enforce the SERVER caps in the browser, against the same
       constants the API enforces (PIPELINE_IMPROVEMENTS Phase 1). A 90MB file
       is refused instantly with the actual limit named — never after a
       40-second upload. ------------------------------------------------- */
export const LIMITS = {
  maxBytes: 40 * 1024 * 1024,
  maxPages: 512,
  mime: "application/pdf",
} as const;

export const formatBytes = (n: number): string =>
  n >= 1024 * 1024
    ? `${(n / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(n / 1024))} KB`;

export type PrecheckResult = { ok: true } | { ok: false; reason: string };

/** Synchronous checks — extension and size. Cheap, so they run first. */
export function precheckFile(file: File): PrecheckResult {
  if (file.size > LIMITS.maxBytes) {
    return {
      ok: false,
      reason: `${formatBytes(file.size)} exceeds the ${formatBytes(LIMITS.maxBytes)} limit. Split the document or scan it in parts.`,
    };
  }
  if (file.size === 0) return { ok: false, reason: "The file is empty." };
  const looksPdf =
    file.type === LIMITS.mime || file.name.toLowerCase().endsWith(".pdf");
  if (!looksPdf) {
    return {
      ok: false,
      reason: `Only PDF is accepted. This file reports ${file.type || "an unknown type"}.`,
    };
  }
  return { ok: true };
}

/** §6.3 — verify the magic header before upload. A .pdf that is not a PDF is
    caught in the drop zone rather than by the parser. */
export async function verifyMagicHeader(file: File): Promise<PrecheckResult> {
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  const magic = String.fromCharCode(...head);
  if (magic !== "%PDF-") {
    return {
      ok: false,
      reason:
        "The file is named .pdf but does not begin with %PDF-. It is not a PDF.",
    };
  }
  return { ok: true };
}

export const isDemoMode = (): boolean =>
  process.env.NEXT_PUBLIC_DEMO !== "0";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ScanOptions {
  signal?: AbortSignal;
  /** Demo-mode replays run at this fraction of the fixture timings. */
  speed?: number;
}

/**
 * Replays a fixture as an SSE-shaped async iterable, with realistic per-phase
 * delays (§10.2). This is what makes §6.2 demonstrable without a backend: the
 * user watches the layers work rather than watching a spinner.
 */
export async function* streamDemoScan(
  sample: SampleId,
  opts: ScanOptions = {},
): AsyncGenerator<ScanEvent> {
  const response = SAMPLES[sample];
  const speed = opts.speed ?? 0.35;

  yield { type: "document", document: response.document };

  for (const phase of response.phases) {
    if (opts.signal?.aborted) return;
    yield { type: "phase", phase: { ...phase, status: "running", ms: null } };
    await sleep(Math.max(120, (phase.ms ?? 200) * speed));
    if (opts.signal?.aborted) return;
    yield { type: "phase", phase };

    // Results land as their phase completes, not all at the end.
    if (phase.id === 2) {
      yield { type: "findings", findings: response.findings };
    }
    if (phase.id === 3 && response.divergence) {
      yield { type: "divergence", divergence: response.divergence };
    }
    if (phase.id === 4 && response.tiers) {
      yield { type: "tiers", tiers: response.tiers };
    }
  }

  if (opts.signal?.aborted) return;
  yield { type: "verdict", response };
}

/**
 * The live client. Parses an SSE body off fetch + ReadableStream (§9.1).
 * Not yet reachable — the backend produces no verdict, score or structured
 * findings today (§10.1), so demo mode is the only path the UI offers until
 * Stage 1 lands. Wired here so step 8 of the build sequence is a config
 * change rather than a rewrite.
 */
export async function* streamLiveScan(
  file: File,
  endpoint: string,
  opts: ScanOptions = {},
): AsyncGenerator<ScanEvent> {
  const body = new FormData();
  body.append("file", file);

  const res = await fetch(endpoint, {
    method: "POST",
    body,
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    // §6.3 fail-closed: an unresolved error is never SAFE.
    yield {
      type: "error",
      phase: null,
      message: `Scan failed with ${res.status}. The document was not cleared.`,
    };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let split: number;
    while ((split = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      const line = frame
        .split("\n")
        .find((l) => l.startsWith("data:"));
      if (!line) continue;
      try {
        yield JSON.parse(line.slice(5).trim()) as ScanEvent;
      } catch {
        yield {
          type: "error",
          phase: null,
          message: "Malformed event from the scan endpoint. Treating as REVIEW.",
        };
        return;
      }
    }
  }
}

/** Reduces a completed event stream to a response. Used by tests and by the
    non-streaming callers in the narrative acts. */
export async function collectScan(
  events: AsyncIterable<ScanEvent>,
): Promise<ScanResponse | null> {
  let last: ScanResponse | null = null;
  for await (const e of events) if (e.type === "verdict") last = e.response;
  return last;
}
