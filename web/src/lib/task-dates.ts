import { format } from "date-fns";

/**
 * How a task's date is written, given whether its time of day is one a person chose.
 *
 * One function rather than the rule repeated at each of the five places that render a deadline:
 * the board card, the table, the task page, the dashboard list and the Inbox row. They already
 * disagreed on the date format alone; adding "…and the time, but only when there is one" to
 * each of them independently is how the priority helpers ended up as five drifting copies.
 *
 * `hasTime` is not a formatting preference — it is a fact stored beside the instant. Without it
 * every task ever created before times existed would claim to be due at 00:00.
 */
export function formatTaskDate(
  iso: string,
  hasTime: boolean,
  style: "short" | "long" = "short",
): string {
  const date = new Date(iso);
  const day = style === "long" ? "d MMM yyyy" : "MMM d";
  return hasTime ? format(date, `${day}, HH:mm`) : format(date, day);
}
