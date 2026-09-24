import { describe, expect, test } from "bun:test";
import type { ProjectDetails, ProjectTaskDetails } from "@/api";
import { isCompletedColumn, openBlockers } from "./task-dependencies";

const project = (columns: { id: number; score: number }[]) =>
  ({
    columns: columns.map((c) => ({
      ...c,
      name: `Column ${c.id}`,
      color: "#fff",
      tasks: [],
    })),
  }) as unknown as ProjectDetails;

const blocked = (blockedBy: { id: number; columnId: number }[]) =>
  ({
    blockedBy: blockedBy.map((b) => ({ ...b, name: `Task ${b.id}` })),
  }) as unknown as ProjectTaskDetails;

const board = project([
  { id: 1, score: 0 },
  { id: 2, score: 1000 },
  { id: 3, score: 2000 },
]);

describe("isCompletedColumn", () => {
  test("only the highest-scoring column counts as done", () => {
    // Completion is a position, not a flag — the same rule the board and the dashboard use.
    expect(isCompletedColumn(3, board)).toBe(true);
    expect(isCompletedColumn(2, board)).toBe(false);
    expect(isCompletedColumn(1, board)).toBe(false);
  });

  test("a column the project does not have is not done", () => {
    expect(isCompletedColumn(99, board)).toBe(false);
  });

  test("a project with no columns has nothing completed", () => {
    expect(isCompletedColumn(1, project([]))).toBe(false);
  });
});

describe("openBlockers", () => {
  test("keeps only the blockers still to be done", () => {
    const task = blocked([
      { id: 10, columnId: 1 },
      { id: 11, columnId: 3 },
      { id: 12, columnId: 2 },
    ]);

    expect(openBlockers(task, board).map((b) => b.id)).toEqual([10, 12]);
  });

  test("a task with no blockers has none open", () => {
    expect(openBlockers(blocked([]), board)).toEqual([]);
  });

  test("every blocker finished means nothing is open", () => {
    // What makes the warning stop appearing once the work it named is actually done.
    expect(openBlockers(blocked([{ id: 10, columnId: 3 }]), board)).toEqual([]);
  });
});
