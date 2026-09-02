import { describe, expect, test } from "bun:test";
import type { ProjectTaskDetails } from "@/api";
import {
  DEFAULT_TOOLBAR_STATE,
  dueBucketOf,
  hasActiveFilters,
  sortTasks,
  type ToolbarState,
  taskMatchesFilters,
} from "./toolbar-filters";

/** Days from today as an ISO string, for due-date cases that must not drift. */
const daysOut = (n: number) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toISOString();
};

const task = (over: Partial<ProjectTaskDetails> = {}): ProjectTaskDetails => ({
  id: 1,
  name: "Write the report",
  description: "A description",
  priority: "MEDIUM",
  score: 1000,
  tags: [],
  startDate: null,
  dueDate: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  assigneeIds: [],
  attachments: [],
  columnId: 1,
  ...over,
});

const state = (over: Partial<ToolbarState> = {}): ToolbarState => ({
  ...DEFAULT_TOOLBAR_STATE,
  priorities: new Set(),
  dueBuckets: new Set(),
  assigneeIds: new Set(),
  ...over,
});

describe("hasActiveFilters", () => {
  test("is false for the default state", () => {
    expect(hasActiveFilters(DEFAULT_TOOLBAR_STATE)).toBe(false);
  });

  test("is true when any of the three filter sets is non-empty", () => {
    expect(hasActiveFilters(state({ priorities: new Set(["HIGH"]) }))).toBe(
      true,
    );
    expect(hasActiveFilters(state({ dueBuckets: new Set(["today"]) }))).toBe(
      true,
    );
    expect(hasActiveFilters(state({ assigneeIds: new Set(["7"]) }))).toBe(true);
  });

  test("ignores search, sort and groupBy — those are not filters", () => {
    expect(
      hasActiveFilters(
        state({ search: "report", sort: "priority", groupBy: "assignee" }),
      ),
    ).toBe(false);
  });
});

describe("dueBucketOf", () => {
  test("returns null when there is no due date", () => {
    expect(dueBucketOf({ dueDate: null })).toBeNull();
  });

  test("buckets by whole days relative to today", () => {
    expect(dueBucketOf({ dueDate: daysOut(-1) })).toBe("overdue");
    expect(dueBucketOf({ dueDate: daysOut(0) })).toBe("today");
    expect(dueBucketOf({ dueDate: daysOut(3) })).toBe("week");
  });

  test("day 7 is still 'this week' but day 8 falls out of every bucket", () => {
    expect(dueBucketOf({ dueDate: daysOut(7) })).toBe("week");
    expect(dueBucketOf({ dueDate: daysOut(8) })).toBeNull();
  });

  test("compares whole days, so earlier-today still counts as today, not overdue", () => {
    const earlierToday = new Date();
    earlierToday.setHours(0, 0, 1, 0);
    expect(dueBucketOf({ dueDate: earlierToday.toISOString() })).toBe("today");
  });
});

describe("taskMatchesFilters", () => {
  test("an empty state matches everything", () => {
    expect(taskMatchesFilters(task(), state())).toBe(true);
  });

  test("search covers name, description and tags, case-insensitively", () => {
    expect(taskMatchesFilters(task(), state({ search: "REPORT" }))).toBe(true);
    expect(
      taskMatchesFilters(
        task({ name: "x", description: "quarterly numbers" }),
        state({ search: "QUARTERLY" }),
      ),
    ).toBe(true);
    expect(
      taskMatchesFilters(
        task({ name: "x", description: "y", tags: ["urgent-ish"] }),
        state({ search: "urgent" }),
      ),
    ).toBe(true);
    expect(taskMatchesFilters(task(), state({ search: "nonsense" }))).toBe(
      false,
    );
  });

  test("a whitespace-only search is treated as no search", () => {
    expect(taskMatchesFilters(task(), state({ search: "   " }))).toBe(true);
  });

  test("priority filter keeps only the selected priorities", () => {
    const s = state({ priorities: new Set(["HIGH", "URGENT"]) });
    expect(taskMatchesFilters(task({ priority: "HIGH" }), s)).toBe(true);
    expect(taskMatchesFilters(task({ priority: "LOW" }), s)).toBe(false);
  });

  test("due-bucket filter excludes tasks with no due date at all", () => {
    const s = state({ dueBuckets: new Set(["today"]) });
    expect(taskMatchesFilters(task({ dueDate: daysOut(0) }), s)).toBe(true);
    expect(taskMatchesFilters(task({ dueDate: null }), s)).toBe(false);
    expect(taskMatchesFilters(task({ dueDate: daysOut(30) }), s)).toBe(false);
  });

  test("assignee filter matches on any one assignee, comparing as strings", () => {
    const s = state({ assigneeIds: new Set(["7"]) });
    // ids come off the API as number | string, so both forms must match.
    expect(taskMatchesFilters(task({ assigneeIds: [7] }), s)).toBe(true);
    expect(taskMatchesFilters(task({ assigneeIds: ["7"] }), s)).toBe(true);
    expect(taskMatchesFilters(task({ assigneeIds: [3, 7] }), s)).toBe(true);
    expect(taskMatchesFilters(task({ assigneeIds: [3] }), s)).toBe(false);
    expect(taskMatchesFilters(task({ assigneeIds: [] }), s)).toBe(false);
  });

  test("filters combine with AND — every active one must pass", () => {
    const s = state({
      search: "report",
      priorities: new Set(["HIGH"]),
      assigneeIds: new Set(["7"]),
    });
    expect(
      taskMatchesFilters(task({ priority: "HIGH", assigneeIds: [7] }), s),
    ).toBe(true);
    // right name and assignee, wrong priority
    expect(
      taskMatchesFilters(task({ priority: "LOW", assigneeIds: [7] }), s),
    ).toBe(false);
  });
});

describe("sortTasks", () => {
  test("does not mutate the input array", () => {
    const input = [task({ id: 1, name: "b" }), task({ id: 2, name: "a" })];
    const before = input.map((t) => t.id);
    sortTasks(input, "name");
    expect(input.map((t) => t.id)).toEqual(before);
  });

  test("priority sorts most urgent first", () => {
    const sorted = sortTasks(
      [
        task({ id: 1, priority: "LOW" }),
        task({ id: 2, priority: "URGENT" }),
        task({ id: 3, priority: "MEDIUM" }),
      ],
      "priority",
    );
    expect(sorted.map((t) => t.priority)).toEqual(["URGENT", "MEDIUM", "LOW"]);
  });

  test("dueDate sorts soonest first and parks undated tasks at the end", () => {
    const sorted = sortTasks(
      [
        task({ id: 1, dueDate: null }),
        task({ id: 2, dueDate: daysOut(5) }),
        task({ id: 3, dueDate: daysOut(1) }),
      ],
      "dueDate",
    );
    expect(sorted.map((t) => t.id)).toEqual([3, 2, 1]);
  });

  test("score sorts highest first, matching the board's natural order", () => {
    const sorted = sortTasks(
      [task({ id: 1, score: 500 }), task({ id: 2, score: 2000 })],
      "score",
    );
    expect(sorted.map((t) => t.id)).toEqual([2, 1]);
  });

  test("createdAt sorts newest first", () => {
    const sorted = sortTasks(
      [
        task({ id: 1, createdAt: "2026-01-01T00:00:00Z" }),
        task({ id: 2, createdAt: "2026-06-01T00:00:00Z" }),
      ],
      "createdAt",
    );
    expect(sorted.map((t) => t.id)).toEqual([2, 1]);
  });

  test("name sorts alphabetically", () => {
    const sorted = sortTasks(
      [task({ id: 1, name: "beta" }), task({ id: 2, name: "alpha" })],
      "name",
    );
    expect(sorted.map((t) => t.name)).toEqual(["alpha", "beta"]);
  });
});
