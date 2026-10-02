/**
 * OKLCH → sRGB, plus WCAG contrast — enough to *check* the token layer rather than eyeball it.
 *
 * `index.css` is written in OKLCH and its comments quote contrast ratios and ΔE figures. Those
 * numbers were computed by hand during L47.5 and nothing held them to it afterwards, which is
 * how the previous palette drifted into shipping `--primary` and `--destructive` at ΔE 0.026 —
 * a difference below the just-noticeable threshold, in two tokens that mean opposite things.
 * This module is what lets `theme-contrast.test.ts` re-derive every figure from the stylesheet
 * on each run, so changing a lightness fails a test instead of quietly failing a user.
 *
 * Deliberately no dependency: a colour library would be ~40KB in a bundle that only needs two
 * matrix multiplies and a gamma curve, and every one of them is a moving target across majors.
 */

export type Oklch = { l: number; c: number; h: number };

/** Linear-light sRGB. Out-of-gamut values fall outside 0–1 and are *not* clamped — see {@link isInGamut}. */
export type LinearRgb = { r: number; g: number; b: number };

const OKLCH_PATTERN =
  /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.]+)?\s*\)$/;

/**
 * Parses the `oklch(L C H)` form the stylesheet uses. Returns `null` rather than throwing so a
 * caller sweeping every custom property can skip the ones that are not colours.
 *
 * `L` is accepted both as a 0–1 number and as a percentage, because CSS permits both and the
 * two are silently a factor of 100 apart — a token written `oklch(53% 0 0)` that parsed as
 * `l = 53` would report a contrast ratio of 1:1 against everything and read as *passing*.
 */
export function parseOklch(value: string): Oklch | null {
  const match = OKLCH_PATTERN.exec(value.trim());
  if (!match) return null;

  const [, rawL, rawC, rawH] = match;
  const l = rawL.endsWith("%") ? Number(rawL.slice(0, -1)) / 100 : Number(rawL);

  return { l, c: Number(rawC), h: Number(rawH) };
}

/** OKLCH → linear-light sRGB, via OKLab (Ottosson's matrices). */
export function oklchToLinearRgb({ l, c, h }: Oklch): LinearRgb {
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const b = c * Math.sin(radians);

  const lCube = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mCube = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sCube = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return {
    r: 4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube,
    g: -1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube,
    b: -0.0041960863 * lCube - 0.7034186147 * mCube + 1.707614701 * sCube,
  };
}

/**
 * Whether the colour is representable in sRGB at all.
 *
 * The tolerance absorbs floating-point error at the exact boundary — `oklch(1 0 0)` lands a few
 * units in the last place above 1.0 — without admitting a colour that is genuinely outside the
 * gamut, where the browser's own clipping would give a hue nobody chose.
 */
export function isInGamut({ r, g, b }: LinearRgb, tolerance = 1e-6): boolean {
  return [r, g, b].every(
    (channel) => channel >= -tolerance && channel <= 1 + tolerance,
  );
}

function encodeChannel(channel: number): number {
  const clamped = Math.min(1, Math.max(0, channel));
  const encoded =
    clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * clamped ** (1 / 2.4) - 0.055;

  return Math.round(encoded * 255);
}

/** `#rrggbb`, for a failure message that names a colour a human can look at. */
export function toHex(color: Oklch): string {
  const { r, g, b } = oklchToLinearRgb(color);

  return `#${[r, g, b]
    .map((channel) => encodeChannel(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * WCAG 2.1 relative luminance.
 *
 * Taken straight from the linear values, which is the whole reason this goes through linear
 * sRGB rather than hex: round-tripping through 8-bit channels and decoding them again loses
 * precision for no gain. Out-of-gamut channels are clamped here — a ratio against a colour the
 * screen cannot show is meaningless, and {@link isInGamut} is the check that catches it.
 */
export function relativeLuminance({ r, g, b }: LinearRgb): number {
  const [lr, lg, lb] = [r, g, b].map((channel) =>
    Math.min(1, Math.max(0, channel)),
  );

  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/** WCAG contrast ratio, 1–21. Order-independent. */
export function contrastRatio(a: Oklch, b: Oklch): number {
  const luminances = [a, b].map((color) =>
    relativeLuminance(oklchToLinearRgb(color)),
  );
  const lighter = Math.max(...luminances);
  const darker = Math.min(...luminances);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Perceptual distance in OKLab.
 *
 * OKLab is near-uniform by construction, so a plain Euclidean distance is the ΔE here — there
 * is no ΔE2000-style correction to apply. Roughly: 0.02 is the just-noticeable threshold for
 * two large adjacent patches, and rather more than that is needed for colours which, like a
 * project accent and its neighbour in a sidebar, are never seen side by side.
 */
export function deltaE(a: Oklch, b: Oklch): number {
  const toLab = ({ l, c, h }: Oklch) => {
    const radians = (h * Math.PI) / 180;
    return [l, c * Math.cos(radians), c * Math.sin(radians)];
  };

  const [first, second] = [toLab(a), toLab(b)];

  return Math.hypot(...first.map((value, index) => value - second[index]));
}
