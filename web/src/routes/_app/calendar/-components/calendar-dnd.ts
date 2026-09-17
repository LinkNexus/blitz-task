import { addDays, differenceInCalendarDays, format, parse } from "date-fns";

const DAY_ID_FORMAT = "yyyy-MM-dd";

/** A day cell, as a drop target. */
export const dayDndId = (day: Date) => `day:${format(day, DAY_ID_FORMAT)}`;

/**
 * A bar, as a draggable.
 *
 * Keyed by the week it is drawn in as well as the item, because a span crossing a week boundary
 * is drawn as **two** bars — one per row — and dnd-kit's registry is global, so the two segments
 * of one task would otherwise register the same id twice.
 */
export const barDndId = (itemKey: string, weekStart: Date) =>
  `bar:${itemKey}@${format(weekStart, DAY_ID_FORMAT)}`;

/** The day a drop landed on, or null if the drag ended somewhere that is not a day. */
export function dayFromDndId(dndId: unknown): Date | null {
  if (typeof dndId !== "string" || !dndId.startsWith("day:")) return null;
  const day = parse(dndId.slice(4), DAY_ID_FORMAT, new Date());
  return Number.isNaN(day.getTime()) ? null : day;
}

/**
 * Where a task's deadline lands when its bar is dropped on `day`.
 *
 * The arithmetic is local and stays on this side of the wire. A drop means a day the user can
 * see, and turning one into an instant needs a timezone the server does not have — there is no
 * user timezone column, and L25.5 got by without one by keeping reminders relative. So the
 * client resolves the day and sends the instant.
 *
 * It **shifts** the existing date by whole calendar days rather than rebuilding one from the
 * target day, which is what preserves the time of day: a 5pm deadline dropped on Friday is due
 * at 5pm on Friday, not at midnight. `addDays` is calendar-day arithmetic rather than
 * 24-hour arithmetic, so that still holds across a DST boundary.
 */
export function rescheduledDueDate(dueDate: Date, day: Date): Date {
  return addDays(dueDate, differenceInCalendarDays(day, dueDate));
}
