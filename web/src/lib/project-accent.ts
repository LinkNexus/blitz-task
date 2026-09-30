import type { ProjectAccent } from "@/api";

/**
 * A project's accent, resolved to classes.
 *
 * The single place an accent name becomes a colour, for the same reason `kanban-view/lib.ts` is
 * the single place a priority becomes one: the alternative is the same mapping written twice,
 * differently, in the sidebar and the project header — which is exactly what priority tone did
 * before L47.5 collapsed it.
 *
 * **An accent is a mark, never ink.** Every entry below is a fill or a ring, and none of them is
 * ever put behind text. That constraint is what lets the set include hues sRGB cannot make
 * readable — a yellow dark enough to carry 4.5:1 on white is olive — and it is asserted rather
 * than hoped: `theme-contrast.test.ts` holds each accent to WCAG 1.4.11's 3:1 against all three
 * surfaces in both modes, which is the bar for a meaningful graphic and *not* the bar for a
 * label. Tint text with one of these and the guarantee is gone.
 *
 * Literal class strings, not `bg-hue-${accent}`: Tailwind reads source text, so a composed name
 * produces no CSS at all and fails as a missing colour rather than as an error.
 */

/** Order is the order the picker shows them in — round the hue circle, not alphabetical. */
export const ACCENT_OPTIONS: readonly {
  value: ProjectAccent;
  label: string;
}[] = [
  { value: "None", label: "None" },
  { value: "Red", label: "Red" },
  { value: "Orange", label: "Orange" },
  { value: "Amber", label: "Amber" },
  { value: "Green", label: "Green" },
  { value: "Teal", label: "Teal" },
  { value: "Blue", label: "Blue" },
  { value: "Violet", label: "Violet" },
  { value: "Pink", label: "Pink" },
];

/**
 * A solid fill — the swatch in the picker, and the rule on a sidebar row.
 *
 * `None` is a real, visible swatch rather than an empty one, because it is a *choice* in the
 * picker and an option you cannot see is an option you cannot pick. It renders in the border
 * neutral, which is what "no accent" looks like on a row.
 */
const FILL: Record<ProjectAccent, string> = {
  None: "bg-border",
  Red: "bg-hue-red",
  Orange: "bg-hue-orange",
  Amber: "bg-hue-amber",
  Green: "bg-hue-green",
  Teal: "bg-hue-teal",
  Blue: "bg-hue-blue",
  Violet: "bg-hue-violet",
  Pink: "bg-hue-pink",
};

/** A ring, for the project avatar in the header — the one place big enough to carry one. */
const RING: Record<ProjectAccent, string> = {
  None: "",
  Red: "ring-2 ring-hue-red",
  Orange: "ring-2 ring-hue-orange",
  Amber: "ring-2 ring-hue-amber",
  Green: "ring-2 ring-hue-green",
  Teal: "ring-2 ring-hue-teal",
  Blue: "ring-2 ring-hue-blue",
  Violet: "ring-2 ring-hue-violet",
  Pink: "ring-2 ring-hue-pink",
};

/**
 * Falls back rather than indexing blind: `accent` arrives from the API, and a value this build
 * does not know about — an instance running an older frontend against a newer server — would
 * otherwise put `undefined` into a `className` and render the literal string.
 */
export function accentFill(accent: ProjectAccent | undefined): string {
  return (accent && FILL[accent]) || FILL.None;
}

/** Empty for `None`, which is what leaves the avatar unringed. */
export function accentRing(accent: ProjectAccent | undefined): string {
  return (accent && RING[accent]) || RING.None;
}

/** Whether there is anything to draw — so a caller can skip the element entirely. */
export function hasAccent(accent: ProjectAccent | undefined): boolean {
  return accent !== undefined && accent !== "None";
}
