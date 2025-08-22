import {BoardContent} from "@/components/custom/kanban/board-content.tsx";
import {BoardProvider} from "@/components/custom/kanban/board-provider.tsx";
import {KanbanBoardLoader} from "@/components/custom/kanban/kanban-board-loader.tsx";
import {memo} from "react";

export const IssuesBoardPage = memo(function () {
  return (
    <BoardProvider>
      {({team, project, columns, filters, setFilters}) => {
        if (!team || !project || !columns) {
          return <KanbanBoardLoader/>;
        }

        return (
          <BoardContent
            team={team}
            project={project}
            columns={columns}
            filters={filters}
            setFilters={setFilters}
          />
        );
      }}
    </BoardProvider>
  );
});
