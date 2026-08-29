/**
 * Act 0 — the reveal (§5.0), and the §7.1 rule it must not violate.
 *
 * The hero is a server component with no async work, so rendering it directly
 * is exactly what the server does. That matters for the central assertion
 * here: everything the visitor needs is in the STATIC markup, because §8 says
 * "Nothing in Act 0 waits on JavaScript."
 */
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { HeroReveal } from "@/components/narrative/HeroReveal";
import { HERO_PAYLOADS } from "@/components/narrative/ResumePage";
import { VECTOR_COUNT_WORD } from "@/lib/vectors";

describe("the always-on line (§5.0)", () => {
  it("states what this is in seven words, in the static markup", () => {
    render(<HeroReveal />);
    const line = screen.getByText(
      "SanitX scans PDFs for hidden prompt injections.",
    );
    expect(line).toBeInTheDocument();
    // Seven words. The rule is not negotiable, so it is asserted.
    expect(line.textContent!.trim().split(/\s+/)).toHaveLength(7);
  });

  it("is not animated or delayed — it carries no animation class", () => {
    render(<HeroReveal />);
    const line = screen.getByText(
      "SanitX scans PDFs for hidden prompt injections.",
    );
    expect(line.className).not.toMatch(/hero-headline|reveal|paint-in/);
  });
});

describe("the headline (§5.0)", () => {
  it("makes a countable claim derived from the taxonomy, not a typed numeral", () => {
    render(<HeroReveal />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent(
      `${VECTOR_COUNT_WORD} ways a PDF can hide an instruction.`,
    );
    expect(h1).toHaveTextContent("We check for all of them.");
    // §5.2: the hero and Act 2 must not drift. "Ten" comes from VECTORS.length.
    expect(VECTOR_COUNT_WORD).toBe("Ten");
  });

  it("is the page's only h1 (§7.3)", () => {
    render(<HeroReveal />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});

describe("the CTAs (§2.5, §3.6)", () => {
  it("puts the scanner one click away, ungated, with a pre-loaded sample", () => {
    render(<HeroReveal />);
    expect(screen.getByRole("link", { name: /scan a pdf/i })).toHaveAttribute(
      "href",
      "/scan",
    );
    expect(
      screen.getByRole("link", { name: /use a malicious sample/i }),
    ).toHaveAttribute("href", "/scan?sample=malicious");
  });

  it("offers a replay control rather than looping the sweep", () => {
    render(<HeroReveal />);
    expect(
      screen.getByRole("button", { name: /replay the scan/i }),
    ).toBeInTheDocument();
  });
});

describe("distributed trust signals (§5.9)", () => {
  it("puts methodology, corpus and limitations links on the first screen", () => {
    render(<HeroReveal />);
    const nav = screen.getByRole("navigation", {
      name: /methodology and limitations/i,
    });
    expect(within(nav).getByText(/open methodology/i)).toBeInTheDocument();
    expect(within(nav).getByText(/adversarial corpus/i)).toBeInTheDocument();
    expect(within(nav).getByText(/what we don.t catch/i)).toBeInTheDocument();
  });
});

describe("§7.1 — the irony this site must not commit", () => {
  it("renders the demonstration as one labelled image, not as loose DOM text", () => {
    const { container } = render(<HeroReveal />);
    const svg = container.querySelector("svg[role='img']");
    expect(svg).toBeTruthy();
    expect(svg!.getAttribute("aria-labelledby")).toBe(
      "hero-page-title hero-page-desc",
    );
    expect(svg!.querySelector("title")?.textContent).toMatch(/payload/i);
  });

  // The load-bearing assertion: a screen-reader user learns the same three
  // facts a sighted user does. The <desc> must quote every payload in full.
  it("describes all three payloads verbatim in the accessible description", () => {
    const { container } = render(<HeroReveal />);
    const desc = container.querySelector("desc")?.textContent ?? "";
    expect(desc.length).toBeGreaterThan(200);
    for (const payload of HERO_PAYLOADS) {
      expect(desc).toContain(payload.text);
      expect(desc).toContain(payload.mechanism);
    }
  });

  it("keeps the payload layer out of the accessibility tree via aria-hidden", () => {
    const { container } = render(<HeroReveal />);
    const layer = container.querySelector(".hero-payloads");
    expect(layer).toBeTruthy();
    expect(layer!.getAttribute("aria-hidden")).toBe("true");
  });

  it("carries a real figcaption stating the finding in words (§7.2)", () => {
    const { container } = render(<HeroReveal />);
    const caption = container.querySelector("figcaption");
    expect(caption).toBeTruthy();
    // The three mono labels from the §5.0 choreography table.
    expect(caption!.textContent).toContain("1.4pt");
    expect(caption!.textContent).toContain("Δcontrast 3/255");
    expect(caption!.textContent).toContain("occluded by /Image");
  });
});

describe("§3.6 — demonstration, not fear", () => {
  it("uses none of the banned register", () => {
    const { container } = render(<HeroReveal />);
    const copy = (container.textContent ?? "").toLowerCase();
    for (const banned of [
      "unhackable",
      "breach",
      "hackers",
      "protect your pipeline now",
      "don't wait",
      "act now",
      "critical threat detected",
    ]) {
      expect(copy, `banned register: ${banned}`).not.toContain(banned);
    }
  });

  it("starts the sweep armed so it plays once from static markup", () => {
    const { container } = render(<HeroReveal />);
    const figure = container.querySelector("#hero-figure");
    expect(figure).toBeTruthy();
    expect(figure!.classList.contains("hero-armed")).toBe(true);
  });
});
