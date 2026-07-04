import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getProjectOptions } from "@/api/@tanstack/react-query.gen";
import { flashMessagesStore } from "@/lib/store";
import { TaskSheet } from "./-components/task-sheet";
import { KanbanBoard } from "./-components/kanban/board";
import { ProjectHeader } from "./-components/project-header";
import { ProjectPageSkeleton } from "./-components/project-page-skeleton";
import { KanbanToolbar } from "./-components/toolbar";

export const Route = createFileRoute("/_app/projects/$projectId/")({
  loader: async ({ params, context }) => {
    return await context.queryClient.ensureQueryData(
      getProjectOptions({
        path: { projectId: Number(params.projectId) },
      }),
    );
  },
  pendingComponent: ProjectPageSkeleton,
  component: SingleProjectPage,
  errorComponent: ({ error }) => {
    useEffect(() => {
      flashMessagesStore.actions.addSingle({
        type: "error",
        message: {
          title: "Error loading project",
          description: error.message,
        },
      });
    }, [error.message]);

    return <Navigate to="/dashboard" />;
  },
});

function SingleProjectPage() {
  const { projectId } = Route.useParams();

  const { data: project } = useSuspenseQuery(
    getProjectOptions({
      path: { projectId: Number(projectId) },
    }),
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TaskSheet project={project} />
      <ProjectHeader project={project} />

      <KanbanToolbar project={project} />

      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6">
          <KanbanBoard project={project} />
        </div>
      </div>
    </div>
  );
}
