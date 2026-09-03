import type { ProjectTaskDetails, ProjectTaskPriority } from "@/api";
import { type DueBucket, dueBucketOf } from "@/lib/due-dates";

// Re-exported because the dashboard needs the same buckets, so the definition moved to
// @/lib/due-dates — but the toolbar, the table grouping and this module's tests have always
// imported it from here, and there is nothing to gain from churning those import paths.
export { type DueBucket, dueBucketOf };

export type SortField = "priority" | "dueDate" | "createdAt" | "score" | "name";
export type GroupByField = "column" | "priority" | "assignee" | "dueDate";

export type ToolbarState = {
  search: string;
  priorities: Set<ProjectTaskPriority>;
  dueBuckets: Set<DueBucket>;
  assigneeIds: Set<string>;
  sort: SortField | null;
  groupBy: GroupByField;
};

export const DEFAULT_TOOLBAR_STATE: ToolbarState = {
  search: "",
  priorities: new Set(),
  dueBuckets: new Set(),
  assigneeIds: new Set(),
  sort: null,
  groupBy: "column",
};

export function hasActiveFilters(state: ToolbarState): boolean {
  return (
    state.priorities.size > 0 ||
    state.dueBuckets.size > 0 ||
    state.assigneeIds.size > 0
  );
}

export const PRIORITY_ORDER: ProjectTaskPriority[] = [
  "URGENT",
  "HIGH",
  "MEDIUM",
  "LOW",
];

export function taskMatchesFilters(
  task: ProjectTaskDetails,
  state: ToolbarState,
): boolean {
  const query = state.search.trim().toLowerCase();
  if (query) {
    const matchesText =
      task.name.toLowerCase().includes(query) ||
      task.description.toLowerCase().includes(query) ||
      task.tags.some((tag) => tag.toLowerCase().includes(query));
    if (!matchesText) return false;
  }

  if (state.priorities.size > 0 && !state.priorities.has(task.priority)) {
    return false;
  }

  if (state.dueBuckets.size > 0) {
    const bucket = dueBucketOf(task);
    if (!bucket || !state.dueBuckets.has(bucket)) return false;
  }

  if (state.assigneeIds.size > 0) {
    const matchesAssignee = task.assigneeIds.some((id) =>
      state.assigneeIds.has(String(id)),
    );
    if (!matchesAssignee) return false;
  }

  return true;
}

/** Sorts a copy of `tasks`; "score" matches the board's natural (highest-first) order. */
export function sortTasks<T extends ProjectTaskDetails>(
  tasks: T[],
  field: SortField,
): T[] {
  const sorted = [...tasks];
  switch (field) {
    case "priority":
      sorted.sort(
        (a, b) =>
          PRIORITY_ORDER.indexOf(a.priority) -
          PRIORITY_ORDER.indexOf(b.priority),
      );
      break;
    case "dueDate":
      sorted.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
      break;
    case "createdAt":
      sorted.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      break;
    case "score":
      sorted.sort((a, b) => Number(b.score) - Number(a.score));
      break;
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }
  return sorted;
}
