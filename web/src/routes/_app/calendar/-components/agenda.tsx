import { IconCalendarDue, IconRepeat } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { format, isSameDay } from "date-fns";
import type { CalendarItem } from "@/api";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  getPriorityIcon,
  getPriorityPillClass,
} from "@/routes/_app/projects/$projectId/-components/kanban-view/lib";
import { isToday } from "./calendar-layout";

/**
 * The same window as the month grid, read as a list.
 *
 * It does **not** reuse `TaskList`: that renders `UserTaskSummary`, and half of what a calendar
 * shows is a projected occurrence with no id, no column and no row behind it. Passing those
 * through a component built for real tasks would mean either lying about their shape or teaching
 * the dashboard's row about something only the calendar has.
 */
export function Agenda({ items }: { items: CalendarItem[] }) {
  if (items.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-10 text-center">
        <IconCalendarDue className="size-8 text-muted-foreground/50" />
        <p className="text-sm font-medium">Nothing scheduled this month</p>
        <p className="text-sm text-muted-foreground">
          Tasks with a due date show up here.
        </p>
      </Card>
    );
  }

  // Already ordered by date from the server; grouping is just a walk.
  const days: { date: Date; items: CalendarItem[] }[] = [];
  for (const item of items) {
    const date = new Date(item.dueDate);
    const last = days.at(-1);
    if (last && isSameDay(last.date, date)) last.items.push(item);
    else days.push({ date, items: [item] });
  }

  return (
    <div className="space-y-5">
      {days.map((day) => (
        <section key={day.date.toISOString()}>
          <h3
            className={cn(
              "mb-1.5 flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-wide",
              isToday(day.date)
                ? "text-orange-600 dark:text-orange-400"
                : "text-muted-foreground",
            )}
          >
            {format(day.date, "EEEE d MMMM")}
            <Badge
              variant="secondary"
              className="h-5 px-1.5 font-normal tabular-nums"
            >
              {day.items.length}
            </Badge>
          </h3>

          <div className="space-y-0.5">
            {day.items.map((item) => (
              <AgendaRow
                key={`${item.taskId ?? `p${item.sourceTaskId}`}-${item.dueDate}`}
                item={item}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const ROW_CLASS =
  "flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors";

function AgendaRow({ item }: { item: CalendarItem }) {
  const body = (
    <>
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: item.columnColor }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium",
            item.isCompleted && "text-muted-foreground line-through",
          )}
        >
          {item.name}
        </p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{item.projectName}</span>
          {item.isProjected && (
            <>
              <span aria-hidden>·</span>
              <span className="flex items-center gap-1">
                <IconRepeat className="size-3" />
                not created yet
              </span>
            </>
          )}
        </div>
      </div>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
          getPriorityPillClass(item.priority),
        )}
      >
        {getPriorityIcon(item.priority)}
        {item.priority.charAt(0) + item.priority.slice(1).toLowerCase()}
      </span>
    </>
  );

  // A projected occurrence is arithmetic, not a task: there is nothing to open.
  if (item.isProjected) {
    return <div className={cn(ROW_CLASS, "opacity-70")}>{body}</div>;
  }

  const interactive = cn(ROW_CLASS, "hover:border-border hover:bg-muted/50");

  return item.isInbox ? (
    <Link to="/inbox" className={interactive}>
      {body}
    </Link>
  ) : (
    <Link
      to="/projects/$projectId"
      params={{ projectId: String(item.projectId) }}
      className={interactive}
    >
      {body}
    </Link>
  );
}
