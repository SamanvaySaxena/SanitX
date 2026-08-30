/* =========================================================================
   Copies the PDF.js runtime assets into public/pdfjs/.
   -------------------------------------------------------------------------
   The renderer needs three things at RUNTIME that a bundler cannot inline:

     pdf.worker.min.mjs  the worker the main thread spawns
     standard_fonts/     the 14 base-PDF fonts, fetched only when a document
                         references one it does not embed
     cmaps/              CID -> Unicode maps for CJK and other encoded fonts

   Serving them from public/ under a version-stamped path — rather than
   pointing GlobalWorkerOptions.workerSrc at a CDN — keeps the whole render
   path first-party. A tool whose job is to tell you a PDF is hostile has no
   business handing that PDF's fonts to a third-party host, and a CDN outage
   would degrade a security verdict into a blank page.

   Runs from predev / prebuild / pretest, so the copy can never drift from the
   installed version of pdfjs-dist. public/pdfjs/ is gitignored for the same
   reason: node_modules is the single source of truth.
   ========================================================================= */
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
const root = process.cwd();

const pkgPath = require.resolve("pdfjs-dist/package.json");
const pdfjsRoot = path.dirname(pkgPath);
const { version } = require(pkgPath);

const dest = path.join(root, "public", "pdfjs");

await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });

await cp(
  path.join(pdfjsRoot, "build", "pdf.worker.min.mjs"),
  path.join(dest, "pdf.worker.min.mjs"),
);
await cp(path.join(pdfjsRoot, "standard_fonts"), path.join(dest, "standard_fonts"), {
  recursive: true,
});
await cp(path.join(pdfjsRoot, "cmaps"), path.join(dest, "cmaps"), {
  recursive: true,
});

// Read back by nothing — it exists so a stale copy is diagnosable by eye.
await writeFile(
  path.join(dest, "VERSION"),
  `pdfjs-dist ${version}\n`,
  "utf8",
);

process.stdout.write(`pdfjs assets synced (pdfjs-dist ${version}) -> public/pdfjs\n`);
