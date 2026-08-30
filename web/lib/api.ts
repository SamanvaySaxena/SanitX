/* =========================================================================
   The typed client — FRONTEND_DESIGN.md §9.1, §6.2, §10.2
   -------------------------------------------------------------------------
   One interface, two backings. Demo mode replays a fixture over the SAME
   event shape the live SSE client emits, so the scanner never learns which
   one it is talking to and the two can never diverge in behaviour.
   ========================================================================= */
import type { DocumentKind, ScanEvent, ScanResponse } from "./types";
import { SAMPLES, type SampleId } from "./fixtures/scans";

export const SCAN_ENDPOINT =
  process.env.NEXT_PUBLIC_SCAN_ENDPOINT ?? "http://localhost:7000/api/scan";

export const SAMPLE_ENDPOINT_BASE =
  process.env.NEXT_PUBLIC_SAMPLE_ENDPOINT_BASE ?? "http://localhost:7000/api/samples";

/* --- §6.3: enforce the SERVER caps in the browser, against the same
       constants the API enforces (PIPELINE_IMPROVEMENTS Phase 1). A 90MB file
       is refused instantly with the actual limit named — never after a
       40-second upload. ------------------------------------------------- */
export const LIMITS = {
  maxBytes: 40 * 1024 * 1024,
  maxPages: 512,
  /** Markdown has no pages, so the page cap cannot bound the work. Lines can.
      Matches pipeline.MAX_LINES. */
  maxLines: 200_000,
  mime: "application/pdf",
  markdownMime: "text/markdown",
} as const;

/** Extensions the backend's `markdown_scan.MARKDOWN_EXTENSIONS` recognises.
    Kept in step with it — a file this list accepts and that one rejects is a
    40-second upload that ends in an error frame. */
export const MARKDOWN_EXTENSIONS = [
  ".md",
  ".markdown",
  ".mdown",
  ".mkd",
] as const;

/** The `accept` attribute for the file input, and the thing to change if the
    backend ever grows a third kind. */
export const ACCEPT_ATTRIBUTE = [
  "application/pdf",
  ".pdf",
  "text/markdown",
  ...MARKDOWN_EXTENSIONS,
].join(",");

/**
 * Which pipeline a file belongs to, decided the same way `pipeline.resolve_kind`
 * decides it — except the browser has only the name and MIME type here, and
 * the bytes are checked separately by `verifyMagicHeader` below.
 */
export function detectKind(file: File): DocumentKind {
  const name = file.name.toLowerCase();
  if (MARKDOWN_EXTENSIONS.some((ext) => name.endsWith(ext))) return "markdown";
  if (file.type === LIMITS.markdownMime) return "markdown";
  return "pdf";
}

export const KIND_LABELS: Record<DocumentKind, string> = {
  pdf: "PDF",
  markdown: "Markdown",
};

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

  const name = file.name.toLowerCase();
  const looksPdf = file.type === LIMITS.mime || name.endsWith(".pdf");
  const looksMarkdown = MARKDOWN_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (!looksPdf && !looksMarkdown) {
    return {
      ok: false,
      reason: `Only PDF and Markdown are accepted. This file reports ${file.type || "an unknown type"}.`,
    };
  }
  return { ok: true };
}

/** §6.3 — verify the bytes before upload, so a file that lies about what it
    is gets caught in the drop zone rather than by the parser.

    The two kinds are checkable in different ways, and the refusal says which
    check failed rather than a generic "invalid file":

      PDF       a fixed five-byte magic header
      Markdown  no magic header exists, so the only honest check is the
                negative one — a NUL byte in the first block means this is a
                binary file wearing a .md extension, and the line scanner
                would read compressed bytes as prose. */
export async function verifyMagicHeader(file: File): Promise<PrecheckResult> {
  const kind = detectKind(file);

  if (kind === "pdf") {
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

  const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  if (head.includes(0)) {
    return {
      ok: false,
      reason:
        "The file is named .md but contains binary data. It is not Markdown text.",
    };
  }
  // A %PDF- payload under a .md name is a PDF; say so rather than running the
  // line scanner over compressed streams and calling the result a scan.
  if (String.fromCharCode(...head.slice(0, 5)) === "%PDF-") {
    return {
      ok: false,
      reason:
        "The file is named .md but begins with %PDF-. Rename it to .pdf and scan it as one.",
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
  /** Live-mode upload or fetched sample. Demo streams ignore it. */
  file?: File;
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
  endpoint: string = SCAN_ENDPOINT,
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

export async function fetchSampleFile(
  id: SampleId,
  opts: { signal?: AbortSignal } = {},
): Promise<File> {
  const res = await fetch(`${SAMPLE_ENDPOINT_BASE}/${id}`, {
    method: "GET",
    signal: opts.signal,
  });
  if (!res.ok) {
    throw new Error(`Sample ${id} could not be loaded from the scan backend.`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const name = match?.[1] ?? `${id}.pdf`;
  // The server names the kind through Content-Type; falling back to the
  // extension keeps a sample usable if a proxy strips it.
  const fallback = MARKDOWN_EXTENSIONS.some((ext) =>
    name.toLowerCase().endsWith(ext),
  )
    ? LIMITS.markdownMime
    : LIMITS.mime;
  return new File([blob], name, { type: blob.type || fallback });
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
