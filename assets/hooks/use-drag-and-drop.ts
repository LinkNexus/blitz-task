import { useState } from "react";
import type { Task, TaskColumn } from "@/types";

export function useDragAndDrop(initialTasks: Task[]) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [lastMoveMessage, setLastMoveMessage] = useState<string | null>(null);

  const handleTaskDragStart = (task: Task) => {
    setDraggedTask(task);
    setLastMoveMessage(null);
  };

  const handleTaskDragEnd = () => {
    setDraggedTask(null);
  };

  const handleColumnDrop = (targetColumn: TaskColumn) => {
    if (!draggedTask) return;

    if (draggedTask.relatedColumn.id !== targetColumn.id) {
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === draggedTask.id 
            ? { ...task, relatedColumn: targetColumn }
            : task
        )
      );
      
      setLastMoveMessage(`Moved "${draggedTask.name}" to ${targetColumn.name}`);
      setTimeout(() => setLastMoveMessage(null), 3000);
    }
    setDraggedTask(null);
  };

  const moveTask = (taskId: number, targetColumnId: number) => {
    setTasks(prevTasks => 
      prevTasks.map(task => {
        if (task.id === taskId) {
          const targetColumn = prevTasks.find(t => t.relatedColumn.id === targetColumnId)?.relatedColumn;
          if (targetColumn) {
            return { ...task, relatedColumn: targetColumn };
          }
        }
        return task;
      })
    );
  };

  return {
    tasks,
    draggedTask,
    lastMoveMessage,
    handleTaskDragStart,
    handleTaskDragEnd,
    handleColumnDrop,
    moveTask,
    setTasks
  };
}
