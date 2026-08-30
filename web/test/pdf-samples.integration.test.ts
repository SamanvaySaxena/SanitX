/**
 * @vitest-environment node
 *
 * The real PDF.js, against the real sample documents — §6.1, §10.3.
 *
 * Every other test in this area drives a double, which proves the wiring but
 * cannot prove the thing it is wired to works. This one opens the three PDFs
 * the backend serves from /api/samples with the SAME hardening flags the
 * browser uses (PDF_HARDENING, imported rather than restated), so a document
 * that the shipped configuration cannot parse fails here rather than in front
 * of a user.
 *
 * Rendering needs a canvas Node does not have, so this stops at parse: open
 * the file, count the pages, read page 1's box. That is the whole surface the
 * preview depends on before it touches a canvas.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PDF_HARDENING } from "@/lib/pdf/render";

/** routers.py#SAMPLES — the same three files, keyed by the same ids. */
const ROOT = path.resolve(process.cwd(), "..");
const SAMPLES: Record<string, string> = {
  clean: path.join(ROOT, "sanitx_clean_test.pdf"),
  borderline: path.join(ROOT, "sanitx_test.pdf"),
  malicious: path.join(ROOT, "sanitx_ultimate_test.pdf"),
};

const present = Object.entries(SAMPLES).filter(([, p]) => existsSync(p));

// Skipped rather than failed when the corpus is not checked out, so the suite
// still runs against a frontend-only clone.
describe.skipIf(present.length === 0)("the shipped renderer opens the real samples", () => {
  it.each(present)("parses the %s sample", async (id, file) => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const bytes = new Uint8Array(readFileSync(file));

    const doc = await pdfjs.getDocument({
      data: bytes,
      ...PDF_HARDENING,
      // No worker in Node; the flags under test are the hardening ones.
      useWorkerFetch: false,
      useSystemFonts: false,
    }).promise;

    expect(doc.numPages).toBeGreaterThan(0);

    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    expect(viewport.width).toBeGreaterThan(0);
    expect(viewport.height).toBeGreaterThan(0);

    await doc.destroy();
    // The id is in the name so a failure says WHICH sample broke.
    expect(id).toBeTruthy();
  });

  it("covers every sample routers.py serves", () => {
    expect(present.map(([id]) => id).sort()).toEqual([
      "borderline",
      "clean",
      "malicious",
    ]);
  });
});
