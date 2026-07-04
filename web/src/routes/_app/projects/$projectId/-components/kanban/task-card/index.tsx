import { pointerIntersection } from "@dnd-kit/collision";
import { useSortable } from "@dnd-kit/react/sortable";
import { IconCalendarDue, IconPaperclip } from "@tabler/icons-react";
import { useMemo } from "react";
import type { ProjectDetails, ProjectTaskDetails } from "@/api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getPriorityIcon, getPriorityPillClass } from "../lib";
import { ProjectMenu } from "./menu";

type Props = {
  project: ProjectDetails;
  task: ProjectTaskDetails;
  index: number;
};

export function TaskCard({ index, task, project }: Props) {
  const { ref, isDragging } = useSortable({
    id: `task:${task.id}`,
    index,
    type: "task",
    accept: "task",
    collisionDetector: pointerIntersection,
  });

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

  const priorityLabel =
    task.priority.charAt(0) + task.priority.slice(1).toLowerCase();

  return (
    <Card
      ref={ref}
      data-dragging={isDragging}
      className={cn(
        "group select-none overflow-hidden cursor-grab active:cursor-grabbing",
        "rounded-xl border bg-card",
        "transition-all duration-200",
        isDragging ? "shadow-xl" : "hover:border-primary/30 hover:shadow-md",
      )}
    >
      <div className="p-4 space-y-3">
        {/* Name + menu */}
        <div className="flex items-start justify-between gap-2">
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
            <ProjectMenu task={task} columns={project.columns} />
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
