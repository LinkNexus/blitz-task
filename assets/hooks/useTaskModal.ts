import type { Task } from "@/types.ts";
import { useState } from "react";

interface UseTaskModalReturn {
  isOpen: boolean;
  currentTask: Task | null;
  defaultColumnId: number | undefined;
  openCreateModal: (columnId?: number) => void;
  openEditModal: (task: Task) => void;
  closeModal: () => void;
}

export function useTaskModal(): UseTaskModalReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [defaultColumnId, setDefaultColumnId] = useState<number | undefined>(
    undefined
  );

  const openCreateModal = (columnId?: number) => {
    setCurrentTask(null);
    setDefaultColumnId(columnId);
    setIsOpen(true);
  };

  const openEditModal = (task: Task) => {
    setCurrentTask(task);
    setDefaultColumnId(undefined);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setCurrentTask(null);
    setDefaultColumnId(undefined);
  };

  return {
    isOpen,
    currentTask,
    defaultColumnId,
    openCreateModal,
    openEditModal,
    closeModal,
  };
}
