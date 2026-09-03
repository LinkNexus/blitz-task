import type { UserTaskSummary } from "@/api";
import { dueBucketOf } from "@/lib/due-dates";

export const DUE_SECTIONS = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "week", label: "Next 7 days" },
  { key: "later", label: "Later" },
  { key: "none", label: "No due date" },
] as const;

export type DueSectionKey = (typeof DUE_SECTIONS)[number]["key"];

export type DueSection = {
  key: DueSectionKey;
  label: string;
  tasks: UserTaskSummary[];
};

/**
 * `dueBucketOf` returns null both for an undated task and for one due further out than a week.
 * The dashboard has to tell those apart — "no due date" is work without a deadline, "later" is
 * work with one you simply aren't near yet.
 */
export function dueSectionOf(
  task: Pick<UserTaskSummary, "dueDate">,
): DueSectionKey {
  if (!task.dueDate) return "none";
  return dueBucketOf(task) ?? "later";
}

/**
 * Splits tasks into due-date sections, preserving the order they arrive in — the API already
 * returns them soonest-first, so re-sorting here would only risk disagreeing with it.
 *
 * Empty sections are dropped, unlike the table's due-date grouping which keeps them: the table
 * is a stable surface you drag tasks around in, whereas an empty "Overdue" heading on a
 * dashboard is just noise.
 */
export function groupByDueSection(tasks: UserTaskSummary[]): DueSection[] {
  return DUE_SECTIONS.map(({ key, label }) => ({
    key,
    label,
    tasks: tasks.filter((task) => dueSectionOf(task) === key),
  })).filter((section) => section.tasks.length > 0);
}

export type DashboardCounts = {
  overdue: number;
  today: number;
  week: number;
  open: number;
};

/**
 * Counts for the stat tiles. "week" is the next seven days *including* today and anything
 * already late, because the tile answers "what is on me this week", not "which bucket is this".
 */
export function countTasks(tasks: UserTaskSummary[]): DashboardCounts {
  const sections = tasks.map(dueSectionOf);
  const count = (key: DueSectionKey) =>
    sections.filter((section) => section === key).length;

  const overdue = count("overdue");
  const today = count("today");

  return {
    overdue,
    today,
    week: overdue + today + count("week"),
    open: tasks.length,
  };
}
