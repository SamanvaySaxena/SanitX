/**
 * The instrument shows the document it scanned — §6.1, §5.7, §5.9.
 *
 * Two surfaces have to reach the real page, not one:
 *
 *   /scan            — an upload, or a sample loaded from the empty state
 *   Act 7's "Run it" — the SAME component, pre-loaded, on the marketing page
 *
 * §5.9: "the single strongest trust signal on this site is that a visitor can
 * run the thing in ten seconds and check whether it does what Act 0 claimed."
 * A preview that could only ever show a greeked stand-in forfeits exactly
 * that, so the pre-loaded embed fetches the sample's BYTES and not just its
 * verdict. That is the behaviour these tests pin.
 */
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MALICIOUS } from "@/lib/fixtures/scans";
import type { ScanEvent, ScanResponse } from "@/lib/types";
import type { ScanStreamFactory } from "@/components/scanner/useScan";
import { createPdfjsDouble, pdfFile, stubCanvasContext } from "./pdfjs-double";

const pdfjs = vi.hoisted(() => ({
  ref: null as ReturnType<typeof createPdfjsDouble> | null,
}));
vi.mock("pdfjs-dist", () => pdfjs.ref!);

const double = createPdfjsDouble();
pdfjs.ref = double;

/* Live mode, with a stubbed sample fetch. Everything else in lib/api is the
   real thing — the point is the scanner's behaviour, not the client's. */
const api = vi.hoisted(() => ({
  demo: false,
  fetchSampleFile: vi.fn(),
}));
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    isDemoMode: () => api.demo,
    fetchSampleFile: api.fetchSampleFile,
  };
});

// Imported after the mocks so the Scanner picks them up.
const { Scanner } = await import("@/components/scanner/Scanner");

const eventsFor = (r: ScanResponse): ScanEvent[] => [
  { type: "document", document: r.document },
  ...r.phases.map((p) => ({ type: "phase" as const, phase: p })),
  { type: "findings", findings: r.findings },
  { type: "verdict", response: r },
];

/** Records the file each run was handed, so "did the bytes get here" is an
    assertion rather than an inference. */
function recordingStream(): ScanStreamFactory & { files: (File | undefined)[] } {
  const files: (File | undefined)[] = [];
  const factory: ScanStreamFactory = async function* (_sample, opts) {
    files.push(opts.file);
    for (const e of eventsFor(MALICIOUS)) yield e;
  };
  return Object.assign(factory, { files });
}

const surface = () => screen.getByRole("img").getAttribute("data-surface");

beforeEach(() => {
  double.reset();
  stubCanvasContext();
  api.demo = false;
  api.fetchSampleFile.mockReset();
  api.fetchSampleFile.mockResolvedValue(pdfFile("sanitx_ultimate_test.pdf"));
});

describe("§5.7 — the pre-loaded embed reaches the real document", () => {
  it("fetches the sample's bytes, not just its verdict", async () => {
    const stream = recordingStream();
    render(<Scanner initialSample="malicious" embedded stream={stream} />);

    await waitFor(() => expect(api.fetchSampleFile).toHaveBeenCalledWith("malicious"));
    await waitFor(() => expect(stream.files[0]).toBeInstanceOf(File));
  });

  it("renders that document under the bounding boxes", async () => {
    render(<Scanner initialSample="malicious" embedded stream={recordingStream()} />);

    await waitFor(() => expect(surface()).toBe("document"));
    expect(screen.getByTestId("pdf-page-canvas")).toBeInTheDocument();
    await waitFor(() => expect(double.renders.length).toBeGreaterThan(0));
  });

  it("degrades to the synthetic page when the backend cannot supply the sample", async () => {
    api.fetchSampleFile.mockRejectedValue(new Error("Backend unreachable"));
    render(<Scanner initialSample="malicious" embedded stream={recordingStream()} />);

    await waitFor(() =>
      expect(screen.getByRole("img")).toBeInTheDocument(),
    );
    expect(surface()).toBe("synthetic");
    // The scan itself still reaches a verdict — a missing preview is not a
    // failed scan (§6.3 is about the pipeline, not the picture).
    expect(await screen.findByText(MALICIOUS.verdict)).toBeInTheDocument();
  });

  it("never asks the backend for a sample file in demo mode", async () => {
    api.demo = true;
    render(<Scanner initialSample="malicious" embedded stream={recordingStream()} />);

    await waitFor(() => expect(screen.getByRole("img")).toBeInTheDocument());
    expect(api.fetchSampleFile).not.toHaveBeenCalled();
    expect(surface()).toBe("synthetic");
  });
});

describe("§6.1 — an uploaded document is the one previewed", () => {
  it("renders the file the user dropped", async () => {
    const user = userEvent.setup();
    const stream = recordingStream();
    render(<Scanner stream={stream} />);

    await user.upload(screen.getByLabelText(/choose a pdf/i), pdfFile("mine.pdf"));

    await waitFor(() => expect(surface()).toBe("document"));
    expect(stream.files[0]?.name).toBe("mine.pdf");
    // The header still names the document the RESPONSE describes, not the
    // local filename — the pane previews the bytes, the response labels them.
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /rendered from the scanned file/i,
    );
    await waitFor(() => expect(double.renders.at(-1)?.page).toBe(1));
  });

  it("keeps the document across a re-scan", async () => {
    const user = userEvent.setup();
    const stream = recordingStream();
    render(<Scanner stream={stream} />);

    await user.upload(screen.getByLabelText(/choose a pdf/i), pdfFile("mine.pdf"));
    await waitFor(() => expect(surface()).toBe("document"));

    await user.keyboard("r");

    await waitFor(() => expect(stream.files).toHaveLength(2));
    expect(stream.files[1]?.name).toBe("mine.pdf");
    expect(surface()).toBe("document");
  });

  it("releases the document on a new scan", async () => {
    const user = userEvent.setup();
    render(<Scanner stream={recordingStream()} />);

    await user.upload(screen.getByLabelText(/choose a pdf/i), pdfFile("mine.pdf"));
    await waitFor(() => expect(surface()).toBe("document"));

    await user.click(screen.getByRole("button", { name: /new scan/i }));

    expect(screen.queryByTestId("pdf-page-canvas")).not.toBeInTheDocument();
    await waitFor(() => expect(double.destroyed).toBeGreaterThan(0));
  });
});
