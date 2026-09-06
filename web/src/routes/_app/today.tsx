import { IconChecklist } from "@tabler/icons-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { todaySections } from "./-components/task-buckets";
import { TaskList } from "./-components/task-list";
import { TaskListSkeleton } from "./-components/task-list-skeleton";
import {
  userTasksQueryOptions,
  userTasksSearchSchema,
} from "./-components/user-tasks-query";

export const Route = createFileRoute("/_app/today")({
  validateSearch: userTasksSearchSchema,
  loaderDeps: ({ search: { assignedToMe } }) => ({ assignedToMe }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(
      userTasksQueryOptions(deps.assignedToMe),
    ),
  pendingComponent: TaskListSkeleton,
  component: TodayPage,
});

function TodayPage() {
  const { assignedToMe } = Route.useSearch();
  const { data: tasks } = useSuspenseQuery(userTasksQueryOptions(assignedToMe));

  const sections = todaySections(tasks);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </header>

      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-sm font-semibold">Due now</h2>
        {/* A Link rather than a toggle button so the choice survives a reload and a
            back-navigation, and so the loader can prefetch the other list. */}
        <Link
          to="/today"
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
            <IconChecklist className="size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">Nothing due today</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              {assignedToMe
                ? "Nothing assigned to you is late or due today. Switch to All tasks to see everything in your projects."
                : "Nothing is late or due today."}{" "}
              <Link
                to="/upcoming"
                search={{ assignedToMe }}
                className="underline underline-offset-4 hover:text-foreground"
              >
                See what's coming
              </Link>
              .
            </p>
          </>
        }
      />
    </div>
  );
}
