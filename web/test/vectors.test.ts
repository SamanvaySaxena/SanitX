// @vitest-environment node
/**
 * The taxonomy invariant — §5.2: "Act 0 claims ten vectors; this is the list.
 * Keep the count in the two places synchronised."
 */
import { describe, expect, it } from "vitest";
import {
  HERO_VECTORS,
  STANDARD_VECTORS,
  VECTORS,
  VECTOR_COUNT,
  VECTOR_COUNT_WORD,
} from "@/lib/vectors";

describe("threat taxonomy", () => {
  it("carries the ten vectors of PIPELINE_IMPROVEMENTS §3", () => {
    expect(VECTOR_COUNT).toBe(10);
    expect(VECTOR_COUNT_WORD).toBe("Ten");
  });

  it("splits 3 hero cells and 7 standard cells, per the §5.2 bento spans", () => {
    expect(HERO_VECTORS).toHaveLength(3);
    expect(STANDARD_VECTORS).toHaveLength(7);
  });

  // The three that defeat EVERY physical check get the 2x1 cells.
  it("promotes exactly the three vectors physical checks cannot catch", () => {
    expect(HERO_VECTORS.map((v) => v.id).sort()).toEqual([
      "actualtext_override",
      "render_mode_3tr",
      "tounicode_cmap",
    ]);
  });

  it("has no duplicate ids", () => {
    expect(new Set(VECTORS.map((v) => v.id)).size).toBe(VECTOR_COUNT);
  });

  // §5.9 — each cell carries the call that implements its check, so the trust
  // signal sits next to the claim it qualifies rather than in a footer.
  it("attaches a mechanism, a detection approach and a real call to every cell", () => {
    for (const v of VECTORS) {
      expect(v.name.length, v.id).toBeGreaterThan(3);
      expect(v.mechanism.length, v.id).toBeGreaterThan(30);
      expect(v.detection.length, v.id).toBeGreaterThan(20);
      expect(v.call.length, v.id).toBeGreaterThan(5);
      expect([1, 2, 3, 4]).toContain(v.phase);
    }
  });

  // The numeral is derived, never typed, so the hero cannot drift from the grid.
  it("derives the headline numeral from the array length", () => {
    expect(VECTOR_COUNT_WORD).toBe(
      ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"][
        VECTORS.length
      ],
    );
  });
});
