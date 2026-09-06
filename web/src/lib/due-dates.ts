export type DueBucket = "overdue" | "today" | "week";

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Whole days from today to a task's due date — negative for late, 0 for today — or null if it
 * has no due date.
 *
 * Compared at day boundaries rather than instants: a task due at 09:00 today is "today" all day
 * and not "overdue" from 09:01, which is what someone reading a due date means by it.
 */
export function daysUntilDue(task: { dueDate: string | null }): number | null {
  if (!task.dueDate) return null;
  return Math.round(
    (startOfDay(new Date(task.dueDate)).getTime() -
      startOfDay(new Date()).getTime()) /
      86_400_000,
  );
}

/**
 * Bucket of a task's due date relative to today, or null if it's further out / unset.
 *
 * Shared rather than colocated: the board toolbar, the table's due-date grouping and the
 * dashboard all sort tasks into the same buckets, and a second copy of this arithmetic would
 * eventually drift into a task reading "overdue" on one screen and "later" on another.
 */
export function dueBucketOf(task: {
  dueDate: string | null;
}): DueBucket | null {
  const diffDays = daysUntilDue(task);
  if (diffDays === null) return null;
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays <= 7) return "week";
  return null;
}
