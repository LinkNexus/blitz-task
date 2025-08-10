import {AddColumnButton} from "@/components/custom/kanban/add-column-button.tsx";
import {BoardHeader} from "@/components/custom/kanban/board-header.tsx";
import {KanbanColumn} from "@/components/custom/kanban/kanban-column.tsx";
import {TaskCard} from "@/components/custom/kanban/task-card.tsx";
import {TaskModal} from "@/components/custom/kanban/task-modal.tsx";
import {useApiFetch} from "@/hooks/useFetch.ts";
import {useTaskModal} from "@/hooks/useTaskModal.ts";
import {useAppStore} from "@/lib/store.ts";
import {KanbanBoardLoader} from "@/pages/issues-board/kanban-board-loader.tsx";
import type {Task, TaskColumn} from "@/types.ts";
import {DndContext, DragOverlay} from "@dnd-kit/core";
import {memo, useEffect, useState} from "react";
import {toast} from "sonner";
import {apiFetch} from "@/lib/fetch.ts";

export const IssuesBoardPage = memo(function () {
  const {
    activeProjectId,
    teams,
    setColumns,
    moveTaskBetweenColumns,
    reorderTaskInColumn,
  } = useAppStore((state) => state);
  const project = teams
    .flatMap((t) => t.projects)
    .find((p) => p?.id === activeProjectId);
  const columns = project?.columns;

  const [activeTask, setActiveTask] = useState<Task | null>(null);
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

  const {
    isOpen: isTaskModalOpen,
    currentTask,
    defaultColumnId,
    openCreateModal,
    openEditModal,
    closeModal,
  } = useTaskModal();

  const handleTaskEdit = (task: Task) => {
    openEditModal(task);
  };

  const handleAddTaskToColumn = (columnId: number) => {
    openCreateModal(columnId);
  };

  useEffect(() => {
    if (project?.id) {
      fetchColumns({
        searchParams: {
          projectId: project.id,
        },
      });
    }
  }, [project?.id]);

  // Custom function to get tasks for a column since they're now embedded
  const getTasksForColumn = (column: TaskColumn) => {
    return column.tasks?.sort((a, b) => a.score - b.score) || [];
  };

  // Simple drag handlers for now - will implement full functionality later
  const handleDragStart = (event: any) => {
    const {active} = event;
    const taskId = parseInt(active.id.replace("task-", ""));

    // Find the task in any column
    const task = columns
      ?.flatMap((col) => col.tasks || [])
      .find((t) => t.id === taskId);
    setActiveTask(task || null);
  };

  async function handleDragEnd(event: any) {
    const {active, over} = event;
    setActiveTask(null);

    if (!over || !project?.id || !columns) return;

    const activeTaskId = parseInt(active.id.replace("task-", ""));

    // Find source column and task
    let sourceColumn: TaskColumn | undefined;
    let sourceTask: Task | undefined;

    for (const col of columns) {
      const task = col.tasks?.find((t) => t.id === activeTaskId);
      if (task) {
        sourceColumn = col;
        sourceTask = task;
        break;
      }
    }

    if (!sourceColumn || !sourceTask) return;

    // Handle dropping on column (empty area) - add to end
    if (over.id.toString().startsWith("column-")) {
      const targetColumnId = parseInt(
        over.id.toString().replace("column-", ""),
      );

      if (sourceColumn.id !== targetColumnId) {
        // Move to different column at the end
        const targetColumn = columns.find((col) => col.id === targetColumnId);
        if (targetColumn) {
          // Get the highest score in target column and add 1000
          const maxScore =
            targetColumn.tasks?.length > 0
              ? Math.max(...targetColumn.tasks.map((t) => t.score || 0))
              : 0;
          const newScore = maxScore + 100;

          moveTaskBetweenColumns(
            project.id,
            activeTaskId,
            sourceColumn.id,
            targetColumnId,
            newScore,
          );
        }
      }
      return;
    }

    // Handle dropping on task (specific position)
    if (over.id.toString().startsWith("task-")) {
      const overTaskId = parseInt(over.id.toString().replace("task-", ""));

      // Don't do anything if dropping on the same task
      if (activeTaskId === overTaskId) return;

      // Find the target task's column
      let targetColumn: TaskColumn | undefined;
      let targetTask: Task | undefined;

      for (const col of columns) {
        const task = col.tasks?.find((t) => t.id === overTaskId);
        if (task) {
          targetColumn = col;
          targetTask = task;
          break;
        }
      }

      if (!targetColumn || !targetTask) return;

      if (sourceColumn.id === targetColumn.id) {
        // Reordering within same column
        const columnTasks = getTasksForColumn(targetColumn).sort((a, b) => b.score - a.score);
        const sourceIndex = columnTasks.findIndex((t) => t.id === activeTaskId);
        const targetIndex = columnTasks.findIndex((t) => t.id === overTaskId);

        if (sourceIndex === targetIndex) return;

        // Calculate new score based on drop position
        let newScore: number;

        if (sourceIndex < targetIndex) {
          // Moving down: insert after target task
          const nextTaskIndex = targetIndex + 1;
          if (nextTaskIndex < columnTasks.length) {
            // Insert between target and next task
            newScore = (targetTask.score + columnTasks[nextTaskIndex].score) / 2;
          } else {
            // Insert at the end
            newScore = targetTask.score - 100;
          }
        } else {
          // Moving up: insert before target task
          const prevTaskIndex = targetIndex - 1;
          if (prevTaskIndex >= 0) {
            // Insert between previous and target task
            newScore = (columnTasks[prevTaskIndex].score + targetTask.score) / 2;
          } else {
            // Insert at the beginning
            newScore = targetTask.score + 100;
          }
        }

        reorderTaskInColumn(
          project.id,
          sourceColumn.id,
          activeTaskId,
          newScore,
        );

        await apiFetch(`/api/tasks/move?projectId=${project.id}`, {
          data: columnTasks.map(t => ({
              id: t.id,
              score: t.id === activeTaskId ? newScore : t.score
            })
          )
        });
      } else {
        // Moving to different column at specific position
        const targetColumnTasks = getTasksForColumn(targetColumn);
        const targetIndex = targetColumnTasks.findIndex(
          (t) => t.id === overTaskId,
        );

        // Calculate score to insert before the target task
        let newScore: number;

        if (targetIndex === 0) {
          // Inserting at the beginning
          newScore = targetTask.score / 2;
        } else {
          // Inserting between tasks
          const prevTask = targetColumnTasks[targetIndex - 1];
          newScore = (prevTask.score + targetTask.score) / 2;
        }

        moveTaskBetweenColumns(
          project.id,
          activeTaskId,
          sourceColumn.id,
          targetColumn.id,
          newScore,
        );
      }
    }
  }

  const handleFilter = () => {
    // TODO: Implement filter functionality
    console.log("Filter clicked");
  };

  const handleAddColumnBetween = (afterColumnId: number) => {
    // TODO: Implement add column between functionality
    console.log("Add column after:", afterColumnId);
  };

  // TODO: Implement these handlers when needed
  // const handleTaskEdit = (taskId: number) => {
  //   console.log("Edit task:", taskId);
  // };

  // const handleTaskDelete = (taskId: number) => {
  //   deleteTask(taskId);
  // };

  if (!project || !columns) {
    return <KanbanBoardLoader/>;
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-4 sm:space-y-6">
        <BoardHeader
          onAddTask={() => {
            const firstColumn = columns?.[0];
            if (firstColumn) {
              openCreateModal(firstColumn.id);
            }
          }}
          onFilter={handleFilter}
        />

        {/* Kanban Board */}
        <div className="flex gap-3 sm:gap-6 min-h-[500px] sm:min-h-[600px] overflow-x-auto pb-4">
          {[...columns]
            .sort((a, b) => a.score - b.score)
            .map((column) => {
              const tasks = getTasksForColumn(column);
              return (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  tasks={tasks}
                  onAddColumnBetween={handleAddColumnBetween}
                  onTaskEdit={handleTaskEdit}
                  onAddTask={handleAddTaskToColumn}
                />
              );
            })}

          <AddColumnButton/>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeTask && (
          <div className="rotate-3 opacity-90">
            <TaskCard
              task={activeTask}
              columnName={
                columns?.find((col) =>
                  col.tasks?.some((t) => t.id === activeTask.id),
                )?.name
              }
            />
          </div>
        )}
      </DragOverlay>

      {/* Task Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={closeModal}
        task={currentTask}
        columns={columns || []}
        defaultColumnId={defaultColumnId}
      />
    </DndContext>
  );
});
