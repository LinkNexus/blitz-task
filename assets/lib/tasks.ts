import {AlertCircle, CheckCircle, Circle, Flag} from "lucide-react";
import {createElement, type FunctionComponent} from "react";
import type {Task} from "@/types";

export function getPriorityIcon(priority: Task["priority"]) {
  const priorityMap: Record<
    Task["priority"],
    { element: FunctionComponent; color: string }
  > = {
    urgent: {element: AlertCircle, color: "text-red-500"},
    high: {element: Flag, color: "text-orange-500"},
    medium: {element: Circle, color: "text-yellow-500"},
    low: {element: CheckCircle, color: "text-green-500"},
  };

  return createElement(priorityMap[priority].element, {
    // @ts-ignore
    className: `size-4 ${priorityMap[priority].color}`,
  });
}

export function getPriorityColor(priority: Task["priority"]) {
  switch (priority) {
    case "urgent":
      return "bg-red-100 text-red-800 border-red-200";
    case "high":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "medium":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "low":
      return "bg-green-100 text-green-800 border-green-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}
