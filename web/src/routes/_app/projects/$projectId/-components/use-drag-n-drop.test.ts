import { describe, expect, test } from "bun:test";
import { columnScoreBetween, scoreBetween } from "./use-drag-n-drop";

// These two look like near-duplicates but their neighbour semantics are deliberately
// mirrored: tasks render highest-score-first, columns lowest-score-first. Getting one
// backwards silently sends a dropped item to the opposite end of the list.

describe("scoreBetween (tasks — rendered highest score first)", () => {
  test("an empty column starts at 1000", () => {
    expect(scoreBetween(undefined, undefined)).toBe(1000);
  });

  test("dropping above everything scores higher than the task below", () => {
    expect(scoreBetween(undefined, 5000)).toBe(6000);
    expect(scoreBetween(undefined, 5000)).toBeGreaterThan(5000);
  });

  test("dropping below everything scores lower than the task above", () => {
    expect(scoreBetween(5000, undefined)).toBe(4000);
    expect(scoreBetween(5000, undefined)).toBeLessThan(5000);
  });

  test("dropping between two tasks lands on the midpoint", () => {
    expect(scoreBetween(3000, 1000)).toBe(2000);
  });

  test("the midpoint always sorts strictly between its neighbours", () => {
    const mid = scoreBetween(1000, 999);
    expect(mid).toBeLessThan(1000);
    expect(mid).toBeGreaterThan(999);
  });

  test("negative scores are handled — a column can be dragged down repeatedly", () => {
    expect(scoreBetween(0, undefined)).toBe(-1000);
    expect(scoreBetween(-1000, -3000)).toBe(-2000);
  });

  test("repeated halving into the same gap stays ordered", () => {
    let low = 1000;
    const high = 2000;
    for (let i = 0; i < 20; i++) {
      const next = scoreBetween(high, low);
      expect(next).toBeGreaterThan(low);
      expect(next).toBeLessThan(high);
      low = next;
    }
  });
});

describe("columnScoreBetween (columns — rendered lowest score first)", () => {
  test("the first column starts at 1000", () => {
    expect(columnScoreBetween(undefined, undefined)).toBe(1000);
  });

  test("dropping before everything scores LOWER than the column after it", () => {
    expect(columnScoreBetween(undefined, 5000)).toBe(4000);
    expect(columnScoreBetween(undefined, 5000)).toBeLessThan(5000);
  });

  test("dropping after everything scores HIGHER than the column before it", () => {
    expect(columnScoreBetween(5000, undefined)).toBe(6000);
    expect(columnScoreBetween(5000, undefined)).toBeGreaterThan(5000);
  });

  test("dropping between two columns lands on the midpoint", () => {
    expect(columnScoreBetween(1000, 3000)).toBe(2000);
  });

  test("its open-ended cases are the mirror image of scoreBetween's", () => {
    // The bug this guards against is copying one function's edge case into the other.
    expect(columnScoreBetween(undefined, 5000)).not.toBe(
      scoreBetween(undefined, 5000),
    );
    expect(columnScoreBetween(5000, undefined)).not.toBe(
      scoreBetween(5000, undefined),
    );
  });
});
