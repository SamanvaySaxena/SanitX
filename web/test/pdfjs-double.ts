/**
 * A pdf.js test double.
 *
 * The real library needs a Worker, a canvas 2D context and font/cmap fetches,
 * none of which jsdom has. What the suite actually needs to pin down is the
 * CONTRACT lib/pdf/render.ts holds it to — which options it opens a document
 * with, which page it asks for, how big it makes the raster, and what it does
 * when a render is cancelled — so this double records exactly that.
 */
import { vi } from "vitest";

export interface RenderRecord {
  page: number;
  width: number;
  height: number;
  scale: number;
}

export interface PdfjsDouble {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: ReturnType<typeof vi.fn>;
  /** Every getDocument({...}) argument, in order. */
  opened: Record<string, unknown>[];
  /** Every page.render() the module drove, in order. */
  renders: RenderRecord[];
  /** Pages asked for by number, in order — including out-of-range requests
      AFTER the module has clamped them. */
  requestedPages: number[];
  /** Renders the module cancelled rather than awaited. */
  cancelled: number;
  destroyed: number;
  /** Intrinsic page size the double reports. Default is US Letter; set A4
      to prove the raster keeps the page's own aspect ratio. */
  pageSize: { width: number; height: number };
  pages: number;
  /** When set, getDocument rejects with this. */
  openError: Error | null;
  /** When set, page.render() rejects with this. */
  renderError: Error | null;
  /** When true, a started render stays in flight until cancel() — the only
      way to test the abort path, which by definition needs a render that has
      begun and not yet finished. */
  holdRenders: boolean;
  reset(): void;
}

export function createPdfjsDouble(): PdfjsDouble {
  const d: PdfjsDouble = {
    GlobalWorkerOptions: { workerSrc: "" },
    getDocument: vi.fn(),
    opened: [],
    renders: [],
    requestedPages: [],
    cancelled: 0,
    destroyed: 0,
    pageSize: { width: 612, height: 792 },
    pages: 12,
    openError: null,
    renderError: null,
    holdRenders: false,
    reset() {
      d.GlobalWorkerOptions.workerSrc = "";
      d.opened.length = 0;
      d.renders.length = 0;
      d.requestedPages.length = 0;
      d.cancelled = 0;
      d.destroyed = 0;
      d.pageSize = { width: 612, height: 792 };
      d.pages = 12;
      d.openError = null;
      d.renderError = null;
      d.holdRenders = false;
    },
  };

  d.getDocument.mockImplementation((params: Record<string, unknown>) => {
    d.opened.push(params);
    if (d.openError) return { promise: Promise.reject(d.openError) };

    const doc = {
      numPages: d.pages,
      destroy: () => {
        d.destroyed += 1;
        return Promise.resolve();
      },
      getPage: (n: number) => {
        d.requestedPages.push(n);
        return Promise.resolve({
          cleanup: () => {},
          getViewport: ({ scale }: { scale: number }) => ({
            scale,
            width: d.pageSize.width * scale,
            height: d.pageSize.height * scale,
          }),
          render: ({
            viewport,
          }: {
            viewport: { width: number; height: number; scale: number };
          }) => {
            let reject!: (e: unknown) => void;
            const settled = d.renderError
              ? Promise.reject(d.renderError)
              : new Promise<void>((resolve, rej) => {
                  reject = rej;
                  if (!d.holdRenders) queueMicrotask(resolve);
                });
            d.renders.push({
              page: n,
              width: viewport.width,
              height: viewport.height,
              scale: viewport.scale,
            });
            return {
              promise: settled,
              cancel: () => {
                d.cancelled += 1;
                const err = new Error("Rendering cancelled");
                err.name = "RenderingCancelledException";
                reject?.(err);
              },
            };
          },
        });
      },
    };

    return { promise: Promise.resolve(doc) };
  });

  return d;
}

/** jsdom's canvas has no 2D context. lib/pdf/render.ts treats a missing one
    as "cannot draw" and returns quietly; these tests need it to draw. */
export function stubCanvasContext(): void {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    writable: true,
    value: () => ({}),
  });
}

/** A File that passes the drop zone's §6.3 gates: a real %PDF- header,
    non-empty, application/pdf. test/setup.ts supplies the Blob.arrayBuffer
    jsdom does not ship. */
export function pdfFile(name = "report.pdf"): File {
  const bytes = new TextEncoder().encode("%PDF-1.7\n% test double\n");
  return new File([bytes], name, { type: "application/pdf" });
}
