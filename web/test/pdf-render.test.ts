/**
 * The PDF.js seam — FRONTEND_DESIGN.md §6.1, §9.1.
 *
 * These assert the contract lib/pdf/render.ts holds the renderer to, not the
 * renderer itself:
 *
 *   the renderer is hardened, because the documents it draws are hostile
 *   every runtime asset is first-party, so a CDN cannot break a verdict
 *   the raster keeps the PAGE's aspect ratio — the 612x792 normalisation the
 *     bboxes rely on is applied by CSS, on purpose (see the module header)
 *   a cancelled render is an expected outcome, never an error
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPdfjsDouble, stubCanvasContext } from "./pdfjs-double";

const pdfjs = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return { ref: null as ReturnType<typeof createPdfjsDouble> | null };
});

vi.mock("pdfjs-dist", () => pdfjs.ref!);

const double = createPdfjsDouble();
pdfjs.ref = double;

// The module caches its dynamic import for the life of the tab, so it is
// re-imported fresh per test rather than reset in place.
async function loadModule() {
  vi.resetModules();
  return import("@/lib/pdf/render");
}

const buffer = () => new TextEncoder().encode("%PDF-1.7\n").buffer;

beforeEach(() => {
  double.reset();
  stubCanvasContext();
});

describe("§9.1 — the renderer is loaded once, and hardened", () => {
  it("points the worker at a first-party path, never a CDN", async () => {
    const { openPdf, PDF_ASSET_BASE } = await loadModule();
    await openPdf(buffer());

    expect(PDF_ASSET_BASE).toBe("/pdfjs/");
    expect(double.GlobalWorkerOptions.workerSrc).toBe(
      "/pdfjs/pdf.worker.min.mjs",
    );
    expect(double.GlobalWorkerOptions.workerSrc).not.toMatch(/^https?:/);
  });

  it("opens documents with eval, XFA and network refetching all off", async () => {
    const { openPdf } = await loadModule();
    await openPdf(buffer());

    const opts = double.opened[0];
    expect(opts.isEvalSupported).toBe(false);
    expect(opts.enableXfa).toBe(false);
    expect(opts.disableAutoFetch).toBe(true);
    expect(opts.disableStream).toBe(true);
  });

  it("resolves fonts and cmaps from the same first-party path", async () => {
    const { openPdf } = await loadModule();
    await openPdf(buffer());

    const opts = double.opened[0];
    expect(opts.standardFontDataUrl).toBe("/pdfjs/standard_fonts/");
    expect(opts.cMapUrl).toBe("/pdfjs/cmaps/");
    expect(String(opts.standardFontDataUrl)).not.toMatch(/^https?:/);
    expect(String(opts.cMapUrl)).not.toMatch(/^https?:/);
  });

  it("reports the renderer's own page count, not the response's", async () => {
    double.pages = 4;
    const { openPdf } = await loadModule();
    const doc = await openPdf(buffer());
    expect(doc.pages).toBe(4);
  });
});

describe("§6.1 — the raster", () => {
  it("draws the page the caller asked for", async () => {
    const { openPdf } = await loadModule();
    const doc = await openPdf(buffer());
    const canvas = document.createElement("canvas");

    await doc.renderPage(7, canvas, 612);

    expect(double.renders.map((r) => r.page)).toEqual([7]);
  });

  it("clamps a page outside the document rather than throwing", async () => {
    double.pages = 3;
    const { openPdf } = await loadModule();
    const doc = await openPdf(buffer());
    const canvas = document.createElement("canvas");

    await doc.renderPage(99, canvas, 612);
    await doc.renderPage(0, canvas, 612);

    expect(double.requestedPages).toEqual([3, 1]);
  });

  it("keeps the page's own aspect ratio in the raster — the 612x792 squeeze is CSS's job", async () => {
    // A4: 595 x 842. If the module normalised the RASTER to 612x792 it would
    // apply the transform twice, once here and once in .sx-page-canvas, and
    // every box on an A4 document would sit off its glyphs.
    double.pageSize = { width: 595, height: 842 };
    const { openPdf } = await loadModule();
    const doc = await openPdf(buffer());
    const canvas = document.createElement("canvas");

    await doc.renderPage(1, canvas, 595);

    const drawn = double.renders[0];
    expect(drawn.width / drawn.height).toBeCloseTo(595 / 842, 5);
    expect(canvas.width / canvas.height).toBeCloseTo(595 / 842, 5);
  });

  it("rasterises at the requested CSS width, scaled by device pixel ratio", async () => {
    const { openPdf } = await loadModule();
    const doc = await openPdf(buffer());
    const canvas = document.createElement("canvas");

    await doc.renderPage(1, canvas, 306);

    // jsdom reports devicePixelRatio 1, so the raster is the CSS width.
    expect(canvas.width).toBe(306);
    expect(double.renders[0].scale).toBeCloseTo(306 / 612, 5);
  });

  it("draws nothing, and does not throw, when the canvas has no 2D context", async () => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: () => null,
    });
    const { openPdf } = await loadModule();
    const doc = await openPdf(buffer());

    await expect(
      doc.renderPage(1, document.createElement("canvas"), 612),
    ).resolves.toBeUndefined();
    expect(double.renders).toHaveLength(0);
  });
});

describe("a cancelled render is not a failure", () => {
  it("cancels the in-flight render when its signal aborts, and resolves quietly", async () => {
    double.holdRenders = true;
    const { openPdf } = await loadModule();
    const doc = await openPdf(buffer());
    const controller = new AbortController();

    const pending = doc.renderPage(
      1,
      document.createElement("canvas"),
      612,
      controller.signal,
    );
    // Let the render actually begin. Aborting before it starts is the other
    // test; this one is about a render already on the canvas.
    while (double.renders.length === 0) await Promise.resolve();
    controller.abort();

    await expect(pending).resolves.toBeUndefined();
    expect(double.cancelled).toBe(1);
  });

  it("never starts a render for an already-aborted signal", async () => {
    const { openPdf } = await loadModule();
    const doc = await openPdf(buffer());
    const controller = new AbortController();
    controller.abort();

    await doc.renderPage(
      1,
      document.createElement("canvas"),
      612,
      controller.signal,
    );

    expect(double.renders).toHaveLength(0);
  });

  it("still surfaces a real render error", async () => {
    double.renderError = new Error("Corrupt content stream.");
    const { openPdf } = await loadModule();
    const doc = await openPdf(buffer());

    await expect(
      doc.renderPage(1, document.createElement("canvas"), 612),
    ).rejects.toThrow("Corrupt content stream.");
  });

  it("draws nothing more once the handle is destroyed", async () => {
    const { openPdf } = await loadModule();
    const doc = await openPdf(buffer());
    doc.destroy();

    await doc.renderPage(1, document.createElement("canvas"), 612);

    expect(double.renders).toHaveLength(0);
    expect(double.destroyed).toBe(1);
  });
});

describe("openPdfFile", () => {
  it("copies the file's bytes, so a re-scan of the same File still opens", async () => {
    const { openPdfFile } = await loadModule();
    const bytes = new TextEncoder().encode("%PDF-1.7\n");
    const file = new File([bytes], "report.pdf", { type: "application/pdf" });
    const source = bytes.buffer.slice(0);
    Object.defineProperty(file, "arrayBuffer", {
      configurable: true,
      value: () => Promise.resolve(source),
    });

    await openPdfFile(file);
    await openPdfFile(file);

    expect(double.opened).toHaveLength(2);
    // pdf.js detaches whatever buffer it is handed; handing it the same one
    // twice is the bug this copy exists to prevent.
    expect(double.opened[0].data).not.toBe(source);
    expect(double.opened[1].data).not.toBe(double.opened[0].data);
  });
});
