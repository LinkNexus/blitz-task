import { describe, expect, test } from "bun:test";
import type { ProjectDetails } from "@/api";
import { buildTimeline } from "./timeline";

type Spec = {
  id: number;
  name?: string;
  start?: string;
  due?: string;
  columnId?: number;
  blockedBy?: number[];
};

/** A local-midnight ISO string, so the tests are not at the mercy of the runner's offset. */
const at = (day: string) => new Date(`${day}T12:00:00`).toISOString();

const project = (specs: Spec[]): ProjectDetails =>
  ({
    columns: [
      {
        id: 1,
        name: "Todo",
        score: 0,
        tasks: specs.map((s) => ({
          id: s.id,
          name: s.name ?? `Task ${s.id}`,
          columnId: s.columnId ?? 1,
          startDate: s.start ? at(s.start) : null,
          dueDate: s.due ? at(s.due) : null,
          blockedBy: (s.blockedBy ?? []).map((id) => ({
            id,
            name: `Task ${id}`,
            columnId: 1,
          })),
          blocks: [],
        })),
      },
      { id: 2, name: "Done", score: 1000, tasks: [] },
    ],
  }) as unknown as ProjectDetails;

describe("buildTimeline", () => {
  test("a task with a start and a due date spans the days between them", () => {
    const timeline = buildTimeline(
      project([{ id: 1, start: "2026-03-10", due: "2026-03-14" }]),
      0,
    );

    const bar = timeline.bars[0];
    expect(bar.offsetDays).toBe(0);
    // Inclusive of both ends: work due on the 14th occupies the 14th.
    expect(bar.lengthDays).toBe(5);
    expect(bar.isMilestone).toBe(false);
    expect(timeline.totalDays).toBe(5);
  });

  test("a task with only a due date is one day, not a bar stretching to it", () => {
    const timeline = buildTimeline(project([{ id: 1, due: "2026-03-10" }]), 0);

    // Inventing the missing end would draw a span nobody entered.
    expect(timeline.bars[0].lengthDays).toBe(1);
    expect(timeline.bars[0].isMilestone).toBe(true);
  });

  test("a start after its due date collapses to a single day", () => {
    // Bad data rather than a negative-width bar.
    const timeline = buildTimeline(
      project([{ id: 1, start: "2026-03-20", due: "2026-03-10" }]),
      0,
    );

    expect(timeline.bars[0].lengthDays).toBe(1);
  });

  test("the window spans the data and pads both ends", () => {
    const timeline = buildTimeline(
      project([
        { id: 1, start: "2026-03-10", due: "2026-03-12" },
        { id: 2, start: "2026-03-20", due: "2026-03-22" },
      ]),
      2,
    );

    // 10th to 22nd is 13 days, plus two days of padding either side.
    expect(timeline.totalDays).toBe(17);
    expect(timeline.bars[0].offsetDays).toBe(2);
    expect(timeline.bars[1].offsetDays).toBe(12);
  });

  test("undated tasks are left off entirely", () => {
    const timeline = buildTimeline(
      project([
        { id: 1, name: "Dated", due: "2026-03-10" },
        { id: 2, name: "Someday" },
      ]),
      0,
    );

    // A timeline answers "when"; a task with neither date is not part of that question.
    expect(timeline.bars.map((b) => b.name)).toEqual(["Dated"]);
  });

  test("a project with nothing dated produces an empty chart", () => {
    const timeline = buildTimeline(project([{ id: 1 }, { id: 2 }]));
    expect(timeline.bars).toEqual([]);
    expect(timeline.totalDays).toBe(0);
  });

  test("rows are ordered by when work starts", () => {
    const timeline = buildTimeline(
      project([
        { id: 1, name: "Later", start: "2026-03-20", due: "2026-03-21" },
        { id: 2, name: "Earlier", start: "2026-03-10", due: "2026-03-11" },
      ]),
      0,
    );

    expect(timeline.bars.map((b) => [b.name, b.row])).toEqual([
      ["Earlier", 0],
      ["Later", 1],
    ]);
  });

  test("dependency arrows carry over, and ones pointing off the chart do not", () => {
    const timeline = buildTimeline(
      project([
        { id: 1, name: "Blocker", due: "2026-03-10" },
        { id: 2, name: "Blocked", due: "2026-03-12", blockedBy: [1, 99] },
      ]),
      0,
    );

    // 99 was never drawn — an arrow to it would point at nothing.
    expect(timeline.arrows).toEqual([{ from: 1, to: 2 }]);
  });

  test("a task in the last column reads as completed", () => {
    const timeline = buildTimeline(
      project([{ id: 1, due: "2026-03-10", columnId: 2 }]),
      0,
    );

    expect(timeline.bars[0].isCompleted).toBe(true);
  });

  test("today is placed when it falls inside the window, and not when it does not", () => {
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const inside = buildTimeline(project([{ id: 1, due: iso(today) }]), 2);
    expect(inside.todayOffset).toBe(2);

    const past = buildTimeline(project([{ id: 1, due: "2020-01-01" }]), 0);
    expect(past.todayOffset).toBeNull();
  });
});
