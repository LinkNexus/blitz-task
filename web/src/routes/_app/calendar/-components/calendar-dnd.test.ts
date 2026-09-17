import { describe, expect, test } from "bun:test";
import {
  barDndId,
  dayDndId,
  dayFromDndId,
  rescheduledDueDate,
} from "./calendar-dnd";

describe("drop target ids", () => {
  test("a day round-trips through its id", () => {
    const day = new Date(2026, 8, 17);
    expect(dayFromDndId(dayDndId(day))).toEqual(day);
  });

  test("anything that is not a day id is not a day", () => {
    // A drag can end over a bar, over nothing, or be cancelled outright.
    expect(dayFromDndId(barDndId("12-x", new Date(2026, 8, 14)))).toBeNull();
    expect(dayFromDndId(undefined)).toBeNull();
    expect(dayFromDndId("day:not-a-date")).toBeNull();
  });

  test("the two segments of one span across a week boundary get different ids", () => {
    // dnd-kit's registry is global, so a task drawn as two bars would otherwise register the
    // same id twice and the second would win.
    const key = "12-2026-09-20T17:00:00Z";
    expect(barDndId(key, new Date(2026, 8, 14))).not.toBe(
      barDndId(key, new Date(2026, 8, 21)),
    );
  });
});

describe("rescheduledDueDate", () => {
  test("moves to the dropped day and keeps the time of day", () => {
    // The deadline is 5pm on the 20th; dropping it on the 25th makes it 5pm on the 25th, not
    // midnight — the grid has no idea what time of day a cell means.
    const due = new Date(2026, 8, 20, 17, 0);
    const moved = rescheduledDueDate(due, new Date(2026, 8, 25));

    expect(moved).toEqual(new Date(2026, 8, 25, 17, 0));
  });

  test("moves backwards just as happily", () => {
    const due = new Date(2026, 8, 20, 9, 30);
    expect(rescheduledDueDate(due, new Date(2026, 8, 3))).toEqual(
      new Date(2026, 8, 3, 9, 30),
    );
  });

  test("a drop on the day it already sits on changes nothing", () => {
    // The time of day is not midnight, so this is only true because the shift is computed in
    // whole calendar days rather than from the target day's own timestamp.
    const due = new Date(2026, 8, 20, 17, 0);
    expect(rescheduledDueDate(due, new Date(2026, 8, 20))).toEqual(due);
  });

  test("crossing a DST boundary keeps the wall-clock time", () => {
    // Calendar-day arithmetic, not 24-hour arithmetic: adding 86400000ms across a spring-forward
    // moves a 9am deadline to 10am, which is not what dropping it on the next day means.
    const due = new Date(2026, 2, 27, 9, 0);
    const moved = rescheduledDueDate(due, new Date(2026, 3, 3));

    expect(moved.getHours()).toBe(9);
    expect(moved.getDate()).toBe(3);
  });
});
