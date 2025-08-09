import {AddColumnButton} from "@/components/custom/kanban/add-column-button.tsx";
import {BoardHeader} from "@/components/custom/kanban/board-header.tsx";
import {KanbanColumn} from "@/components/custom/kanban/kanban-column.tsx";
import {TaskCard} from "@/components/custom/kanban/task-card.tsx";
import {TaskModal} from "@/components/custom/kanban/task-modal.tsx";
import {useTaskModal} from "@/hooks/useTaskModal.ts";
import {apiFetch} from "@/lib/fetch.ts";
import {useAppStore} from "@/lib/store.ts";
import {KanbanBoardLoader} from "@/pages/issues-board/kanban-board-loader.tsx";
import type {Task, TaskColumn} from "@/types.ts";
import {closestCenter, DndContext, DragOverlay} from "@dnd-kit/core";
import {memo, useEffect, useState} from "react";

export const IssuesBoardPage = memo(function () {
  const {
    activeProjectId,
    teams,
    setColumns,
    moveTaskBetweenColumns,
    reorderTaskInColumn,
    normalizeTaskPositions,
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
    const {active} = event;
    const taskId = parseInt(active.id.replace("task-", ""));

    // Find the task in any column
    const task = columns
      ?.flatMap((col) => col.tasks || [])
      .find((t) => t.id === taskId);
    setActiveTask(task || null);
  };

  const handleDragEnd = (event: any) => {
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

    // Handle dropping on column (empty area)
    if (over.id.toString().startsWith("column-")) {
      const targetColumnId = parseInt(
        over.id.toString().replace("column-", "")
      );

      if (sourceColumn.id !== targetColumnId) {
        // Move to different column at the end
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

          // Normalize positions in both columns
          setTimeout(() => {
            normalizeTaskPositions(project.id, sourceColumn.id);
            normalizeTaskPositions(project.id, targetColumnId);
          }, 0);
        }
      }
    }

    // Handle dropping on task (specific position)
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
          // Calculate new position based on target index
          let newPosition: number;

          if (sourceIndex < targetIndex) {
            // Moving down: place after target task
            newPosition = targetTask.position + 0.5;
          } else {
            // Moving up: place before target task
            newPosition = targetTask.position - 0.5;
          }

          reorderTaskInColumn(
            project.id,
            sourceColumn.id,
            activeTaskId,
            newPosition
          );

          // Normalize positions to avoid fractional values accumulating
          setTimeout(() => {
            normalizeTaskPositions(project.id, sourceColumn.id);
          }, 0);
        }
      } else {
        // Moving to different column at specific position
        const targetColumnTasks = targetColumn.tasks || [];
        const targetIndex = targetColumnTasks.findIndex(
          (t) => t.id === overTaskId
        );

        // Calculate position to insert before the target task
        let newPosition: number;

        if (targetIndex === 0) {
          // Inserting at the beginning
          newPosition = targetTask.position - 0.5;
        } else {
          // Inserting between tasks
          const prevTask = targetColumnTasks[targetIndex - 1];
          newPosition = (prevTask.position + targetTask.position) / 2;
        }

        moveTaskBetweenColumns(
          project.id,
          activeTaskId,
          sourceColumn.id,
          targetColumn.id,
          newPosition
        );

        // Normalize positions in both columns
        setTimeout(() => {
          normalizeTaskPositions(project.id, sourceColumn.id);
          normalizeTaskPositions(project.id, targetColumn.id);
        }, 0);
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
    return <KanbanBoardLoader/>;
  }

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      collisionDetection={closestCenter}
    >
      <div className="space-y-4 sm:space-y-6">
        <BoardHeader onAddTask={handleAddTask} onFilter={handleFilter}/>

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
        defaultColumnId={defaultColumnId}
      />
    </DndContext>
  );
});
