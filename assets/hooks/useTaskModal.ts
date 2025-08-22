import type { Task } from "@/types.ts";
import { useState } from "react";

export function useTaskModal() {
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [defaultColumnId, setDefaultColumnId] = useState<number | undefined>(
    undefined
  );

  const openCreateTaskModal = (columnId?: number) => {
    setCurrentTask(null);
    setDefaultColumnId(columnId);
    setIsTaskModalOpen(true);
  };

  const openEditTaskModal = (task: Task) => {
    setCurrentTask(task);
    setDefaultColumnId(undefined);
    setIsTaskModalOpen(true);
  };

  const closeTaskModal = () => {
    setIsTaskModalOpen(false);
    setCurrentTask(null);
    setDefaultColumnId(undefined);
  };

  return {
    isTaskModalOpen,
    currentTask,
    defaultColumnId,
    openCreateTaskModal,
    openEditTaskModal,
    closeTaskModal,
  };
}
