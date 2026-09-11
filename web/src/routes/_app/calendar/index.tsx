import {
  IconCalendarMonth,
  IconChevronLeft,
  IconChevronRight,
  IconList,
} from "@tabler/icons-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  addDays,
  addMonths,
  format,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import z from "zod";
import { getCalendarOptions } from "@/api/@tanstack/react-query.gen";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Agenda } from "./-components/agenda";
import { MonthGrid } from "./-components/month-grid";

const MONTH_FORMAT = "yyyy-MM";

const searchSchema = z.object({
  /** The month being shown, as `yyyy-MM`. In the URL so a view survives a reload and a back. */
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  view: z.enum(["month", "agenda"]).optional(),
});

function monthFrom(search?: string): Date {
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
function windowFor(month: Date) {
  const from = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  // Exactly the 42 cells the grid draws, which is also comfortably inside the endpoint's
  // 366-day ceiling.
  return { from, to: addDays(from, 42) };
}

function calendarQuery(month: Date) {
  const { from, to } = windowFor(month);
  return getCalendarOptions({
    query: { from: from.toISOString(), to: to.toISOString() },
  });
}

export const Route = createFileRoute("/_app/calendar/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search: { month } }) => ({ month }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(calendarQuery(monthFrom(deps.month))),
  pendingComponent: CalendarSkeleton,
  component: CalendarPage,
});

function CalendarSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[32rem] w-full rounded-xl" />
    </div>
  );
}

function CalendarPage() {
  const { month: monthParam, view = "month" } = Route.useSearch();
  const month = monthFrom(monthParam);
  const { data: items } = useSuspenseQuery(calendarQuery(month));

  const step = (delta: number) => format(addMonths(month, delta), MONTH_FORMAT);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {format(month, "MMMM yyyy")}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border p-0.5">
            <Link
              to="/calendar"
              search={{ month: monthParam, view: "month" }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
                view === "month"
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <IconCalendarMonth className="size-3.5" />
              Month
            </Link>
            <Link
              to="/calendar"
              search={{ month: monthParam, view: "agenda" }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
                view === "agenda"
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <IconList className="size-3.5" />
              Agenda
            </Link>
          </div>

          {/* Links rather than buttons so paging through months goes in the history, and so the
              loader can prefetch the neighbour on hover. */}
          <div className="flex items-center gap-1">
            <Button asChild variant="outline" size="sm" className="size-8 p-0">
              <Link
                to="/calendar"
                search={{ month: step(-1), view }}
                aria-label="Previous month"
              >
                <IconChevronLeft className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link to="/calendar" search={{ month: undefined, view }}>
                Today
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="size-8 p-0">
              <Link
                to="/calendar"
                search={{ month: step(1), view }}
                aria-label="Next month"
              >
                <IconChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {view === "month" ? (
        <MonthGrid
          month={month}
          items={items}
          empty="Nothing scheduled this month."
        />
      ) : (
        <Agenda items={items} />
      )}

      <p className="px-1 text-xs text-muted-foreground">
        Faded, dashed entries are future occurrences of a repeating task. They
        are worked out from the rule and do not exist yet — the next one is
        created when you complete the current one.
      </p>
    </div>
  );
}
