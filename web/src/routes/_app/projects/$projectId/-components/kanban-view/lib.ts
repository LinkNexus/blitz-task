import {
  IconAlertCircle,
  IconCheck,
  IconCircle,
  IconFlag,
} from "@tabler/icons-react";
import { createElement, type ReactNode } from "react";
import type { ProjectTaskPriority } from "@/api";

/**
 * Priority tone, and the ranking is the point: **visual weight tracks urgency**.
 *
 * This used to be four exported functions here spelling the four priorities in raw Tailwind
 * steps (red/orange/yellow/green), plus a fifth, *different* spelling in `tasks/$taskId` —
 * one concept, two drifting copies, and two of the four functions had no callers at all.
 * Worse, all four gave every priority the same treatment: a filled pill. So `Low` rendered
 * exactly as loud as `Urgent`, and on a board where most work is low or medium the quietest
 * thing in the app was shouting. Weight now falls away down the scale — only `URGENT` is
 * filled, and `LOW` is a plain neutral chip that recedes.
 *
 * Tokens, not palette steps: `destructive`/`warning` carry the app's one meaning of red and
 * amber, so a theme change moves these with everything else.
 */
const TONE: Record<ProjectTaskPriority, string> = {
  URGENT: "bg-destructive text-destructive-foreground",
  HIGH: "bg-destructive-surface text-destructive",
  MEDIUM: "bg-warning-surface text-warning",
  LOW: "border border-border text-muted-foreground",
};

const ICON: Record<ProjectTaskPriority, typeof IconCheck> = {
  URGENT: IconAlertCircle,
  HIGH: IconFlag,
  MEDIUM: IconCircle,
  LOW: IconCheck,
};

export function getPriorityPillClass(priority: ProjectTaskPriority): string {
  return TONE[priority] ?? TONE.LOW;
}

/** The icon inherits the pill's colour rather than carrying its own — one decision, not two. */
export function getPriorityIcon(priority: ProjectTaskPriority): ReactNode {
  return createElement(ICON[priority] ?? ICON.LOW, {
    className: "size-3.5 shrink-0",
  });
}
