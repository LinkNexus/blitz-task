import type { ProjectTaskDetails, ProjectTaskPriority } from "@/api";

export type DueBucket = "overdue" | "today" | "week";
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

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Bucket of a task's due date relative to today, or null if it's further out / unset. */
export function dueBucketOf(
  task: Pick<ProjectTaskDetails, "dueDate">,
): DueBucket | null {
  if (!task.dueDate) return null;
  const diffDays = Math.round(
    (startOfDay(new Date(task.dueDate)).getTime() -
      startOfDay(new Date()).getTime()) /
      86_400_000,
  );
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays <= 7) return "week";
  return null;
}

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
