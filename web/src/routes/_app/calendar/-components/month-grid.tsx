import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import type { ReactNode } from "react";
import type { CalendarItem } from "@/api";
import { cn } from "@/lib/utils";
import {
  isInMonth,
  isToday,
  type LayoutItem,
  layoutMonth,
  type Segment,
} from "./calendar-layout";

/**
 * Three bars per cell. A month cell is a few dozen pixels tall; letting a busy Tuesday grow to
 * fit eleven tasks turns the grid into a list with gaps in it.
 */
const MAX_LANES = 3;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type CalendarLayoutItem = LayoutItem & { item: CalendarItem };

/**
 * A projected occurrence has no id, so it cannot be keyed by one — and two occurrences of the
 * same series differ only by date.
 */
export function toLayoutItems(items: CalendarItem[]): CalendarLayoutItem[] {
  return items.map((item) => ({
    key: `${item.taskId ?? `p${item.sourceTaskId}`}-${item.dueDate}`,
    // A task with no start date is a point on its due date rather than a span.
    start: new Date(item.startDate ?? item.dueDate),
    end: new Date(item.dueDate),
    item,
  }));
}

function ItemBar({ segment }: { segment: Segment<CalendarLayoutItem> }) {
  const { item } = segment.item;

  const body = (
    <>
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: item.columnColor }}
        aria-hidden
      />
      <span className="truncate">{item.name}</span>
    </>
  );

  const className = cn(
    "flex h-5 items-center gap-1.5 overflow-hidden px-1.5 text-[11px] leading-none",
    "border transition-colors",
    segment.continuesBefore ? "rounded-l-none border-l-0" : "rounded-l-md",
    segment.continuesAfter ? "rounded-r-none border-r-0" : "rounded-r-md",
    item.isCompleted && "text-muted-foreground line-through",
    item.isProjected
      ? // Not a row: it cannot be opened, completed or rescheduled, so it must not look like
        // something that can. Dashed and faded, and rendered as a span rather than a link.
        "cursor-default border-dashed border-border/70 bg-transparent text-muted-foreground/80"
      : "border-border bg-card hover:border-primary/40 hover:bg-muted",
  );

  if (item.isProjected) {
    return (
      <span
        className={className}
        title={`${item.name} — repeats, not created yet`}
      >
        {body}
      </span>
    );
  }

  // Same destination rule as the dashboard's rows: a capture belongs to the Inbox, not to the
  // board the Inbox happens to need.
  return item.isInbox ? (
    <Link to="/inbox" className={className} title={item.name}>
      {body}
    </Link>
  ) : (
    <Link
      to="/projects/$projectId"
      params={{ projectId: String(item.projectId) }}
      className={className}
      title={`${item.name} — ${item.projectName}`}
    >
      {body}
    </Link>
  );
}

export function MonthGrid({
  month,
  items,
  empty,
}: {
  month: Date;
  items: CalendarItem[];
  empty?: ReactNode;
}) {
  const weeks = layoutMonth(month, toLayoutItems(items), MAX_LANES);

  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {weeks.map((week) => (
        <div
          key={week.days[0].toISOString()}
          className="relative grid grid-cols-7 border-b last:border-b-0"
        >
          {week.days.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                // Tall enough for the overlay it does not contain: the bars are absolutely
                // positioned, so they cannot push this cell taller, and 2rem of day number plus
                // three 1.5rem lanes plus the overflow line has to fit inside 8rem or it spills
                // into next week's row.
                "min-h-32 border-r p-1 last:border-r-0",
                !isInMonth(day, month) && "bg-muted/30",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                  isInMonth(day, month)
                    ? "text-foreground"
                    : "text-muted-foreground/60",
                  isToday(day) &&
                    "bg-primary font-semibold text-primary-foreground",
                )}
              >
                {format(day, "d")}
              </span>
            </div>
          ))}

          {/* The bars live in their own grid laid over the cells, because a span has to cross
              cell boundaries — nesting them inside a day would cap them at one column. */}
          <div className="pointer-events-none absolute inset-x-0 top-8 grid grid-cols-7 gap-y-1 px-1">
            {week.segments.map((segment) => (
              <div
                key={segment.item.key}
                className="pointer-events-auto min-w-0"
                style={{
                  gridColumn: `${segment.startCol + 1} / span ${segment.span}`,
                  gridRow: segment.lane + 1,
                }}
              >
                <ItemBar segment={segment} />
              </div>
            ))}

            {week.overflow.map((count, col) =>
              count > 0 ? (
                <div
                  key={week.days[col].toISOString()}
                  className="px-1 text-[10px] text-muted-foreground"
                  style={{ gridColumn: col + 1, gridRow: MAX_LANES + 1 }}
                >
                  +{count} more
                </div>
              ) : null,
            )}
          </div>
        </div>
      ))}

      {items.length === 0 && empty && (
        <div className="border-t p-6 text-center text-sm text-muted-foreground">
          {empty}
        </div>
      )}
    </div>
  );
}
