import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  contrastRatio,
  deltaE,
  isInGamut,
  type Oklch,
  oklchToLinearRgb,
  parseOklch,
  toHex,
} from "./oklch";

/**
 * The design system, audited on every run.
 *
 * L47.5 set the token layer by computing contrast ratios by hand and writing the results into
 * `index.css` as comments. Nothing then held the stylesheet to those comments, which is the
 * shape of the bug that prompted the whole exercise: `--primary` and `--destructive` had drifted
 * to ΔE 0.026 apart — below the just-noticeable threshold — so every delete button in the app
 * wore the save button's colour, invisibly, because the two are never adjacent to compare.
 *
 * This reads the real stylesheet and re-derives every figure. It fails on a value, not on a
 * screenshot, so "changing a lightness means re-checking the pairs it participates in" stops
 * being an instruction someone has to remember.
 */

const CSS = readFileSync(join(import.meta.dir, "..", "index.css"), "utf8");

/** Extracts one top-level rule's custom properties. Brace-matched, because `.dark` is also the
 *  prefix of the `.dark .hljs` rules further down the file. */
function tokensOf(selector: string): Map<string, Oklch> {
  const start = CSS.indexOf(`\n${selector} {`);
  if (start === -1) throw new Error(`no \`${selector}\` rule in index.css`);

  let depth = 0;
  let end = start;
  for (let i = CSS.indexOf("{", start); i < CSS.length; i++) {
    if (CSS[i] === "{") depth++;
    else if (CSS[i] === "}" && --depth === 0) {
      end = i;
      break;
    }
  }

  const tokens = new Map<string, Oklch>();
  for (const [, name, value] of CSS.slice(start, end).matchAll(
    /(--[\w-]+)\s*:\s*([^;]+);/g,
  )) {
    const color = parseOklch(value);
    if (color) tokens.set(name, color);
  }

  return tokens;
}

const MODES = {
  light: tokensOf(":root"),
  dark: tokensOf(".dark"),
} as const;

type Mode = keyof typeof MODES;
const MODE_NAMES = Object.keys(MODES) as Mode[];

function token(mode: Mode, name: string): Oklch {
  const color = MODES[mode].get(name);
  if (!color) throw new Error(`${name} is not an oklch token in ${mode} mode`);

  return color;
}

/** The three surfaces anything in the chrome can find itself on. */
const SURFACES = ["--background", "--card", "--sidebar"] as const;

/** WCAG 1.4.6 AA for body text. */
const TEXT_MINIMUM = 4.5;
/** WCAG 1.4.11 for a meaningful graphic or a control's boundary. */
const MARK_MINIMUM = 3;

// Mutable and plainly typed, because `test.each` will not take a readonly tuple of strings.
const ACCENTS: string[] = [
  "--hue-red",
  "--hue-orange",
  "--hue-amber",
  "--hue-green",
  "--hue-teal",
  "--hue-blue",
  "--hue-violet",
  "--hue-pink",
];

function check(
  mode: Mode,
  ink: string,
  background: string,
  minimum: number,
): void {
  const ratio = contrastRatio(token(mode, ink), token(mode, background));

  expect(
    ratio,
    `${mode}: ${ink} (${toHex(token(mode, ink))}) on ${background} (${toHex(
      token(mode, background),
    )}) is ${ratio.toFixed(2)}:1, needs ${minimum}:1`,
  ).toBeGreaterThanOrEqual(minimum);
}

describe.each(MODE_NAMES)("%s mode", (mode) => {
  test("every colour is representable in sRGB", () => {
    for (const [name, color] of MODES[mode]) {
      expect(
        isInGamut(oklchToLinearRgb(color)),
        `${name} is outside sRGB; the browser would clip it to a hue nobody chose`,
      ).toBe(true);
    }
  });

  test("the surface ladder is three distinct levels, recessed to raised", () => {
    const [background, card, sidebar] = SURFACES.map((s) => token(mode, s).l);

    // The same ordering in both modes, which is the L47.5 finding: light mode used to separate
    // the sidebar but not cards (`--card` was byte-identical to `--background`, so a card was
    // defined by a border at 1.13:1 — by nothing) while dark mode separated cards but not the
    // sidebar. Two modes, two different structures, inverted.
    expect(sidebar).toBeLessThan(background);
    expect(background).toBeLessThan(card);

    // Big enough to actually see. Below about 0.015 in lightness the step reads as a rendering
    // artefact rather than as depth.
    expect(background - sidebar).toBeGreaterThanOrEqual(0.015);
    expect(card - background).toBeGreaterThanOrEqual(0.015);
  });

  test.each(["--foreground", "--muted-foreground"])(
    "%s clears AA on all three surfaces",
    (ink) => {
      for (const surface of SURFACES) check(mode, ink, surface, TEXT_MINIMUM);
    },
  );

  test("--muted-foreground clears AA on --muted, the fill it sits on in a chip", () => {
    // `--muted` is pinned from both sides: it is the fill behind avatar fallbacks and subtle
    // chips, so it has to be visible against the canvas *and* carry this token as text.
    check(mode, "--muted-foreground", "--muted", TEXT_MINIMUM);
  });

  test("--muted-foreground is a genuinely second tier, not a shade of --foreground", () => {
    // In dark mode it used to sit ΔE 0.10 from full foreground, which is not a second tier.
    const distance = deltaE(
      token(mode, "--muted-foreground"),
      token(mode, "--foreground"),
    );

    expect(distance).toBeGreaterThan(0.2);
  });

  test.each(["--success", "--warning", "--info", "--destructive"])(
    "%s is readable as text on every surface and on its own tint",
    (signal) => {
      // These are ink, not marks: `bg-warning-surface text-warning` is the Medium priority pill
      // and `bg-destructive-surface text-destructive` the High one.
      for (const surface of SURFACES)
        check(mode, signal, surface, TEXT_MINIMUM);
      check(mode, signal, `${signal}-surface`, TEXT_MINIMUM);
    },
  );

  test.each(["--primary", "--destructive", "--success", "--warning", "--info"])(
    "%s carries its own foreground, as a filled button",
    (fill) => {
      check(mode, `${fill}-foreground`, fill, TEXT_MINIMUM);
    },
  );

  test("--primary and --destructive cannot be confused", () => {
    // The L47.5 finding, locked: `#9b2c2c` and `#991b1b` at ΔE 0.026, below the just-noticeable
    // threshold, in two tokens that mean "save" and "delete".
    const distance = deltaE(
      token(mode, "--primary"),
      token(mode, "--destructive"),
    );

    expect(distance).toBeGreaterThan(0.25);
  });

  test("--ring clears the non-text threshold on every surface", () => {
    for (const surface of SURFACES)
      check(mode, "--ring", surface, MARK_MINIMUM);
  });

  test("--border is visible against every surface it divides", () => {
    // Measured in lightness, not as a contrast ratio, and deliberately: WCAG sets no threshold
    // for a divider, so any ratio picked here would be invented. What actually made the old
    // light-mode card border invisible was that it was a hair from the surface it sat on — a
    // border in the stylesheet only. Lightness separation is that property directly.
    for (const surface of SURFACES) {
      const separation = Math.abs(
        token(mode, "--border").l - token(mode, surface).l,
      );

      expect(
        separation,
        `${mode}: --border is only ΔL ${separation.toFixed(3)} from ${surface}`,
      ).toBeGreaterThanOrEqual(0.03);
    }
  });

  describe("project accents", () => {
    test.each(ACCENTS)(
      "%s clears the non-text threshold on every surface",
      (accent) => {
        // MARK, not TEXT: an accent is a dot, a rule or an edge, never a label — which is the only
        // reason the yellow-greens can be in the set at all.
        for (const surface of SURFACES)
          check(mode, accent, surface, MARK_MINIMUM);
      },
    );

    test("all eight sit at one lightness, so none reads as louder than another", () => {
      const lightnesses = new Set(
        ACCENTS.map((accent) => token(mode, accent).l),
      );

      expect(lightnesses.size).toBe(1);
    });

    test("no two are close enough to be mistaken for each other", () => {
      // 0.02 is the just-noticeable threshold for two large adjacent patches; an accent is a
      // small mark seen one at a time, so it wants a good deal more than that.
      for (let i = 0; i < ACCENTS.length; i++) {
        for (let j = i + 1; j < ACCENTS.length; j++) {
          const distance = deltaE(
            token(mode, ACCENTS[i]),
            token(mode, ACCENTS[j]),
          );

          expect(
            distance,
            `${mode}: ${ACCENTS[i]} and ${ACCENTS[j]} are ΔE ${distance.toFixed(3)} apart`,
          ).toBeGreaterThan(0.05);
        }
      }
    });
  });
});

describe("the chrome", () => {
  test("is a true neutral in both modes", () => {
    // "Neutral canvas, colour as signal" is a claim about chroma: the only saturated pixels on a
    // board should be the ones that mean something. The previous palette tinted every surface
    // warm and then competed with its own signals.
    for (const mode of MODE_NAMES) {
      for (const name of [
        ...SURFACES,
        "--foreground",
        "--muted",
        "--muted-foreground",
        "--border",
      ]) {
        expect(token(mode, name).c, `${mode}: ${name} is tinted`).toBe(0);
      }
    }
  });
});
