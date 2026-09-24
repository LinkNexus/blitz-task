import { useSortable } from "@dnd-kit/react/sortable";
import {
  IconCalendarDue,
  IconLink,
  IconListCheck,
  IconPaperclip,
  IconRepeat,
} from "@tabler/icons-react";
import { useMemo } from "react";
import type { ProjectDetails, ProjectTaskDetails } from "@/api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { openBlockers } from "../../task-dependencies";
import { useTaskSelection } from "../../task-selection";
import { cellDndId, sortablePlugins, taskDndId } from "../../use-drag-n-drop";
import { getPriorityIcon, getPriorityPillClass } from "../lib";
import { ProjectMenu } from "./menu";

type Props = {
  project: ProjectDetails;
  task: ProjectTaskDetails;
  index: number;
  columnId: string | number;
  /** The swimlane this card is rendered in; `ALL_LANES` on an unsplit board. */
  laneKey: string;
  dragDisabled: boolean;
};

export function TaskCard({
  index,
  task,
  project,
  columnId,
  laneKey,
  dragDisabled,
}: Props) {
  const { ref, isDragging } = useSortable({
    id: taskDndId(task.id),
    index,
    type: "task",
    accept: "task",
    // The sortable group is the cell, not the column: with swimlanes on, dnd-kit has to see
    // each lane's slice of a column as its own list or the indices it computes are against the
    // whole column and a drop lands in the wrong place.
    group: cellDndId(columnId, laneKey),
    plugins: sortablePlugins,
    disabled: dragDisabled,
  });

  const selection = useTaskSelection();
  const isSelected = selection.isSelected(task.id);

  const currentColumn = useMemo(
    () => project.columns.find((c) => Number(c.id) === Number(task.columnId)),
    [project.columns, task.columnId],
  );

  const maxScore = useMemo(
    () => Math.max(...project.columns.map((c) => Number(c.score))),
    [project.columns],
  );

  const isOverdue =
    !!task.dueDate &&
    !!currentColumn &&
    Number(currentColumn.score) < maxScore &&
    new Date(task.dueDate) < new Date();

  const checklistDone = task.checklistItems.filter((i) => i.isDone).length;

  // A dependency you cannot see is write-only data, so the card says when something is still
  // holding this task up — and says nothing once those blockers are done.
  const blockers = openBlockers(task, project);

  const priorityLabel =
    task.priority.charAt(0) + task.priority.slice(1).toLowerCase();

  return (
    <Card
      ref={ref}
      data-dragging={isDragging}
      className={cn(
        "group select-none overflow-hidden",
        dragDisabled ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        "rounded-xl border bg-card",
        "transition-all duration-200",
        isDragging ? "shadow-xl" : "hover:border-primary/30 hover:shadow-md",
        isSelected && "border-primary ring-1 ring-primary",
      )}
    >
      <div className="p-4 space-y-3">
        {/* Name + menu */}
        <div className="flex items-start justify-between gap-2">
          {/* `onPointerDown` stops here or the checkbox starts a drag instead of ticking, the
              same guard the title and the menu already use. Hidden until hover unless something
              is selected — once a selection exists, every card needs a visible target. */}
          <div
            className={cn(
              "shrink-0 pt-0.5 transition-opacity",
              isSelected || selection.count > 0
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100",
            )}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => selection.toggle(task.id)}
              aria-label={`Select ${task.name}`}
            />
          </div>
          <button
            type="button"
            className="line-clamp-3 text-[14px] font-semibold leading-snug flex-1 text-left hover:underline cursor-pointer"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() =>
              document.dispatchEvent(
                new CustomEvent("task.update", { detail: task }),
              )
            }
          >
            {task.name}
          </button>
          <div
            className="opacity-0 transition-opacity group-hover:opacity-100 shrink-0 -mt-0.5 -mr-1"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <ProjectMenu task={task} project={project} />
          </div>
        </div>

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {task.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="rounded-md text-[11px]"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {/* Priority pill */}
            <span
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold shrink-0 ${getPriorityPillClass(task.priority)}`}
            >
              {getPriorityIcon(task.priority)}
              {priorityLabel}
            </span>

            {blockers.length > 0 && (
              <span
                className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"
                title={`Blocked by ${blockers.map((b) => b.name).join(", ")}`}
              >
                <IconLink className="size-3.5 shrink-0" />
                {blockers.length}
              </span>
            )}

            {task.dueDate && (
              <span
                className={`flex items-center gap-1 text-xs ${isOverdue ? "text-red-500" : "text-muted-foreground"}`}
              >
                <IconCalendarDue className="size-3.5 shrink-0" />
                {new Date(task.dueDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}

            {task.recurrence && (
              <span
                className="flex items-center gap-1 text-xs text-muted-foreground"
                title="Repeats — completing this writes the next one"
              >
                <IconRepeat className="size-3.5 shrink-0" />
              </span>
            )}

            {task.checklistItems.length > 0 && (
              <span
                className={`flex items-center gap-1 text-xs tabular-nums ${
                  checklistDone === task.checklistItems.length
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
                }`}
              >
                <IconListCheck className="size-3.5 shrink-0" />
                {checklistDone}/{task.checklistItems.length}
              </span>
            )}

            {task.attachments.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <IconPaperclip className="size-3.5 shrink-0" />
                {task.attachments.length}
              </span>
            )}
          </div>

          {task.assigneeIds.length > 0 && (
            <div className="flex -space-x-2 shrink-0">
              {task.assigneeIds.slice(0, 4).map((id) => {
                const participant = project.participants.find(
                  (p) => String(p.userId) === String(id),
                );
                if (!participant) return null;
                return (
                  <Avatar
                    key={String(id)}
                    className="size-6 border-2 border-background"
                  >
                    <AvatarFallback className="bg-primary/10 text-[10px] font-medium text-primary">
                      {participant.name
                        .split(" ")
                        .map((x) => x[0])
                        .join("")
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                );
              })}
              {task.assigneeIds.length > 4 && (
                <div className="flex size-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium text-muted-foreground">
                  +{task.assigneeIds.length - 4}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
