import type {TaskColumn} from "@/types.ts";
import {useState} from "react";

export function useColumnModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentColumn, setCurrentColumn] = useState<TaskColumn | null>(null);

  const openCreateColumnModal = () => {
    setCurrentColumn(null);
    setIsOpen(true);
  };

  const openEditColumnModal = (column: TaskColumn) => {
    setCurrentColumn(column);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setCurrentColumn(null);
  };

  return {
    isOpen,
    currentColumn,
    openCreateModal: openCreateColumnModal,
    openEditColumnModal,
    closeModal
  }
}
