import type { UserTaskSummary } from "@/api";
import { daysUntilDue, dueBucketOf } from "@/lib/due-dates";

/** Heading treatment for a section. Absent means neutral — most sections are. */
export type SectionAccent = "danger" | "warning";

export type TaskSection = {
  key: string;
  label: string;
  accent?: SectionAccent;
  tasks: UserTaskSummary[];
};

// Every entry carries an `accent` key, `undefined` where the heading is neutral, so the shape
// is uniform enough to destructure — a union of with/without would not be.
export const DUE_SECTIONS = [
  { key: "overdue", label: "Overdue", accent: "danger" },
  { key: "today", label: "Today", accent: "warning" },
  { key: "week", label: "Next 7 days", accent: undefined },
  { key: "later", label: "Later", accent: undefined },
  { key: "none", label: "No due date", accent: undefined },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  accent: SectionAccent | undefined;
}>;

export type DueSectionKey = (typeof DUE_SECTIONS)[number]["key"];

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
export function groupByDueSection(tasks: UserTaskSummary[]): TaskSection[] {
  return DUE_SECTIONS.map(({ key, label, accent }) => ({
    key,
    label,
    accent,
    tasks: tasks.filter((task) => dueSectionOf(task) === key),
  })).filter((section) => section.tasks.length > 0);
}

/**
 * The Today view: what is late plus what is due before the day is out, and nothing else.
 *
 * A subset of the dashboard's grouping rather than its own pass over the tasks, so the two
 * screens can never disagree about which day a task belongs to.
 */
export function todaySections(tasks: UserTaskSummary[]): TaskSection[] {
  return groupByDueSection(tasks).filter(
    (section) => section.key === "overdue" || section.key === "today",
  );
}

/**
 * How far ahead the Upcoming view lays out one section per day. Two weeks is far enough to plan
 * around and short enough that the page is still a list rather than a calendar — anything past
 * it lands in a single trailing section, which answers "is there something out there" without
 * pretending to schedule it.
 */
export const UPCOMING_HORIZON_DAYS = 14;

/**
 * The Upcoming view: one section per calendar day, tomorrow onwards.
 *
 * Overdue and due-today work is deliberately excluded — it belongs to Today, and repeating it
 * here would make two screens that disagree about what is urgent. The route surfaces a count
 * and a link instead, so nothing goes unseen.
 */
export function upcomingSections(
  tasks: UserTaskSummary[],
  horizonDays: number = UPCOMING_HORIZON_DAYS,
): TaskSection[] {
  const byDay = new Map<number, UserTaskSummary[]>();
  const later: UserTaskSummary[] = [];

  for (const task of tasks) {
    const days = daysUntilDue(task);
    // null is undated, < 1 is Today's business.
    if (days === null || days < 1) continue;

    if (days > horizonDays) {
      later.push(task);
      continue;
    }

    const day = byDay.get(days);
    if (day) day.push(task);
    else byDay.set(days, [task]);
  }

  const sections: TaskSection[] = [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([days, dayTasks]) => ({
      key: `day-${days}`,
      label: dayLabel(days, dayTasks[0]),
      tasks: dayTasks,
    }));

  if (later.length > 0) {
    sections.push({
      key: "later",
      label: `Beyond ${horizonDays} days`,
      tasks: later,
    });
  }

  return sections;
}

/** Labels a day section from a task that lives in it, so the heading and its rows cannot drift. */
function dayLabel(days: number, task: UserTaskSummary): string {
  if (days === 1) return "Tomorrow";
  return new Date(task.dueDate ?? "").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
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
