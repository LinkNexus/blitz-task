import { describe, expect, test } from "bun:test";
import {
  contrastRatio,
  deltaE,
  isInGamut,
  oklchToLinearRgb,
  parseOklch,
  toHex,
} from "./oklch";

const WHITE = { l: 1, c: 0, h: 0 };
const BLACK = { l: 0, c: 0, h: 0 };

describe("parseOklch", () => {
  test("reads the form the stylesheet is written in", () => {
    expect(parseOklch("oklch(0.535 0.205 27)")).toEqual({
      l: 0.535,
      c: 0.205,
      h: 27,
    });
  });

  test("normalises a percentage lightness to 0–1", () => {
    // Left as 53, this colour would report 1:1 against everything and read as passing.
    expect(parseOklch("oklch(53% 0 0)")).toEqual({ l: 0.53, c: 0, h: 0 });
  });

  test("tolerates an alpha channel and surrounding whitespace", () => {
    expect(parseOklch("  oklch(0.5 0.1 200 / 0.4)  ")).toEqual({
      l: 0.5,
      c: 0.1,
      h: 200,
    });
  });

  test("returns null for anything that is not an oklch colour", () => {
    for (const value of ["#ffffff", "var(--background)", "0 1px 2px", ""]) {
      expect(parseOklch(value)).toBeNull();
    }
  });
});

describe("oklchToLinearRgb", () => {
  test("maps the achromatic endpoints exactly", () => {
    const white = oklchToLinearRgb(WHITE);
    for (const channel of [white.r, white.g, white.b]) {
      expect(channel).toBeCloseTo(1, 5);
    }

    const black = oklchToLinearRgb(BLACK);
    for (const channel of [black.r, black.g, black.b]) {
      expect(channel).toBeCloseTo(0, 5);
    }
  });

  test("agrees with the reference conversion for sRGB primaries", () => {
    // OKLCH for #ff0000 / #00ff00 / #0000ff, per the CSS Color 4 sample values.
    const cases: [{ l: number; c: number; h: number }, string][] = [
      [{ l: 0.6279, c: 0.2577, h: 29.23 }, "#ff0000"],
      [{ l: 0.8664, c: 0.2948, h: 142.5 }, "#00ff00"],
      [{ l: 0.452, c: 0.3132, h: 264.05 }, "#0000ff"],
    ];

    for (const [color, hex] of cases) {
      expect(toHex(color)).toBe(hex);
    }
  });
});

describe("isInGamut", () => {
  test("accepts the boundary despite floating-point error", () => {
    expect(isInGamut(oklchToLinearRgb(WHITE))).toBe(true);
    expect(isInGamut(oklchToLinearRgb(BLACK))).toBe(true);
  });

  test("rejects a chroma sRGB cannot reach", () => {
    expect(isInGamut(oklchToLinearRgb({ l: 0.6, c: 0.4, h: 150 }))).toBe(false);
  });
});

describe("contrastRatio", () => {
  test("black on white is 21:1", () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 2);
  });

  test("a colour against itself is 1:1", () => {
    expect(contrastRatio(WHITE, WHITE)).toBeCloseTo(1, 5);
  });

  test("is order-independent", () => {
    const a = { l: 0.53, c: 0, h: 0 };
    const b = { l: 0.974, c: 0, h: 0 };

    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });
});

describe("deltaE", () => {
  test("reproduces the collision L47.5 found between primary and destructive", () => {
    // The old `--primary` (#9b2c2c) and `--destructive` (#991b1b) — the pair that put the save
    // button's colour on every delete button in the app.
    const distance = deltaE(
      { l: 0.4362, c: 0.1281, h: 26.5 },
      { l: 0.4277, c: 0.1508, h: 27.6 },
    );

    expect(distance).toBeLessThan(0.03);
  });

  test("is zero for a colour against itself", () => {
    expect(deltaE({ l: 0.5, c: 0.2, h: 27 }, { l: 0.5, c: 0.2, h: 27 })).toBe(
      0,
    );
  });
});
