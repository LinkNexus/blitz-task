import type {TaskColumn} from "@/types.ts";
import {useState} from "react";

export function useColumnModal() {
  const [isColumnModalOpen, setIsOpen] = useState(false);
  const [currentColumn, setCurrentColumn] = useState<TaskColumn | null>(null);

  const openCreateColumnModal = () => {
    setCurrentColumn(null);
    setIsOpen(true);
  };

  const openEditColumnModal = (column: TaskColumn) => {
    setCurrentColumn(column);
    setIsOpen(true);
  };

  const closeColumnModal = () => {
    setIsOpen(false);
    setCurrentColumn(null);
  };

  return {
    isColumnModalOpen,
    currentColumn,
    openCreateColumnModal,
    openEditColumnModal,
    closeColumnModal
  }
}
