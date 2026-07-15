import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";
import { getProjectOptions } from "@/api/@tanstack/react-query.gen";
import { flashMessagesStore } from "@/lib/store";
import { ColumnDialog } from "./-components/column-dialog";
import { KanbanBoard } from "./-components/kanban-view/board";
import { ProjectHeader } from "./-components/project-header";
import { ProjectPageSkeleton } from "./-components/project-page-skeleton";
import { TableView } from "./-components/table-view/index";
import { TaskSheet } from "./-components/task-sheet";
import { KanbanToolbar } from "./-components/toolbar";
import { useDragNDrop } from "./-components/use-drag-n-drop";

const searchSchema = z.object({
  view: z.enum(["board", "table"]).catch("board"),
});

export const Route = createFileRoute("/_app/projects/$projectId/")({
  validateSearch: searchSchema,
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
  const { view } = Route.useSearch();

  const { data: project } = useSuspenseQuery(
    getProjectOptions({
      path: { projectId: Number(projectId) },
    }),
  );

  const dndProps = useDragNDrop(project);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TaskSheet project={project} />
      <ColumnDialog project={project} />
      <ProjectHeader project={project} />

      <KanbanToolbar project={project} view={view} />

      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6">
          {view === "table" ? (
            <TableView dndProps={dndProps} project={project} />
          ) : (
            <KanbanBoard dndProps={dndProps} project={project} />
          )}
        </div>
      </div>
    </div>
  );
}
