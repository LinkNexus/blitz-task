import { AddColumnButton } from "@/components/custom/kanban/add-column-button.tsx";
import { BoardHeader } from "@/components/custom/kanban/board-header.tsx";
import { KanbanColumn } from "@/components/custom/kanban/kanban-column.tsx";
import { TaskCard } from "@/components/custom/kanban/task-card.tsx";
import { TaskModal } from "@/components/custom/kanban/task-modal.tsx";
import { useTaskModal } from "@/hooks/useTaskModal.ts";
import { apiFetch } from "@/lib/fetch.ts";
import { mockLabels, mockUsers } from "@/lib/mock-data.ts";
import { useAppStore } from "@/lib/store.ts";
import { KanbanBoardLoader } from "@/pages/issues-board/kanban-board-loader.tsx";
import type { Task, TaskColumn } from "@/types.ts";
import { closestCenter, DndContext, DragOverlay } from "@dnd-kit/core";
import { memo, useEffect, useState } from "react";

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
    if (project?.id && !columns) {
      apiFetch<TaskColumn[]>(`/api/columns?projectId=${project.id}`)
        .then((columns) => {
          setColumns(project.id, columns);
        })
        .catch((error) => {
          console.error("Failed to fetch columns:", error);
        });
    }
  }, [project?.id, columns, setColumns]);

  // Custom function to get tasks for a column since they're now embedded
  const getTasksForColumn = (column: TaskColumn) => {
    return column.tasks?.sort((a, b) => a.position - b.position) || [];
  };

  // Simple drag handlers for now - will implement full functionality later
  const handleDragStart = (event: any) => {
    const { active } = event;
    const taskId = parseInt(active.id.replace("task-", ""));

    // Find the task in any column
    const task = columns
      ?.flatMap((col) => col.tasks || [])
      .find((t) => t.id === taskId);
    setActiveTask(task || null);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
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

    // Handle dropping on column
    if (over.id.toString().startsWith("column-")) {
      const targetColumnId = parseInt(
        over.id.toString().replace("column-", "")
      );

      if (sourceColumn.id !== targetColumnId) {
        // Move to different column
        const targetColumn = columns.find((col) => col.id === targetColumnId);
        if (targetColumn) {
          const newPosition = targetColumn.tasks?.length || 0;
          moveTaskBetweenColumns(
            project.id,
            activeTaskId,
            sourceColumn.id,
            targetColumnId,
            newPosition
          );
        }
      }
    }

    // Handle dropping on task (reordering)
    if (over.id.toString().startsWith("task-")) {
      const overTaskId = parseInt(over.id.toString().replace("task-", ""));

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
        const columnTasks = targetColumn.tasks || [];
        const sourceIndex = columnTasks.findIndex((t) => t.id === activeTaskId);
        const targetIndex = columnTasks.findIndex((t) => t.id === overTaskId);

        if (sourceIndex !== targetIndex) {
          // Update the position to match target position
          reorderTaskInColumn(
            project.id,
            sourceColumn.id,
            activeTaskId,
            targetTask.position
          );
        }
      } else {
        // Moving to different column at specific position
        moveTaskBetweenColumns(
          project.id,
          activeTaskId,
          sourceColumn.id,
          targetColumn.id,
          targetTask.position
        );
      }
    }
  };

  const handleAddTask = () => {
    // Open create task modal with first column as default
    const firstColumn = columns?.[0];
    if (firstColumn) {
      openCreateModal(firstColumn.id);
    }
  };

  // Handle task created/updated from modal
  const handleTaskCreated = (_task: Task) => {
    // Refresh columns to get updated data
    if (project?.id) {
      apiFetch<TaskColumn[]>(`/api/columns?projectId=${project.id}`)
        .then((columns) => {
          setColumns(project.id, columns);
        })
        .catch((error) => {
          console.error("Failed to refresh columns:", error);
        });
    }
  };

  const handleTaskUpdated = (_task: Task) => {
    // Refresh columns to get updated data
    if (project?.id) {
      apiFetch<TaskColumn[]>(`/api/columns?projectId=${project.id}`)
        .then((columns) => {
          setColumns(project.id, columns);
        })
        .catch((error) => {
          console.error("Failed to refresh columns:", error);
        });
    }
  };

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
    return <KanbanBoardLoader />;
  }

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      collisionDetection={closestCenter}
    >
      <div className="space-y-4 sm:space-y-6">
        <BoardHeader onAddTask={handleAddTask} onFilter={handleFilter} />

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

          <AddColumnButton />
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
                  col.tasks?.some((t) => t.id === activeTask.id)
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
        onTaskCreated={handleTaskCreated}
        onTaskUpdated={handleTaskUpdated}
        task={currentTask}
        columns={columns || []}
        users={mockUsers}
        labels={mockLabels}
        defaultColumnId={defaultColumnId}
      />
    </DndContext>
  );
});
