import { AddColumnButton } from "@/components/custom/kanban/columns/add-column-button.tsx";
import { ColumnModal } from "@/components/custom/kanban/columns/column-modal.tsx";
import { KanbanColumn } from "@/components/custom/kanban/columns/kanban-column.tsx";
import { useColumnModal } from "@/hooks/useColumnModal.ts";
import type { Project, Task, TaskColumn } from "@/types.ts";
import { useState } from "react";

interface KanbanBoardProps {
  columns: TaskColumn[];
  project: Project;
  getFilteredTasksForColumn: (column: TaskColumn) => Task[];
  onAddTask: (columnId: number) => void;
  onEditTask: (task: Task) => void;
  onViewTask?: (taskId: number) => void;
}

export function KanbanBoard({
  columns,
  project,
  getFilteredTasksForColumn,
  onAddTask,
  onEditTask,
  onViewTask,
}: KanbanBoardProps) {
  const [columnScore, setColumnScore] = useState(0);

  const {
    isColumnModalOpen,
    currentColumn,
    openCreateColumnModal,
    openEditColumnModal,
    closeColumnModal
  } = useColumnModal();

  return (
    <>
      {/* Kanban Board */}
      <div className="flex gap-3 sm:gap-6 min-h-[500px] sm:min-h-[600px] overflow-x-auto pb-4">
        {[...columns]
          .sort((a, b) => a.score - b.score)
          .map((column, index) => {
            const tasks = getFilteredTasksForColumn(column);
            return (
              <KanbanColumn
                key={column.id}
                project={project}
                column={column}
                tasks={tasks}
                onAddColumnBetween={(position) => {
                  if (position === "before") {
                    if (index > 0) {
                      setColumnScore((columns[index].score + columns[index - 1].score) / 2);
                    } else {
                      setColumnScore(columns[index].score - 500);
                    }
                  } else {
                    if (index < columns.length - 1) {
                      setColumnScore((columns[index].score + columns[index + 1].score) / 2);
                    } else {
                      setColumnScore(columns[index].score + 500);
                    }
                  }
                  openCreateColumnModal();
                }}
                onTaskEdit={onEditTask}
                onTaskView={onViewTask}
                onAddTask={onAddTask}
                onColumnEdit={openEditColumnModal}
              />
            );
          })}
        <AddColumnButton onClick={() => {
          setColumnScore(Math.max(0, ...columns.map(c => c.score)) + 500);
          openCreateColumnModal();
        }}/>
      </div>

      {/* Column Modal */}
      <ColumnModal
        isOpen={isColumnModalOpen}
        onClose={closeColumnModal}
        column={currentColumn}
        score={columnScore}
        project={project}
      />
    </>
  );
}
