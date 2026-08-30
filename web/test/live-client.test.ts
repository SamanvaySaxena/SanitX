// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { streamLiveScan } from "@/lib/api";
import type { ScanEvent } from "@/lib/types";


function sseResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status });
}


async function collect(events: AsyncIterable<ScanEvent>): Promise<ScanEvent[]> {
  const out: ScanEvent[] = [];
  for await (const event of events) out.push(event);
  return out;
}


describe("streamLiveScan", () => {
  it("yields SSE events in order", async () => {
    const document = {
      filename: "sample.pdf",
      pages: 1,
      bytes: 5,
      sha256: "a".repeat(64),
    };
    const phase = {
      id: 1,
      name: "Hardened ingestion",
      status: "running",
      ms: null,
      readout: null,
      error: null,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          `data: ${JSON.stringify({ type: "document", document })}\n\n`,
          `data: ${JSON.stringify({ type: "phase", phase })}\n\n`,
        ]),
      ),
    );

    const file = new File(["%PDF-"], "sample.pdf", { type: "application/pdf" });
    const events = await collect(streamLiveScan(file, "http://test.local/scan"));

    expect(events.map((event) => event.type)).toEqual(["document", "phase"]);
    expect(events[0]).toEqual({ type: "document", document });
    expect(fetch).toHaveBeenCalledWith(
      "http://test.local/scan",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) }),
    );
  });

  it("reassembles a frame split across chunks", async () => {
    const event = {
      type: "error",
      phase: 4,
      message: "Semantic tier failed. The document was NOT cleared.",
    } satisfies ScanEvent;
    const frame = `data: ${JSON.stringify(event)}\n\n`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => sseResponse([frame.slice(0, 17), frame.slice(17)])),
    );

    const file = new File(["%PDF-"], "sample.pdf", { type: "application/pdf" });
    await expect(collect(streamLiveScan(file, "http://test.local/scan"))).resolves.toEqual([event]);
  });

  it("turns a malformed frame into an error event and stops", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          "data: {malformed json}\n\n",
          `data: ${JSON.stringify({ type: "verdict", response: {} })}\n\n`,
        ]),
      ),
    );

    const file = new File(["%PDF-"], "sample.pdf", { type: "application/pdf" });
    const events = await collect(streamLiveScan(file, "http://test.local/scan"));

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("error");
    expect(events[0]).toMatchObject({
      phase: null,
      message: expect.stringMatching(/Malformed event/),
    });
  });
});
