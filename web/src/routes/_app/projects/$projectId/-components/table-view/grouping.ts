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
  /**
   * A second level, used only by the section grouping: it mirrors the board's swimlanes, where a
   * section is a row *crossing* the columns rather than an alternative to them. Every other
   * grouping replaces the column axis outright, so it has none.
   */
  subGroups?: TaskGroup[];
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

  if (groupBy === "section") {
    // Columns in board order, so a section's contents read the same way they do on the board.
    const orderedColumns = [...project.columns].sort(
      (a, b) => Number(a.score) - Number(b.score),
    );

    const byColumn = (sectionRows: TaskRows): TaskGroup[] =>
      orderedColumns
        .map((column) => ({
          key: `column:${column.id}`,
          label: column.name,
          rows: sectionRows.filter(
            (row) => String(row.original.col.id) === String(column.id),
          ),
        }))
        // Unlike the sections themselves, an empty column inside a section is noise — a project
        // with five columns and four sections would otherwise render twenty headers for nothing.
        .filter((group) => group.rows.length > 0);

    // Every section is listed, empty or not — like priorities and unlike assignees. A project
    // has few of them, they are the structure someone deliberately set up, and one vanishing
    // because it briefly holds nothing would read as having lost it.
    const groups: TaskGroup[] = project.sections.map((section) => {
      const sectionRows = rows.filter(
        (row) => String(row.original.sectionId) === String(section.id),
      );
      return {
        key: `section:${section.id}`,
        label: section.name,
        rows: sectionRows,
        subGroups: byColumn(sectionRows),
      };
    });

    // A task need not belong to a section, so this bucket is not an edge case — it is where
    // everything starts out and where quick captures stay.
    //
    // It also catches a task pointing at a section this board no longer has, which happens for
    // real: someone deletes a section while another person has the table open. Testing for
    // "not one of ours" rather than "null" is what stops that task disappearing from the view
    // altogether — every row has to land in exactly one group.
    const known = new Set(
      project.sections.map((section) => String(section.id)),
    );
    const unsectioned = rows.filter(
      (row) =>
        row.original.sectionId == null ||
        !known.has(String(row.original.sectionId)),
    );
    groups.push({
      key: "section:none",
      label: "No section",
      rows: unsectioned,
      subGroups: byColumn(unsectioned),
    });

    return groups;
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
