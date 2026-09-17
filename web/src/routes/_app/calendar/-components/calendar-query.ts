import { addDays, parse, startOfMonth, startOfWeek } from "date-fns";
import { getCalendarOptions } from "@/api/@tanstack/react-query.gen";

export const MONTH_FORMAT = "yyyy-MM";

/** The month a `?month=yyyy-MM` search param names, or this one when it names nothing usable. */
export function monthFrom(search?: string): Date {
  if (!search) return startOfMonth(new Date());
  const parsed = parse(search, MONTH_FORMAT, new Date());
  return Number.isNaN(parsed.getTime()) ? startOfMonth(new Date()) : parsed;
}

/**
 * The window the grid actually draws, which is not the month.
 *
 * A month grid always renders six weeks, so its first and last cells belong to the neighbouring
 * months — fetching only the month itself leaves those cells wrongly empty. Asking for the grid's
 * own range is what makes the padding days true rather than blank.
 */
export function windowFor(month: Date) {
  const from = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  // Exactly the 42 cells the grid draws, which is also comfortably inside the endpoint's
  // 366-day ceiling.
  return { from, to: addDays(from, 42) };
}

/**
 * One definition of the calendar's query, shared by the route that reads it and the reschedule
 * that writes into it.
 *
 * A drop has to reach the exact cache entry the grid is rendering, and the entry is keyed by the
 * window — so a second copy of `windowFor` would not merely duplicate the arithmetic, it would
 * miss the cache by a week and leave the bar sitting where it was dropped from.
 */
export function calendarQuery(month: Date) {
  const { from, to } = windowFor(month);
  return getCalendarOptions({
    query: { from: from.toISOString(), to: to.toISOString() },
  });
}
