import type { Row } from "@tanstack/react-table";
import type { ProjectDetails } from "@/api";
import {
  dueBucketOf,
  type GroupByField,
  PRIORITY_ORDER,
} from "../toolbar-filters";
import type { features, TaskRow } from "./columns";

export type TaskRows = Row<typeof features, TaskRow>[];

/** A non-column grouping of table rows: no dnd, no column actions. */
export type TaskGroup = {
  key: string;
  label: string;
  rows: TaskRows;
};

const DUE_GROUPS = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Due today" },
  { key: "week", label: "Due this week" },
  { key: "later", label: "Later" },
  { key: "none", label: "No due date" },
] as const;

type DueGroupKey = (typeof DUE_GROUPS)[number]["key"];

function dueGroupOf(task: TaskRow): DueGroupKey {
  if (!task.dueDate) return "none";
  return dueBucketOf(task) ?? "later";
}

/**
 * Groups rows for every `groupBy` except "column" — that one stays in
 * `TableView`, since it is the only grouping the drag-and-drop model can
 * express (a task's group *is* its column).
 */
export function groupRows(
  rows: TaskRows,
  groupBy: Exclude<GroupByField, "column">,
  project: ProjectDetails,
): TaskGroup[] {
  if (groupBy === "priority") {
    // Every priority is listed, empty or not, so the set of groups stays stable
    // as tasks move between them.
    return PRIORITY_ORDER.map((priority) => ({
      key: `priority:${priority}`,
      label: priority.charAt(0) + priority.slice(1).toLowerCase(),
      rows: rows.filter((row) => row.original.priority === priority),
    }));
  }

  if (groupBy === "dueDate") {
    return DUE_GROUPS.map(({ key, label }) => ({
      key: `due:${key}`,
      label,
      rows: rows.filter((row) => dueGroupOf(row.original) === key),
    }));
  }

  // A task with several assignees is listed under each of them, so the counts
  // here can add up to more than the number of tasks.
  const groups: TaskGroup[] = project.participants.map((participant) => ({
    key: `assignee:${participant.userId}`,
    label: participant.name,
    rows: rows.filter((row) =>
      row.original.assigneeIds.some(
        (id) => String(id) === String(participant.userId),
      ),
    ),
  }));

  const unassigned = rows.filter(
    (row) => row.original.assigneeIds.length === 0,
  );
  if (unassigned.length > 0) {
    groups.push({
      key: "assignee:none",
      label: "Unassigned",
      rows: unassigned,
    });
  }

  // Unlike priorities, a project can have many members — hiding the ones with
  // nothing assigned keeps the table readable.
  return groups.filter((group) => group.rows.length > 0);
}
