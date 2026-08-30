"use client";

/* =========================================================================
   The instrument — FRONTEND_DESIGN.md §6. Zone B, whole.
   -------------------------------------------------------------------------
   "Designed against Linear's standard: keyboard-first, optimistic, instant.
   The success metric is time-to-verdict, and nothing on this screen may
   compete with it."

   This component owns three things and delegates everything else:

   1. LAYOUT (§6.1) — header, three panes, status line. The panes are
      PageViewer | FindingsList | VerdictPanel, each of which Act 3 also
      renders (§5.3), so the narrative site cannot show a scanner that
      differs from the one that ships.

   2. THE KEYBOARD LAYER (§6.4) — the whole table, bound here rather than
      scattered through the panes, because a shortcut that lives in the
      component it affects stops working the moment focus leaves it. The
      bindings and the `?` sheet read from one list in CommandPalette.tsx.

   3. SELECTION (§6.1) — "Selecting a finding scrolls the preview to its page,
      pulses its bbox once (120ms), and expands its evidence." That is one
      state transition, so it is one function, `select()`.

   What is deliberately NOT here: marketing copy (§11 — "Zone B sells
   nothing"), any animation library (§8 — Zone B's count is "none"), and any
   celebration of a clean result (§6.5).
   ========================================================================= */

import * as React from "react";
/* The instrument's stylesheet is imported HERE rather than from a route
   layout, so it travels with the component. Act 7 embeds this same component
   inside Zone A (§5.7); a route-scoped import would have styled /scan and
   left the embed bare. Next.js dedupes it across both routes. */
import "@/styles/scanner.css";
import { Button } from "@/components/primitives/Button";
import { Kbd } from "@/components/primitives/Kbd";
import {
  CommandPalette,
  ShortcutSheet,
  type Command,
} from "@/components/primitives/CommandPalette";
import { DropZone } from "./DropZone";
import { FindingsList } from "./FindingsList";
import { PageViewer } from "./PageViewer";
import { PhaseLedger } from "./PhaseLedger";
import { VerdictPanel } from "./VerdictPanel";
import { scanToJson, useScan, type ScanStreamFactory } from "./useScan";
import { fetchSampleFile, formatBytes, isDemoMode } from "@/lib/api";
import { SAMPLE_LABELS, SAMPLE_ORDER, type SampleId } from "@/lib/fixtures/scans";

export interface ScannerProps {
  /** Pre-load a sample, e.g. /scan?sample=malicious from the hero CTA (§5.0),
      or Act 7's pre-loaded malicious document (§5.7). */
  initialSample?: SampleId | null;
  /** Act 7 embeds the identical component inline rather than full-bleed. */
  embedded?: boolean;
  /** Test seam. §10.3 step 8 passes `streamLiveScan` here. */
  stream?: ScanStreamFactory;
}

export function Scanner({
  initialSample = null,
  embedded = false,
  stream,
}: ScannerProps) {
  const scan = useScan(stream);
  const { start, reset, cancel } = scan;
  const lastRunRef = React.useRef<{
    sample: SampleId;
    uploadName: string | null;
    file?: File;
  } | null>(null);

  const [page, setPage] = React.useState(1);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [pulseKey, setPulseKey] = React.useState(0);
  const [focusKey, setFocusKey] = React.useState(0);
  const [overlay, setOverlay] = React.useState<null | "palette" | "shortcuts">(
    null,
  );
  const [copied, setCopied] = React.useState(false);
  const [announcement, setAnnouncement] = React.useState("");

  const demo = isDemoMode() || scan.response?.demo === true;
  const settled = scan.status === "complete";

  const beginScan = React.useCallback(
    (sample: SampleId, uploadName: string | null = null, file?: File) => {
      lastRunRef.current = { sample, uploadName, file };
      start(sample, uploadName, file);
    },
    [start],
  );

  /* ---- Auto-start from the URL / the Act 7 embed. Runs once. --------- */
  const started = React.useRef(false);
  React.useEffect(() => {
    if (started.current || !initialSample) return;
    started.current = true;
    beginScan(initialSample);
  }, [initialSample, beginScan]);

  /* ---- §7.3: "the count announced on scan completion", once. A live
         region that fires per frame is unusable, so this is the ONLY place
         that writes one, and it writes a settled fact. ------------------ */
  React.useEffect(() => {
    if (scan.status === "complete" && scan.response) {
      setAnnouncement(
        `Scan complete. ${scan.findings.length} finding${
          scan.findings.length === 1 ? "" : "s"
        }. Verdict ${scan.response.verdict}, R equals ${scan.response.score.toFixed(2)}.`,
      );
    } else if (scan.status === "failed") {
      setAnnouncement(
        `Scan failed at phase ${scan.failure?.phase ?? "unknown"}. The document was not cleared.`,
      );
    } else if (scan.status === "cancelled") {
      setAnnouncement("Scan cancelled. The document was not cleared.");
    }
  }, [scan.status, scan.response, scan.findings.length, scan.failure]);

  /* ---- Selection is one transition (§6.1). ------------------------- */
  const select = React.useCallback(
    (id: string, viaKeyboard: boolean) => {
      const finding = scan.findings.find((f) => f.id === id);
      if (!finding) return;
      setSelectedId(id);
      setPage(finding.bbox?.page ?? finding.page);
      setPulseKey((k) => k + 1);
      if (viaKeyboard) setFocusKey((k) => k + 1);
    },
    [scan.findings],
  );

  const step = React.useCallback(
    (delta: number) => {
      if (scan.findings.length === 0) return;
      const i = scan.findings.findIndex((f) => f.id === selectedId);
      const next =
        i === -1
          ? delta > 0
            ? 0
            : scan.findings.length - 1
          : (i + delta + scan.findings.length) % scan.findings.length;
      select(scan.findings[next].id, true);
    },
    [scan.findings, selectedId, select],
  );

  const copyJson = React.useCallback(() => {
    const json = scanToJson(scan);
    void navigator.clipboard?.writeText?.(json)?.catch?.(() => {
      /* Clipboard denied (no permission, insecure context). The response is
         reachable from the panel either way; a failed copy is not a failed
         scan and must not be reported as one. */
    });
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }, [scan]);

  const rescan = React.useCallback(() => {
    const last = lastRunRef.current;
    if (last) beginScan(last.sample, last.uploadName, last.file);
  }, [beginScan]);

  const newScan = React.useCallback(() => {
    setSelectedId(null);
    setExpandedId(null);
    setPage(1);
    lastRunRef.current = null;
    reset();
  }, [reset]);

  const scanSample = React.useCallback(
    async (id: SampleId) => {
      setSelectedId(null);
      setExpandedId(null);
      setPage(1);
      if (isDemoMode()) {
        beginScan(id);
        return;
      }
      try {
        const file = await fetchSampleFile(id);
        beginScan(id, file.name, file);
      } catch {
        beginScan(id);
      }
    },
    [beginScan],
  );

  /* ---- §6.4, the whole table. One handler, on the document, so the
         shortcuts work wherever focus sits inside the tool. ------------ */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

      // ⌘K survives a text field; every single-letter binding must not.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOverlay((o) => (o === "palette" ? null : "palette"));
        return;
      }
      if (overlay || typing || e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "j":
          e.preventDefault();
          step(1);
          break;
        case "k":
          e.preventDefault();
          step(-1);
          break;
        case "Enter":
          if (!selectedId) break;
          e.preventDefault();
          setExpandedId((x) => (x === selectedId ? null : selectedId));
          break;
        case "c":
          e.preventDefault();
          copyJson();
          break;
        case "r":
          e.preventDefault();
          rescan();
          break;
        case "?":
          e.preventDefault();
          setOverlay("shortcuts");
          break;
        default: {
          // `1` … `9` jump to page.
          if (/^[1-9]$/.test(e.key) && scan.document) {
            const n = Number(e.key);
            if (n <= scan.document.pages) {
              e.preventDefault();
              setPage(n);
            }
          }
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [overlay, selectedId, step, copyJson, rescan, scan.document]);

  /* ---- The palette's commands. Disabled ones carry their reason (§6.3). */
  const commands: Command[] = React.useMemo(() => {
    const list: Command[] = SAMPLE_ORDER.map((id) => ({
      id: `sample-${id}`,
      label: `Load sample · ${SAMPLE_LABELS[id]}`,
      hint: "scan",
      run: () => {
        setSelectedId(null);
        setExpandedId(null);
        setPage(1);
        void scanSample(id);
      },
    }));

    list.push(
      {
        id: "rescan",
        label: "Re-scan this document",
        hint: "r",
        disabledReason: scan.sample ? undefined : "Nothing scanned yet",
        run: rescan,
      },
      {
        id: "copy",
        label: "Copy JSON response",
        hint: "c",
        disabledReason:
          scan.status === "idle" ? "Nothing scanned yet" : undefined,
        run: copyJson,
      },
      { id: "new", label: "New scan", run: newScan },
      {
        id: "shortcuts",
        label: "Keyboard shortcuts",
        hint: "?",
        run: () => setOverlay("shortcuts"),
      },
    );

    // §6.4's "jump to finding".
    for (const f of scan.findings) {
      list.push({
        id: `finding-${f.id}`,
        label: `Finding · p${f.page} ${f.label}`,
        hint: f.score.toFixed(2),
        run: () => select(f.id, true),
      });
    }
    return list;
  }, [
    scan.findings,
    scan.sample,
    scan.status,
    scanSample,
    rescan,
    copyJson,
    newScan,
    select,
  ]);

  const doc = scan.document;

  return (
    <div className="sx-root" data-embedded={embedded || undefined}>
      {/* ---- Header (§6.1) ------------------------------------------- */}
      <header className="sx-header">
        <span className="sx-wordmark">SanitX</span>
        {doc && (
          <span className="sx-docmeta from-document">
            {doc.filename} · {doc.pages} page{doc.pages === 1 ? "" : "s"} ·{" "}
            {formatBytes(doc.bytes)}
          </span>
        )}
        <span className="sx-header-end">
          <span className="sx-kbd-hint">
            <Kbd>⌘K</Kbd>
          </span>
          {scan.scanning ? (
            /* §6.5 — "cancel button that actually aborts the request." */
            <Button variant="secondary" onClick={cancel}>
              Cancel
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={newScan}
              disabled={scan.status === "idle"}
            >
              New scan
            </Button>
          )}
        </span>
      </header>

      {scan.status === "idle" ? (
        /* ---- Empty state (§6.5): drop zone, three samples, and the caps
                stated BEFORE upload rather than inside an error. -------- */
        <div className="sx-empty">
          <DropZone
            onSample={(id) => void scanSample(id)}
            onAccept={(file) => {
              beginScan("malicious", file.name, file);
            }}
          />
          <div>
            <PhaseLedger phases={scan.phases} />
            <p className="sx-note">
              Six phases. Each renders as it completes rather than behind a
              spinner, so the document&rsquo;s state stays legible throughout
              the scan.
            </p>
          </div>
        </div>
      ) : (
        <div className="sx-panes">
          {/* ---- Pane 1 — the page ------------------------------------ */}
          <section className="sx-pane" aria-label="Page preview">
            <PageViewer
              filename={doc?.filename ?? scan.uploadName ?? "document.pdf"}
              pages={doc?.pages ?? 1}
              page={page}
              onPageChange={setPage}
              findings={scan.findings}
              selectedId={selectedId}
              pulseKey={pulseKey}
              demo={demo}
            />
          </section>

          {/* ---- Pane 2 — findings, with the ledger above them, because
                  §6.2 wants the phases visible while they land. -------- */}
          <section className="sx-pane" aria-label="Findings">
            <PhaseLedger
              phases={scan.phases}
              totalMs={settled ? (scan.response?.totalMs ?? null) : null}
            />
            <h2 className="sx-pane-title">
              <span>Findings</span>
              <span className="sx-pane-title-count from-document tabular">
                {scan.findings.length}
              </span>
            </h2>
            <FindingsList
              findings={scan.findings}
              selectedId={selectedId}
              expandedId={expandedId}
              onSelect={(id) => select(id, false)}
              onToggleExpand={(id) =>
                setExpandedId((x) => (x === id ? null : id))
              }
              focusKey={focusKey}
              scanning={scan.scanning}
              settled={settled}
            />
          </section>

          {/* ---- Pane 3 — the verdict -------------------------------- */}
          <VerdictPanel
            status={scan.status}
            response={scan.response}
            divergence={scan.divergence}
            tiers={scan.tiers}
            failure={scan.failure}
            demo={demo}
            onExportJson={copyJson}
            copied={copied}
          />
        </div>
      )}

      {/* §7.3 — one polite region, written once per settled run. It is
          rendered VISIBLY: §7.1 treats visually-hidden text as a blocking
          defect on this product of all products. */}
      <p className="sx-status" role="status" aria-live="polite">
        {announcement ||
          (scan.scanning
            ? "Scanning. Phases render as they complete."
            : "Ready. Press ⌘K for commands, ? for shortcuts.")}
      </p>

      {overlay === "palette" && (
        <CommandPalette commands={commands} onClose={() => setOverlay(null)} />
      )}
      {overlay === "shortcuts" && (
        <ShortcutSheet onClose={() => setOverlay(null)} />
      )}
    </div>
  );
}
