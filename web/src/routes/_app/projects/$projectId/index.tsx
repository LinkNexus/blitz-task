import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import {
  DEFAULT_TOOLBAR_STATE,
  type ToolbarState,
} from "./-components/toolbar-filters";
import { useDragNDrop } from "./-components/use-drag-n-drop";

const searchSchema = z.object({
  // `default` keeps `view` optional for callers that just want to land on the
  // project (they get the board); `catch` still coerces a malformed ?view= back
  // to a valid one instead of throwing.
  view: z.enum(["board", "table"]).default("board").catch("board"),
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

  const [toolbarState, setToolbarState] = useState<ToolbarState>(
    DEFAULT_TOOLBAR_STATE,
  );
  const dndProps = useDragNDrop(project, toolbarState);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TaskSheet project={project} />
      <ColumnDialog project={project} />
      <ProjectHeader project={project} />

      <KanbanToolbar
        project={project}
        view={view}
        state={toolbarState}
        onStateChange={setToolbarState}
      />

      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6">
          {view === "table" ? (
            <TableView
              dndProps={dndProps}
              project={project}
              groupBy={toolbarState.groupBy}
            />
          ) : (
            <KanbanBoard dndProps={dndProps} project={project} />
          )}
        </div>
      </div>
    </div>
  );
}
