/**
 * The page preview — FRONTEND_DESIGN.md §6.1 pane 1, §10.2.
 *
 * The point of this pane is that the boxes sit on the document they describe.
 * So what these tests hold fixed is the honesty of the surface underneath
 * them:
 *
 *   a real file is rasterised and the pane says the page is the real one
 *   no file falls back to the synthetic surface and says THAT, clearly
 *   a file the renderer refuses degrades to synthetic, names the reason, and
 *     still draws the findings — the scan's result is not withheld because
 *     the picture is missing
 *   the overlay is unchanged by the swap: same coordinate space, same boxes
 */
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PageViewer } from "@/components/scanner/PageViewer";
import { MALICIOUS } from "@/lib/fixtures/scans";
import { createPdfjsDouble, pdfFile, stubCanvasContext } from "./pdfjs-double";

const pdfjs = vi.hoisted(() => ({
  ref: null as ReturnType<typeof createPdfjsDouble> | null,
}));
vi.mock("pdfjs-dist", () => pdfjs.ref!);

const double = createPdfjsDouble();
pdfjs.ref = double;

const findings = MALICIOUS.findings;

/** The pane with a working pager, so a page change is driven the way the
    Scanner drives it rather than by re-rendering with a new prop. */
function Preview({
  page: initialPage = 1,
  ...props
}: Omit<Partial<React.ComponentProps<typeof PageViewer>>, "onPageChange">) {
  const [page, setPage] = React.useState(initialPage);
  return (
    <PageViewer
      filename="report.pdf"
      kind="pdf"
      pages={12}
      findings={findings}
      selectedId={null}
      pulseKey={0}
      demo={false}
      {...props}
      page={page}
      onPageChange={setPage}
    />
  );
}

const canvas = () => screen.queryByTestId("pdf-page-canvas");
const surface = () => screen.getByRole("img").getAttribute("data-surface");

beforeEach(() => {
  double.reset();
  stubCanvasContext();
});

describe("§6.1 — a real file is the real page", () => {
  it("rasterises the scanned file instead of the synthetic surface", async () => {
    render(<Preview file={pdfFile()} />);

    await waitFor(() => expect(double.renders.length).toBeGreaterThan(0));
    expect(canvas()).toBeInTheDocument();
    expect(surface()).toBe("document");
    expect(screen.queryByText(/synthetic surface/i)).not.toBeInTheDocument();
  });

  it("says in the caption and the accessible name that the page is the real one", async () => {
    render(<Preview file={pdfFile()} />);

    await waitFor(() =>
      expect(
        screen.getByText(/the scanned page itself, rendered in your browser/i),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /rendered from the scanned file/i,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(/report\.pdf/);
  });

  it("draws the page the pager is on, and redraws when it changes", async () => {
    const user = userEvent.setup();
    render(<Preview file={pdfFile()} />);

    await waitFor(() => expect(double.renders.length).toBeGreaterThan(0));
    expect(double.renders.at(-1)?.page).toBe(1);

    await user.click(screen.getByLabelText("Next page"));

    await waitFor(() => expect(double.renders.at(-1)?.page).toBe(2));
    expect(canvas()).toHaveAttribute("data-page", "2");
  });

  it("still draws every bbox on the page, in the same coordinate space", async () => {
    render(<Preview file={pdfFile()} />);
    await waitFor(() => expect(double.renders.length).toBeGreaterThan(0));

    const drawn = screen
      .getByTestId("bbox-overlay")
      .querySelectorAll(".sx-bbox");
    const onPageOne = findings.filter((f) => f.bbox?.page === 1);
    expect(drawn).toHaveLength(onPageOne.length);

    // 612 x 792 percentages, unchanged by the surface swap.
    const first = onPageOne[0].bbox!;
    expect((drawn[0] as HTMLElement).style.left).toBe(
      `${(first.x0 / 612) * 100}%`,
    );
    expect((drawn[0] as HTMLElement).style.top).toBe(
      `${(first.y0 / 792) * 100}%`,
    );
  });

  it("opens the document once per file, and releases it on unmount", async () => {
    const { unmount } = render(<Preview file={pdfFile()} />);
    await waitFor(() => expect(double.renders.length).toBeGreaterThan(0));
    expect(double.opened).toHaveLength(1);

    unmount();
    await waitFor(() => expect(double.destroyed).toBe(1));
  });
});

describe("§10.2 — a surface that is not the document says so", () => {
  it("falls back to the synthetic page when there is no file", () => {
    render(<Preview file={null} demo />);

    expect(canvas()).not.toBeInTheDocument();
    expect(surface()).toBe("synthetic");
    expect(screen.getByText(/synthetic surface/i)).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAccessibleName(/synthetic stand-in/i);
  });

  it("names demo mode as the reason when demo mode is the reason", () => {
    render(<Preview file={null} demo />);
    expect(
      screen.getByText(/demo mode renders a synthetic page/i),
    ).toBeInTheDocument();
  });

  it("degrades to the synthetic page, and names the reason, when the file will not open", async () => {
    double.openError = new Error("Invalid PDF structure");
    render(<Preview file={pdfFile()} />);

    await waitFor(() => expect(surface()).toBe("synthetic"));
    expect(
      screen.getByText(/the page itself could not be rendered/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Invalid PDF structure\./)).toBeInTheDocument();
    expect(
      screen.queryByText(/demo mode renders a synthetic page/i),
    ).not.toBeInTheDocument();
  });

  it("keeps showing the findings when the page will not render", async () => {
    double.openError = new Error("Invalid PDF structure");
    render(<Preview file={pdfFile()} />);

    await waitFor(() => expect(surface()).toBe("synthetic"));
    const drawn = screen
      .getByTestId("bbox-overlay")
      .querySelectorAll(".sx-bbox");
    expect(drawn).toHaveLength(findings.filter((f) => f.bbox?.page === 1).length);
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /could not be rendered/i,
    );
  });

  it("does not carry a stale failure caption into the next document", async () => {
    double.openError = new Error("Invalid PDF structure");
    const { rerender } = render(<Preview file={pdfFile("bad.pdf")} />);
    await waitFor(() => expect(surface()).toBe("synthetic"));

    double.openError = null;
    rerender(<Preview file={pdfFile("good.pdf")} />);

    await waitFor(() => expect(surface()).toBe("document"));
    expect(
      screen.queryByText(/could not be rendered/i),
    ).not.toBeInTheDocument();
  });
});
