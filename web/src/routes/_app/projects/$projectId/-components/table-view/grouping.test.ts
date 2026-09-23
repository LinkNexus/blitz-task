import { describe, expect, test } from "bun:test";
import type { ProjectDetails } from "@/api";
import type { TaskRow } from "./columns";
import { groupRows, type TaskRows } from "./grouping";

const daysOut = (n: number) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toISOString();
};

// groupRows only ever touches `row.original`, so a row stub is enough — building real
// TanStack rows here would test the table library rather than the grouping logic.
const row = (over: Partial<TaskRow> & { id: number }): TaskRows[number] =>
  ({
    id: String(over.id),
    original: {
      name: `Task ${over.id}`,
      description: "",
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
      isOverdue: false,
      isCompleted: false,
      ...over,
    },
  }) as unknown as TaskRows[number];

const project = (
  participants: { userId: number; name: string }[],
  sections: { id: number; name: string }[] = [],
) =>
  ({
    participants: participants.map((p, i) => ({
      id: i + 1,
      userId: p.userId,
      name: p.name,
      role: "Contributor",
      joinedAt: "2026-01-01T00:00:00Z",
    })),
    sections: sections.map((s, i) => ({
      id: s.id,
      name: s.name,
      color: "#6366F1",
      score: i * 1000,
    })),
  }) as unknown as ProjectDetails;

describe("groupRows — priority", () => {
  const rows = [
    row({ id: 1, priority: "URGENT" }),
    row({ id: 2, priority: "LOW" }),
    row({ id: 3, priority: "URGENT" }),
  ];

  test("always emits all four priorities, in descending urgency", () => {
    const groups = groupRows(rows, "priority", project([]));
    expect(groups.map((g) => g.label)).toEqual([
      "Urgent",
      "High",
      "Medium",
      "Low",
    ]);
  });

  test("keeps empty priority groups so the set of groups is stable", () => {
    const groups = groupRows(rows, "priority", project([]));
    expect(groups.find((g) => g.label === "High")?.rows).toHaveLength(0);
  });

  test("places each task under exactly one priority", () => {
    const groups = groupRows(rows, "priority", project([]));
    expect(groups.find((g) => g.label === "Urgent")?.rows).toHaveLength(2);
    expect(groups.find((g) => g.label === "Low")?.rows).toHaveLength(1);
    const total = groups.reduce((n, g) => n + g.rows.length, 0);
    expect(total).toBe(rows.length);
  });
});

describe("groupRows — dueDate", () => {
  const rows = [
    row({ id: 1, dueDate: daysOut(-2) }),
    row({ id: 2, dueDate: daysOut(0) }),
    row({ id: 3, dueDate: daysOut(3) }),
    row({ id: 4, dueDate: daysOut(60) }),
    row({ id: 5, dueDate: null }),
  ];

  test("emits the five buckets in chronological order", () => {
    const groups = groupRows(rows, "dueDate", project([]));
    expect(groups.map((g) => g.label)).toEqual([
      "Overdue",
      "Due today",
      "Due this week",
      "Later",
      "No due date",
    ]);
  });

  test("routes each task to its bucket, including the two dueBucketOf returns null for", () => {
    const groups = groupRows(rows, "dueDate", project([]));
    const idsIn = (label: string) =>
      groups.find((g) => g.label === label)?.rows.map((r) => r.original.name);
    expect(idsIn("Overdue")).toEqual(["Task 1"]);
    expect(idsIn("Due today")).toEqual(["Task 2"]);
    expect(idsIn("Due this week")).toEqual(["Task 3"]);
    // Far-future and undated both fall out of dueBucketOf, and must not be conflated.
    expect(idsIn("Later")).toEqual(["Task 4"]);
    expect(idsIn("No due date")).toEqual(["Task 5"]);
  });
});

describe("groupRows — assignee", () => {
  const people = project([
    { userId: 1, name: "Ada" },
    { userId: 2, name: "Grace" },
    { userId: 3, name: "Nobody's pick" },
  ]);

  test("hides participants with nothing assigned", () => {
    const groups = groupRows(
      [row({ id: 1, assigneeIds: [1] })],
      "assignee",
      people,
    );
    expect(groups.map((g) => g.label)).toEqual(["Ada"]);
  });

  test("lists a multi-assignee task under each of its assignees", () => {
    const groups = groupRows(
      [row({ id: 1, assigneeIds: [1, 2] })],
      "assignee",
      people,
    );
    expect(groups.map((g) => g.label)).toEqual(["Ada", "Grace"]);
    // Counts deliberately sum to more than the number of tasks.
    expect(groups.reduce((n, g) => n + g.rows.length, 0)).toBe(2);
  });

  test("compares ids as strings, since the API returns number | string", () => {
    const groups = groupRows(
      [row({ id: 1, assigneeIds: ["1"] })],
      "assignee",
      people,
    );
    expect(groups.map((g) => g.label)).toEqual(["Ada"]);
  });

  test("adds an Unassigned group last, and only when something is unassigned", () => {
    const withNone = groupRows(
      [row({ id: 1, assigneeIds: [1] }), row({ id: 2, assigneeIds: [] })],
      "assignee",
      people,
    );
    expect(withNone.map((g) => g.label)).toEqual(["Ada", "Unassigned"]);

    const withoutNone = groupRows(
      [row({ id: 1, assigneeIds: [1] })],
      "assignee",
      people,
    );
    expect(withoutNone.map((g) => g.label)).not.toContain("Unassigned");
  });

  test("an empty row set produces no groups at all", () => {
    expect(groupRows([], "assignee", people)).toEqual([]);
  });
});

describe("groupRows — section", () => {
  const withSections = project(
    [],
    [
      { id: 10, name: "frontend" },
      { id: 20, name: "backend" },
      { id: 30, name: "infra" },
    ],
  );

  test("lists every section the project has, empty ones included", () => {
    const groups = groupRows(
      [row({ id: 1, sectionId: 10 })],
      "section",
      withSections,
    );

    // Unlike assignees, a project has few sections and they are structure somebody set up on
    // purpose — one disappearing because it briefly holds nothing would read as having lost it.
    expect(groups.map((g) => g.label)).toEqual([
      "frontend",
      "backend",
      "infra",
      "No section",
    ]);
  });

  test("puts each task under its own section", () => {
    const groups = groupRows(
      [
        row({ id: 1, sectionId: 10 }),
        row({ id: 2, sectionId: 20 }),
        row({ id: 3, sectionId: 10 }),
      ],
      "section",
      withSections,
    );

    expect(groups[0].rows.map((r) => r.original.name)).toEqual([
      "Task 1",
      "Task 3",
    ]);
    expect(groups[1].rows.map((r) => r.original.name)).toEqual(["Task 2"]);
    expect(groups[2].rows).toEqual([]);
  });

  test("collects unsectioned tasks rather than dropping them", () => {
    // Not an edge case: it is where every task starts and where quick captures stay.
    const groups = groupRows(
      [row({ id: 1, sectionId: null }), row({ id: 2, sectionId: 10 })],
      "section",
      withSections,
    );

    const none = groups.find((g) => g.key === "section:none");
    expect(none?.rows.map((r) => r.original.name)).toEqual(["Task 1"]);
  });

  test("a section id that no longer exists lands in No section", () => {
    // A section can be deleted while someone else has the board open; the task survives it, and
    // every row has to land in exactly one group or it vanishes from the table.
    const groups = groupRows(
      [row({ id: 1, sectionId: 999 })],
      "section",
      withSections,
    );

    expect(groups.flatMap((g) => g.rows)).toHaveLength(1);
    expect(
      groups.find((g) => g.key === "section:none")?.rows[0].original.name,
    ).toBe("Task 1");
  });
});
