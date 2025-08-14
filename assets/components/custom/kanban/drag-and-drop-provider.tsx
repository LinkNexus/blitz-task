import {TaskCard} from "@/components/custom/kanban/tasks/task-card.tsx";
import {apiFetch} from "@/lib/fetch.ts";
import {useAppStore} from "@/lib/store.ts";
import type {Project, Task, TaskColumn} from "@/types.ts";
import {DndContext, DragOverlay} from "@dnd-kit/core";
import {useState} from "react";

interface DragAndDropProviderProps {
  children: React.ReactNode;
  columns: TaskColumn[];
  project: Project;
}

export function DragAndDropProvider({
  children,
  columns,
  project,
}: DragAndDropProviderProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const {moveTaskBetweenColumns, reorderTaskInColumn} = useAppStore((state) => state);

  const getTasksForColumn = (column: TaskColumn) => {
    return column.tasks?.sort((a, b) => b.score - a.score) || [];
  };

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
    const endpoint = `/api/tasks/move`;

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

          await apiFetch(endpoint, {
            data: {
              id: activeTaskId,
              columnId: targetColumnId,
              score: newScore,
              projectId: project.id
            }
          });
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
        const columnTasks = getTasksForColumn(sourceColumn);
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

        await apiFetch(endpoint, {
          data: {
            id: sourceTask.id,
            score: newScore,
            projectId: project.id,
          }
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
          newScore = targetTask.score + 100;
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

        await apiFetch(endpoint, {
          data: {
            id: activeTaskId,
            columnId: targetColumn.id,
            score: newScore,
            projectId: project.id,
          }
        });
      }
    }

  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {children}

      {/* Drag Overlay */}
      <DragOverlay>
        {activeTask && (
          <div className="rotate-3 opacity-90">
            <TaskCard
              task={activeTask}
              project={project}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
