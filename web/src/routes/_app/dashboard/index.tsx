import { IconChecklist } from "@tabler/icons-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { listProjectsOptions } from "@/api/@tanstack/react-query.gen";
import { useAccount } from "@/hooks/use-current-user";
import {
  countTasks,
  groupByDueSection,
} from "@/routes/_app/-components/task-buckets";
import { TaskList } from "@/routes/_app/-components/task-list";
import {
  userTasksQueryOptions,
  userTasksSearchSchema,
} from "@/routes/_app/-components/user-tasks-query";
import { DashboardSkeleton } from "./-components/dashboard-skeleton";
import { ProjectsPanel } from "./-components/projects-panel";
import { StatTiles } from "./-components/stat-tiles";

export const Route = createFileRoute("/_app/dashboard/")({
  validateSearch: userTasksSearchSchema,
  loaderDeps: ({ search: { assignedToMe } }) => ({ assignedToMe }),
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(listProjectsOptions()),
      context.queryClient.ensureQueryData(
        userTasksQueryOptions(deps.assignedToMe),
      ),
    ]);
  },
  pendingComponent: DashboardSkeleton,
  component: DashboardPage,
});

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function DashboardPage() {
  const { assignedToMe } = Route.useSearch();
  const { user } = useAccount();

  const { data: projects } = useSuspenseQuery(listProjectsOptions());
  const { data: tasks } = useSuspenseQuery(userTasksQueryOptions(assignedToMe));

  const counts = countTasks(tasks);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting()}, {user.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </header>

      <StatTiles counts={counts} projectCount={projects.length} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <h2 className="text-sm font-semibold">Up next</h2>
            {/* A Link rather than a toggle button so the choice survives a reload and a
                back-navigation, and so the loader can prefetch the other list. */}
            <Link
              to="/dashboard"
              search={{ assignedToMe: !assignedToMe }}
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {assignedToMe ? "Show all tasks" : "Only mine"}
            </Link>
          </div>

          <TaskList
            sections={groupByDueSection(tasks)}
            empty={
              <>
                <IconChecklist className="size-8 text-muted-foreground/50" />
                <p className="text-sm font-medium">Nothing open</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  {assignedToMe
                    ? "No open tasks are assigned to you. Switch to All tasks to see everything in your projects."
                    : "Every task in your projects is in its final column."}
                </p>
              </>
            }
          />
        </div>

        <ProjectsPanel projects={projects} />
      </div>
    </div>
  );
}
