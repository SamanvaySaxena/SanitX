/**
 * The contrast linter §3.2 asks for.
 *
 * "These were computed by hand. Wire a contrast linter into CI and re-verify
 *  rather than trusting the table; also verify each against --bg-raised,
 *  which is lighter and therefore tighter."
 *
 * This parses styles/tokens.css directly, so the assertions cannot drift from
 * the shipped values. §5.4 additionally warns that the verdict triad fails on
 * the Act 4 paper ground; the second block here is what holds that fix.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "styles/tokens.css"), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  expect(start, `selector ${selector} missing from tokens.css`).toBeGreaterThan(-1);
  const open = css.indexOf("{", start);
  const close = css.indexOf("\n}", open);
  const body = css.slice(open, close);
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

const root = block(":root");
const paperGround = block('[data-ground="paper"]');

/** Resolve a token that may be `var(--other)` within the same cascade. */
function resolveHex(scope: Record<string, string>, name: string): string {
  let v = scope[name] ?? root[name];
  let guard = 0;
  while (v && v.startsWith("var(") && guard++ < 5) {
    const ref = v.slice(4, v.indexOf(")")).trim();
    v = scope[ref] ?? root[ref];
  }
  expect(v, `token ${name} did not resolve to a hex value`).toMatch(/^#[0-9a-f]{6}$/i);
  return v;
}

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;
const AAA = 7;

describe("dark ground (§3.2)", () => {
  const grounds = ["--bg-base", "--bg-raised", "--bg-void"] as const;

  // §3.2 declares --text-hi and --text-mid AAA. They must hold on the tighter
  // --bg-raised too, which is the check the doc says was never run.
  it.each(["--text-hi", "--text-mid"])("%s is AAA on every ground", (token) => {
    for (const g of grounds) {
      expect(
        ratio(resolveHex(root, token), resolveHex(root, g)),
        `${token} on ${g}`,
      ).toBeGreaterThanOrEqual(AAA);
    }
  });

  it.each(["--text-low", "--accent", "--safe", "--review", "--blocked-text"])(
    "%s clears AA on every ground",
    (token) => {
      for (const g of grounds) {
        expect(
          ratio(resolveHex(root, token), resolveHex(root, g)),
          `${token} on ${g}`,
        ).toBeGreaterThanOrEqual(AA);
      }
    },
  );

  // The documented exception: --blocked is thin, which is precisely why
  // --blocked-text exists for small type. Assert the relationship rather than
  // silently tolerating it.
  it("--blocked is AA-thin, and --blocked-text is the stronger alternate", () => {
    const base = resolveHex(root, "--bg-base");
    const blocked = ratio(resolveHex(root, "--blocked"), base);
    const blockedText = ratio(resolveHex(root, "--blocked-text"), base);
    expect(blocked).toBeGreaterThanOrEqual(AA);
    expect(blocked).toBeLessThan(AAA);
    expect(blockedText).toBeGreaterThan(blocked);
    expect(blockedText).toBeGreaterThanOrEqual(AAA);
  });

  it("the paper is the brightest surface on the dark ground (§3.1)", () => {
    const paper = luminance(resolveHex(root, "--paper"));
    for (const g of grounds) {
      expect(paper).toBeGreaterThan(luminance(resolveHex(root, g)));
    }
    // "never pure #FFFFFF" — the paper is warm.
    expect(resolveHex(root, "--paper").toUpperCase()).not.toBe("#FFFFFF");
    // "never pure #000" — the ground is deep charcoal.
    expect(resolveHex(root, "--bg-void").toUpperCase()).not.toBe("#000000");
  });
});

describe("paper ground — the Act 4 inversion (§5.4)", () => {
  // "--safe, --review, --accent and especially --blocked were tuned against
  //  #0B0F17 and will all fail against paper. Author a second verdict triad
  //  for light ground and run the same CI check."
  const grounds = ["--bg-base", "--bg-raised"] as const;

  it.each([
    "--text-hi",
    "--text-mid",
    "--text-low",
    "--accent",
    "--safe",
    "--review",
    "--blocked",
    "--blocked-text",
  ])("%s clears AA on the paper ground", (token) => {
    for (const g of grounds) {
      expect(
        ratio(resolveHex(paperGround, token), resolveHex(paperGround, g)),
        `${token} on paper ${g}`,
      ).toBeGreaterThanOrEqual(AA);
    }
  });

  it("proves the second triad was necessary: the dark triad fails here", () => {
    const paper = resolveHex(root, "--paper");
    for (const token of ["--accent", "--safe", "--review", "--blocked"]) {
      expect(
        ratio(resolveHex(root, token), paper),
        `${token} should NOT be reused on paper`,
      ).toBeLessThan(AA);
    }
  });
});
