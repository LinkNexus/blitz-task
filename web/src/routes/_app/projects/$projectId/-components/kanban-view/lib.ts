import {
  IconAlertCircle,
  IconCheck,
  IconCircle,
  IconFlag,
} from "@tabler/icons-react";
import { createElement, type FunctionComponent, type ReactNode } from "react";
import type { ProjectTaskPriority } from "@/api";

export function getPriorityColor(priority: ProjectTaskPriority): string {
  switch (priority) {
    case "URGENT":
      return "bg-red-100 text-red-800 border-red-200";
    case "HIGH":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "MEDIUM":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "LOW":
      return "bg-green-100 text-green-800 border-green-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

export function getPriorityBarColor(priority: ProjectTaskPriority): string {
  switch (priority) {
    case "URGENT":
      return "bg-red-500";
    case "HIGH":
      return "bg-orange-500";
    case "MEDIUM":
      return "bg-yellow-400";
    case "LOW":
      return "bg-green-500";
    default:
      return "bg-muted";
  }
}

export function getPriorityPillClass(priority: ProjectTaskPriority): string {
  switch (priority) {
    case "URGENT":
      return "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400";
    case "HIGH":
      return "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400";
    case "MEDIUM":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400";
    case "LOW":
      return "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function getPriorityIcon(priority: ProjectTaskPriority): ReactNode {
  const priorityMap: Record<
    ProjectTaskPriority,
    { element: FunctionComponent; color: string }
  > = {
    URGENT: { element: IconAlertCircle, color: "text-red-500" },
    HIGH: { element: IconFlag, color: "text-orange-500" },
    MEDIUM: { element: IconCircle, color: "text-yellow-500" },
    LOW: { element: IconCheck, color: "text-green-500" },
  };

  return createElement(priorityMap[priority].element, {
    // @ts-expect-error
    className: `w-3 h-3 sm:w-4 sm:h-4 ${priorityMap[priority].color}`,
  });
}
