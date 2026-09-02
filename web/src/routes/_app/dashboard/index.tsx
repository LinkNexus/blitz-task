import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import {
  listProjectsOptions,
  listUserTasksOptions,
} from "@/api/@tanstack/react-query.gen";
import { useAccount } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "./-components/dashboard-skeleton";
import { ProjectsPanel } from "./-components/projects-panel";
import { StatTiles } from "./-components/stat-tiles";
import { countTasks } from "./-components/task-buckets";
import { TaskList } from "./-components/task-list";

/**
 * The dashboard reads every open task rather than a page of them, because the stat tiles are
 * counts and a truncated page would quietly under-report them. The cap is the endpoint's own
 * ceiling; past it the tiles would understate, which ROADMAP L51 fixes with server-side counts.
 */
const TASK_LIMIT = 200;

const searchSchema = z.object({
  // Most tasks in a solo project have no assignee at all, so defaulting to "assigned to me"
  // would show an empty dashboard to the app's main use case. Opt in instead.
  assignedToMe: z.boolean().default(false).catch(false),
});

const taskQueryOptions = (assignedToMe: boolean) =>
  listUserTasksOptions({
    query: { assignedToMe, limit: TASK_LIMIT },
  });

export const Route = createFileRoute("/_app/dashboard/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search: { assignedToMe } }) => ({ assignedToMe }),
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(listProjectsOptions()),
      context.queryClient.ensureQueryData(taskQueryOptions(deps.assignedToMe)),
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
  const { data: tasks } = useSuspenseQuery(taskQueryOptions(assignedToMe));

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

          <TaskList tasks={tasks} assignedToMe={assignedToMe} />
        </div>

        <ProjectsPanel projects={projects} />
      </div>
    </div>
  );
}
