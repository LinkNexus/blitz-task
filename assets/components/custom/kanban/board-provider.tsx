import type {BoardFilters} from "@/components/custom/kanban/board-header.tsx";
import {useApiFetch} from "@/hooks/useApiFetch.ts";
import {useAppStore} from "@/lib/store.ts";
import type {Project, TaskColumn, Team} from "@/types.ts";
import {useEffect, useState} from "react";
import {toast} from "sonner";
import {KanbanBoardLoader} from "@/components/custom/kanban/kanban-board-loader.tsx";

interface BoardProviderProps {
  children: (props: {
    team: Team;
    project: Project;
    columns: TaskColumn[];
    filters: BoardFilters;
    setFilters: (filters: BoardFilters) => void;
  }) => React.ReactNode;
}

export function BoardProvider({children}: BoardProviderProps) {
  const {
    activeTeamId,
    activeProjectId,
    teams,
    setColumns,
  } = useAppStore((state) => state);

  const [filters, setFilters] = useState<BoardFilters>({
    search: "",
    assignees: [],
    labels: [],
    priorities: [],
    dueDateFrom: undefined,
    dueDateTo: undefined,
  });

  const team = teams.find(t => t.id === activeTeamId);
  const project = teams
    .flatMap((t) => t.projects)
    .find((p) => p?.id === activeProjectId);

  const columns = project?.columns;

  const {callback: fetchColumns} = useApiFetch(
    "/api/columns",
    {
      onSuccess(cols: TaskColumn[]) {
        if (project) {
          setColumns(project.id, cols);
        }
      },
      onError(err) {
        console.error("Failed to fetch columns:", err);
        toast.error("An error occurred when fetching the tasks");
      },
    },
    [project, setColumns],
  );

  useEffect(() => {
    if (project?.id && !project.columns) {
      fetchColumns({
        searchParams: {
          projectId: project.id,
        },
      });
    }
  }, [project?.id, fetchColumns]);

  if (!team || !project || !columns) {
    return <KanbanBoardLoader/>; // Return null to indicate loading state
  }

  return (
    <>
      {children({
        team,
        project,
        columns,
        filters,
        setFilters,
      })}
    </>
  );
}
