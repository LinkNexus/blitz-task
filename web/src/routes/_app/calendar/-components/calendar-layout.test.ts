import { describe, expect, test } from "bun:test";
import {
  isInMonth,
  type LayoutItem,
  layoutMonth,
  layoutWeek,
  monthGridDays,
} from "./calendar-layout";

// June 2026 starts on a Monday, so the grid's first cell is the 1st with no padding before it —
// which makes the column arithmetic below readable.
const JUNE = new Date(2026, 5, 1);
const MONDAY = new Date(2026, 5, 1);

const at = (day: number, hour = 9) => new Date(2026, 5, day, hour);

const item = (
  key: string,
  startDay: number,
  endDay = startDay,
): LayoutItem => ({
  key,
  start: at(startDay),
  end: at(endDay),
});

describe("monthGridDays", () => {
  test("always returns six weeks so the grid never changes height", () => {
    for (const month of [new Date(2026, 1, 1), JUNE, new Date(2026, 7, 1)]) {
      expect(monthGridDays(month)).toHaveLength(42);
    }
  });

  test("starts on the Monday of the week containing the 1st", () => {
    // 1 August 2026 is a Saturday, so the grid opens on Monday 27 July.
    const days = monthGridDays(new Date(2026, 7, 1));
    expect(days[0].getDay()).toBe(1);
    expect(days[0].getDate()).toBe(27);
    expect(days[0].getMonth()).toBe(6);
  });

  test("pads either side of the month", () => {
    const days = monthGridDays(JUNE);
    expect(isInMonth(days[0], JUNE)).toBe(true);
    expect(isInMonth(days[41], JUNE)).toBe(false);
  });
});

describe("layoutWeek", () => {
  test("places a single-day item in one column", () => {
    const { segments } = layoutWeek([item("a", 3)], MONDAY, 3);
    const segment = segments[0];

    expect(segment.startCol).toBe(2);
    expect(segment.span).toBe(1);
    expect(segment.continuesBefore).toBe(false);
    expect(segment.continuesAfter).toBe(false);
  });

  test("a span covers every day it crosses", () => {
    const { segments } = layoutWeek([item("a", 2, 5)], MONDAY, 3);
    expect(segments[0].startCol).toBe(1);
    expect(segments[0].span).toBe(4);
  });

  test("clips a span to the week and says which side it runs off", () => {
    // The calendar is meant for long-running work, so this is the case that has to be right:
    // the bar is cut at both edges and the row still renders seven columns.
    const crossing: LayoutItem = {
      key: "long",
      start: new Date(2026, 4, 20),
      end: new Date(2026, 5, 20),
    };

    const { segments } = layoutWeek([crossing], MONDAY, 3);
    const segment = segments[0];

    expect(segment.startCol).toBe(0);
    expect(segment.span).toBe(7);
    expect(segment.continuesBefore).toBe(true);
    expect(segment.continuesAfter).toBe(true);
  });

  test("ignores items that do not touch the week at all", () => {
    const { segments } = layoutWeek([item("a", 20)], MONDAY, 3);
    expect(segments).toEqual([]);
  });

  test("items that do not overlap share a lane", () => {
    const { segments } = layoutWeek([item("a", 1), item("b", 4)], MONDAY, 3);
    expect(segments.map((s) => s.lane)).toEqual([0, 0]);
  });

  test("overlapping items are stacked, longest on top", () => {
    // A bar threaded underneath the chips it spans reads as unrelated to them; putting the
    // longest first is what makes a week's shape legible.
    const { segments } = layoutWeek(
      [item("chip", 3), item("bar", 1, 5)],
      MONDAY,
      3,
    );

    const bar = segments.find((s) => s.item.key === "bar");
    const chip = segments.find((s) => s.item.key === "chip");

    expect(bar?.lane).toBe(0);
    expect(chip?.lane).toBe(1);
  });

  test("counts what does not fit instead of growing the row", () => {
    const items = [item("a", 3), item("b", 3), item("c", 3), item("d", 3)];
    const { segments, overflow } = layoutWeek(items, MONDAY, 2);

    expect(segments).toHaveLength(2);
    // Wednesday is column 2, and two of the four items were pushed out of view.
    expect(overflow[2]).toBe(2);
    expect(overflow[0]).toBe(0);
  });

  test("overflow is counted per day a hidden span crosses", () => {
    const items = [item("a", 2, 4), item("b", 2, 4), item("hidden", 2, 4)];
    const { overflow } = layoutWeek(items, MONDAY, 2);

    expect(overflow).toEqual([0, 1, 1, 1, 0, 0, 0]);
  });

  test("ordering does not depend on the order items arrive in", () => {
    const forwards = layoutWeek([item("a", 1), item("b", 1)], MONDAY, 3);
    const backwards = layoutWeek([item("b", 1), item("a", 1)], MONDAY, 3);

    expect(forwards.segments.map((s) => `${s.item.key}:${s.lane}`)).toEqual(
      backwards.segments.map((s) => `${s.item.key}:${s.lane}`),
    );
  });
});

describe("layoutMonth", () => {
  test("lays out six rows and puts each item in the weeks it touches", () => {
    const weeks = layoutMonth(JUNE, [item("a", 2, 9)], 3);

    expect(weeks).toHaveLength(6);
    expect(weeks[0].segments).toHaveLength(1);
    expect(weeks[1].segments).toHaveLength(1);
    expect(weeks[2].segments).toEqual([]);

    // The same item, cut across the boundary rather than duplicated as two separate things.
    expect(weeks[0].segments[0].continuesAfter).toBe(true);
    expect(weeks[1].segments[0].continuesBefore).toBe(true);
  });
});
