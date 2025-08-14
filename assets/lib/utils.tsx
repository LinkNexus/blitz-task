import {type ClassValue, clsx} from "clsx"
import {twMerge} from "tailwind-merge"
import {AlertCircle, Flag} from "lucide-react";
import type {Task} from "@/types.ts";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getLabelColor(label: string) {
  const colors = [
    "#007bff",
    "#28a745",
    "#dc3545",
    "#ffc107",
    "#17a2b8",
    "#6c757d",
    "#343a40",
    "#6f42c1",
    "#fd7e14",
    "#20c997",
    "#e83e8c",
  ];

  return colors[label.charCodeAt(0) % colors.length];
}

export function getPriorityIcon(priority: Task["priority"]) {
  switch (priority) {
    case "urgent":
      return <AlertCircle className="w-4 h-4 text-red-500"/>;
    case "high":
      return <Flag className="w-4 h-4 text-orange-500"/>;
    case "medium":
      return <Flag className="w-4 h-4 text-yellow-500"/>;
    case "low":
      return <Flag className="w-4 h-4 text-green-500"/>;
    default:
      return <Flag className="w-4 h-4 text-gray-500"/>;
  }
}
