import { useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Navigate,
  stripSearchParams,
  useNavigate,
} from "@tanstack/react-router";
import { useCallback, useEffect, useMemo } from "react";
import { getProjectOptions } from "@/api/@tanstack/react-query.gen";
import { flashMessagesStore } from "@/lib/store";
import { ColumnDialog } from "./-components/column-dialog";
import { KanbanBoard } from "./-components/kanban-view/board";
import { ProjectHeader } from "./-components/project-header";
import { ProjectPageSkeleton } from "./-components/project-page-skeleton";
import { TableView } from "./-components/table-view/index";
import { TaskSheet } from "./-components/task-sheet";
import { KanbanToolbar } from "./-components/toolbar";
import type { ToolbarState } from "./-components/toolbar-filters";
import { useDragNDrop } from "./-components/use-drag-n-drop";
import {
  BOARD_SEARCH_DEFAULTS,
  boardSearchSchema,
  searchFromToolbarState,
  toolbarStateFromSearch,
} from "./-components/view-search";

export const Route = createFileRoute("/_app/projects/$projectId/")({
  validateSearch: boardSearchSchema,
  // Without this the router writes the *validated* search back to the URL, defaults and all, so
  // every link to a board came out as `?view=board&q=&priority=%5B%5D&due=%5B%5D&…&sort=null`.
  // It still worked — it is just the whole state spelled out — but a filter set is meant to be
  // shareable, and that is the link someone would be pasting.
  search: { middlewares: [stripSearchParams(BOARD_SEARCH_DEFAULTS)] },
  // A different project is a different page, so give it a fresh component instance. Only the
  // param changes when you navigate between two projects, and React keeps the same instance
  // alive, so every piece of state below this point silently carries over — the settings
  // sheet's form reads `defaultValues` once and would keep showing the project you opened
  // first. The toolbar's filters used to be the worst of these and no longer are: they live in
  // the URL now, and a link to another project carries no search, so they reset on their own.
  remountDeps: ({ params }) => params.projectId,
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
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { view } = search;

  const { data: project } = useSuspenseQuery(
    getProjectOptions({
      path: { projectId: Number(projectId) },
    }),
  );

  // Memoised on the search object, which TanStack keeps referentially stable across renders
  // that did not change it. Rebuilding the state inline would hand `useDragNDrop` a new
  // `ToolbarState` — and new `Set`s — every render, re-running the filter and sort of every
  // task in the project on each keystroke elsewhere on the page.
  const toolbarState = useMemo(() => toolbarStateFromSearch(search), [search]);

  // The URL is the state, so a toolbar change is a navigation. `replace` because the filters
  // are one continuous adjustment rather than a series of places to go back to — without it,
  // typing eight characters into the search box would put eight entries in the history and
  // leave Back walking them one keystroke at a time.
  const setToolbarState = useCallback(
    (update: ToolbarState | ((previous: ToolbarState) => ToolbarState)) => {
      const next =
        typeof update === "function"
          ? update(toolbarStateFromSearch(search))
          : update;

      navigate({
        to: "/projects/$projectId",
        params: { projectId },
        search: searchFromToolbarState(next, search.view),
        replace: true,
      });
    },
    [navigate, projectId, search],
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
