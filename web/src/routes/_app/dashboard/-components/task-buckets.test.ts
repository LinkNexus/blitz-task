import { describe, expect, test } from "bun:test";
import type { UserTaskSummary } from "@/api";
import { countTasks, dueSectionOf, groupByDueSection } from "./task-buckets";

function daysOut(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function task(name: string, dueDate: string | null): UserTaskSummary {
  return {
    id: name,
    name,
    description: "",
    priority: "MEDIUM",
    tags: [],
    startDate: null,
    dueDate,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assigneeIds: [],
    projectId: 1,
    projectName: "Alpha",
    columnId: 1,
    columnName: "Todo",
    columnColor: "#fff",
    isCompleted: false,
  };
}

describe("dueSectionOf", () => {
  test("separates undated work from work due further out than a week", () => {
    // Both fall out of dueBucketOf as null; conflating them is the bug this guards.
    expect(dueSectionOf({ dueDate: null })).toBe("none");
    expect(dueSectionOf({ dueDate: daysOut(60) })).toBe("later");
  });

  test("routes each dated task to its bucket", () => {
    expect(dueSectionOf({ dueDate: daysOut(-1) })).toBe("overdue");
    expect(dueSectionOf({ dueDate: daysOut(0) })).toBe("today");
    expect(dueSectionOf({ dueDate: daysOut(3) })).toBe("week");
    expect(dueSectionOf({ dueDate: daysOut(7) })).toBe("week");
    expect(dueSectionOf({ dueDate: daysOut(8) })).toBe("later");
  });
});

describe("groupByDueSection", () => {
  test("orders sections most-urgent first and drops the empty ones", () => {
    const sections = groupByDueSection([
      task("undated", null),
      task("late", daysOut(-2)),
      task("someday", daysOut(30)),
    ]);

    expect(sections.map((s) => s.key)).toEqual(["overdue", "later", "none"]);
  });

  test("keeps the order tasks arrive in within a section", () => {
    // The API already returns them soonest-first; grouping must not reshuffle that.
    const [overdue] = groupByDueSection([
      task("older", daysOut(-9)),
      task("newer", daysOut(-1)),
    ]);

    expect(overdue.tasks.map((t) => t.name)).toEqual(["older", "newer"]);
  });

  test("returns no sections for no tasks", () => {
    expect(groupByDueSection([])).toEqual([]);
  });
});

describe("countTasks", () => {
  test("counts this week as overdue + today + the next seven days", () => {
    const counts = countTasks([
      task("late", daysOut(-3)),
      task("now", daysOut(0)),
      task("soon", daysOut(4)),
      task("someday", daysOut(40)),
      task("undated", null),
    ]);

    expect(counts).toEqual({ overdue: 1, today: 1, week: 3, open: 5 });
  });

  test("is all zeroes for no tasks", () => {
    expect(countTasks([])).toEqual({
      overdue: 0,
      today: 0,
      week: 0,
      open: 0,
    });
  });
});
