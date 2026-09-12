import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

/**
 * The grid always starts on a Monday, because the working week does and a month whose first row
 * begins on Sunday reads wrong to everyone who plans around weekdays.
 */
const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

/**
 * The minimum a day needs to be placed. Deliberately not `CalendarItem`: the layout is pure date
 * arithmetic, and keeping the API type out of it is what lets these functions be tested without
 * building a task.
 */
export type LayoutItem = {
  key: string;
  /** Local-day start. A task with no start date is a point, so start equals end. */
  start: Date;
  end: Date;
};

export type Segment<T extends LayoutItem = LayoutItem> = {
  item: T;
  /** 0 = Monday of this row. */
  startCol: number;
  /** How many columns the bar covers in this row, 1–7. */
  span: number;
  lane: number;
  /** The span began in an earlier week, so the bar should look cut off on the left. */
  continuesBefore: boolean;
  continuesAfter: boolean;
};

export type WeekLayout<T extends LayoutItem = LayoutItem> = {
  days: Date[];
  segments: Segment<T>[];
  /** Per column, how many items did not fit in the visible lanes. */
  overflow: number[];
};

/**
 * The 42 days a month grid draws — six rows, so the grid never changes height as you page
 * through months, which would make the whole page jump.
 */
export function monthGridDays(month: Date): Date[] {
  const first = startOfWeek(startOfMonth(month), WEEK_OPTIONS);
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

/**
 * Lays out one week's row.
 *
 * Items are placed into lanes greedily, longest first, so a bar that crosses the whole week sits
 * above the single-day chips rather than being threaded between them. A lane is a horizontal
 * track: two items may share one only if their columns do not overlap.
 *
 * Anything that would land past `maxLanes` is dropped and counted per day instead — a cell is a
 * few dozen pixels tall, and a row that grows to fit eleven tasks stops being a month view.
 */
export function layoutWeek<T extends LayoutItem>(
  items: T[],
  weekStart: Date,
  maxLanes: number,
): WeekLayout<T> {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = days[6];

  const visible = items
    .filter((item) => item.start <= weekEnd && item.end >= weekStart)
    .map((item) => {
      const startCol = Math.max(
        0,
        differenceInCalendarDays(startOfDay(item.start), weekStart),
      );
      const endCol = Math.min(
        6,
        differenceInCalendarDays(startOfDay(item.end), weekStart),
      );
      return {
        item,
        startCol,
        span: endCol - startCol + 1,
        continuesBefore: item.start < weekStart,
        continuesAfter: item.end > weekEnd,
      };
    })
    // Longest first, then earliest, then by key so the order is stable across renders rather
    // than depending on however the server happened to sort.
    .sort(
      (a, b) =>
        b.span - a.span ||
        a.startCol - b.startCol ||
        a.item.key.localeCompare(b.item.key),
    );

  const lanes: boolean[][] = [];
  const segments: Segment<T>[] = [];
  const overflow = Array.from({ length: 7 }, () => 0);

  for (const candidate of visible) {
    const columns = Array.from(
      { length: candidate.span },
      (_, i) => candidate.startCol + i,
    );

    let lane = lanes.findIndex((occupied) =>
      columns.every((col) => !occupied[col]),
    );

    if (lane === -1) {
      lane = lanes.length;
      lanes.push(Array.from({ length: 7 }, () => false));
    }

    for (const col of columns) lanes[lane][col] = true;

    if (lane >= maxLanes) {
      for (const col of columns) overflow[col] += 1;
      continue;
    }

    segments.push({ ...candidate, lane });
  }

  return { days, segments, overflow };
}

/** Splits the 42 grid days into six weeks and lays each one out. */
export function layoutMonth<T extends LayoutItem>(
  month: Date,
  items: T[],
  maxLanes: number,
): WeekLayout<T>[] {
  const days = monthGridDays(month);
  return Array.from({ length: 6 }, (_, week) =>
    layoutWeek(items, days[week * 7], maxLanes),
  );
}

/** Whether a day belongs to the month being shown, as opposed to the padding either side. */
export function isInMonth(day: Date, month: Date): boolean {
  return day >= startOfMonth(month) && day <= endOfMonth(month);
}

export function isToday(day: Date): boolean {
  return isSameDay(day, new Date());
}
