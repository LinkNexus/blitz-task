import { describe, expect, test } from "bun:test";
import type { UserTaskSummary } from "@/api";
import {
  countTasks,
  dueSectionOf,
  groupByDueSection,
  todaySections,
  upcomingSections,
} from "./task-buckets";

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

describe("todaySections", () => {
  test("keeps what is late or due today and drops the rest", () => {
    const sections = todaySections([
      task("late", daysOut(-2)),
      task("now", daysOut(0)),
      task("soon", daysOut(3)),
      task("someday", daysOut(40)),
      task("undated", null),
    ]);

    expect(sections.map((s) => s.key)).toEqual(["overdue", "today"]);
    expect(sections.flatMap((s) => s.tasks.map((t) => t.name))).toEqual([
      "late",
      "now",
    ]);
  });

  test("is empty when nothing is due", () => {
    expect(todaySections([task("soon", daysOut(3))])).toEqual([]);
  });
});

describe("upcomingSections", () => {
  test("leaves overdue, due-today and undated work to the Today view", () => {
    // The two screens would otherwise disagree about what is urgent; /upcoming links to the
    // count instead of repeating the rows.
    const sections = upcomingSections([
      task("late", daysOut(-1)),
      task("now", daysOut(0)),
      task("undated", null),
    ]);

    expect(sections).toEqual([]);
  });

  test("gives each day its own section, soonest first", () => {
    const sections = upcomingSections([
      task("in three", daysOut(3)),
      task("tomorrow", daysOut(1)),
    ]);

    expect(sections.map((s) => s.tasks.map((t) => t.name))).toEqual([
      ["tomorrow"],
      ["in three"],
    ]);
    expect(sections[0].label).toBe("Tomorrow");
  });

  test("groups tasks that share a day", () => {
    const sections = upcomingSections([
      task("first", daysOut(2)),
      task("second", daysOut(2)),
    ]);

    expect(sections).toHaveLength(1);
    expect(sections[0].tasks.map((t) => t.name)).toEqual(["first", "second"]);
  });

  test("collects everything past the horizon into one trailing section", () => {
    const sections = upcomingSections(
      [
        task("inside", daysOut(2)),
        task("outside", daysOut(20)),
        task("far", daysOut(90)),
      ],
      14,
    );

    const last = sections[sections.length - 1];
    expect(last.key).toBe("later");
    expect(last.label).toBe("Beyond 14 days");
    expect(last.tasks.map((t) => t.name)).toEqual(["outside", "far"]);
  });

  test("honours a shorter horizon", () => {
    const sections = upcomingSections([task("in five", daysOut(5))], 3);

    expect(sections.map((s) => s.key)).toEqual(["later"]);
  });
});
