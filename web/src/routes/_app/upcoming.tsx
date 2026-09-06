import { IconCalendarPlus } from "@tabler/icons-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import {
  countTasks,
  UPCOMING_HORIZON_DAYS,
  upcomingSections,
} from "./-components/task-buckets";
import { TaskList } from "./-components/task-list";
import { TaskListSkeleton } from "./-components/task-list-skeleton";
import {
  userTasksQueryOptions,
  userTasksSearchSchema,
} from "./-components/user-tasks-query";

export const Route = createFileRoute("/_app/upcoming")({
  validateSearch: userTasksSearchSchema,
  loaderDeps: ({ search: { assignedToMe } }) => ({ assignedToMe }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(
      userTasksQueryOptions(deps.assignedToMe),
    ),
  pendingComponent: TaskListSkeleton,
  component: UpcomingPage,
});

function UpcomingPage() {
  const { assignedToMe } = Route.useSearch();
  const { data: tasks } = useSuspenseQuery(userTasksQueryOptions(assignedToMe));

  const sections = upcomingSections(tasks);
  // What this view deliberately leaves out. Surfaced as a link rather than a section, so the
  // page stays "what is coming" while nothing quietly goes missing between the two screens.
  const { overdue, today } = countTasks(tasks);
  const needsAttention = overdue + today;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Upcoming</h1>
        <p className="text-sm text-muted-foreground">
          The next {UPCOMING_HORIZON_DAYS} days, a section per day.
        </p>
      </header>

      <div className="flex items-center justify-between gap-2 px-1">
        {needsAttention > 0 ? (
          <Link
            to="/today"
            search={{ assignedToMe }}
            className="flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline"
          >
            Due now
            <Badge
              variant="secondary"
              className="h-5 px-1.5 font-normal tabular-nums"
            >
              {needsAttention}
            </Badge>
          </Link>
        ) : (
          <h2 className="text-sm font-semibold">Ahead</h2>
        )}

        {/* A Link rather than a toggle button so the choice survives a reload and a
            back-navigation, and so the loader can prefetch the other list. */}
        <Link
          to="/upcoming"
          search={{ assignedToMe: !assignedToMe }}
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {assignedToMe ? "Show all tasks" : "Only mine"}
        </Link>
      </div>

      <TaskList
        sections={sections}
        empty={
          <>
            <IconCalendarPlus className="size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">Nothing scheduled ahead</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              {assignedToMe
                ? "Nothing assigned to you has a due date after today. Switch to All tasks to see everything in your projects."
                : "No task in your projects has a due date after today."}
            </p>
          </>
        }
      />
    </div>
  );
}
