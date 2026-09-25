import type { ProjectDetails, ProjectTaskDetails } from "@/api";
import { isCompletedColumn } from "./task-dependencies";

export type TimelineBar = {
  id: number;
  name: string;
  isCompleted: boolean;
  /** Days from the window's first day to this bar's first day. */
  offsetDays: number;
  /** Always at least 1: a task due on a day with no start still occupies that day. */
  lengthDays: number;
  /** True when the task has only a due date, so the bar is a moment rather than a span. */
  isMilestone: boolean;
  row: number;
};

export type TimelineArrow = { from: number; to: number };

export type Timeline = {
  bars: TimelineBar[];
  arrows: TimelineArrow[];
  /** Midnight of the first day shown, local time. */
  start: Date;
  totalDays: number;
  /** Days from `start` to today, or null when today falls outside the window. */
  todayOffset: number | null;
};

/** Midnight local, so a bar covers whole days rather than starting mid-afternoon. */
function startOfDay(value: string | Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

const DAY = 86_400_000;

const daysBetween = (from: Date, to: Date) =>
  Math.round((to.getTime() - from.getTime()) / DAY);

/**
 * Lays a project out along dates.
 *
 * <b>Only dated tasks appear.</b> A timeline answers "when", and a task with neither a start nor
 * a due date is not part of that question — the same call the dependency graph makes about tasks
 * with no edges.
 *
 * <b>The window comes from the data, not from a month.</b> A fixed month would cut bars in half
 * at both ends and hide the work that runs past it, which is the thing a timeline exists to
 * show; the range is whatever the tasks span, padded a little so the edges are not flush.
 *
 * Arrows reuse L40.6's dependencies, dropping any whose other end is not on the chart — an arrow
 * to a bar that was never drawn points at nothing.
 */
export function buildTimeline(project: ProjectDetails, padDays = 2): Timeline {
  const tasks = project.columns
    .flatMap((column) => column.tasks)
    .filter((task) => task.startDate || task.dueDate);

  if (tasks.length === 0) {
    return {
      bars: [],
      arrows: [],
      start: startOfDay(new Date()),
      totalDays: 0,
      todayOffset: null,
    };
  }

  const spanOf = (task: ProjectTaskDetails) => {
    // A task with only one of the two dates occupies that single day: inventing the other end
    // would draw a bar nobody asked for, stretching to today or to the window's edge.
    const from = startOfDay(task.startDate ?? task.dueDate!);
    const to = startOfDay(task.dueDate ?? task.startDate!);
    // A start after its due date is bad data rather than a negative bar; show the one day.
    return to < from ? { from, to: from } : { from, to };
  };

  const spans = tasks.map((task) => ({ task, ...spanOf(task) }));

  const earliest = new Date(Math.min(...spans.map((s) => s.from.getTime())));
  const latest = new Date(Math.max(...spans.map((s) => s.to.getTime())));

  const start = new Date(earliest.getTime() - padDays * DAY);
  const end = new Date(latest.getTime() + padDays * DAY);
  const totalDays = daysBetween(start, end) + 1;

  // Sorted by when work begins, then by name, so the chart reads top-left to bottom-right and
  // the order does not shuffle between renders.
  const ordered = [...spans].sort(
    (a, b) =>
      a.from.getTime() - b.from.getTime() ||
      a.task.name.localeCompare(b.task.name),
  );

  const bars: TimelineBar[] = ordered.map((span, row) => ({
    id: Number(span.task.id),
    name: span.task.name,
    isCompleted: isCompletedColumn(span.task.columnId, project),
    offsetDays: daysBetween(start, span.from),
    lengthDays: daysBetween(span.from, span.to) + 1,
    isMilestone: !span.task.startDate || !span.task.dueDate,
    row,
  }));

  const onChart = new Set(bars.map((bar) => bar.id));
  const arrows: TimelineArrow[] = [];

  for (const { task } of ordered) {
    for (const blocker of task.blockedBy) {
      if (onChart.has(Number(blocker.id))) {
        arrows.push({ from: Number(blocker.id), to: Number(task.id) });
      }
    }
  }

  const todayOffset = daysBetween(start, startOfDay(new Date()));

  return {
    bars,
    arrows,
    start,
    totalDays,
    todayOffset:
      todayOffset >= 0 && todayOffset < totalDays ? todayOffset : null,
  };
}
