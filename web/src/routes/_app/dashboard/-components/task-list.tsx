import { IconCalendarDue, IconChecklist } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type { UserTaskSummary } from "@/api";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  getPriorityIcon,
  getPriorityPillClass,
} from "@/routes/_app/projects/$projectId/-components/kanban-view/lib";
import { type DueSection, groupByDueSection } from "./task-buckets";

/** Sections past the deadline get a red heading; the rest are neutral. */
const SECTION_ACCENT: Record<DueSection["key"], string> = {
  overdue: "text-red-600 dark:text-red-400",
  today: "text-orange-600 dark:text-orange-400",
  week: "text-muted-foreground",
  later: "text-muted-foreground",
  none: "text-muted-foreground",
};

function TaskRow({ task }: { task: UserTaskSummary }) {
  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: String(task.projectId) }}
      className="flex items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-border hover:bg-muted/50"
    >
      <span
        className="mt-1.5 size-2 shrink-0 rounded-full"
        style={{ backgroundColor: task.columnColor }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{task.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="truncate">{task.projectName}</span>
          <span aria-hidden>·</span>
          <span className="truncate">{task.columnName}</span>
          {task.dueDate && (
            <>
              <span aria-hidden>·</span>
              <span className="flex items-center gap-1">
                <IconCalendarDue className="size-3.5 shrink-0" />
                {new Date(task.dueDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </>
          )}
        </div>
      </div>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
          getPriorityPillClass(task.priority),
        )}
      >
        {getPriorityIcon(task.priority)}
        {task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}
      </span>
    </Link>
  );
}

export function TaskList({
  tasks,
  assignedToMe,
}: {
  tasks: UserTaskSummary[];
  assignedToMe: boolean;
}) {
  const sections = groupByDueSection(tasks);

  if (sections.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-10 text-center">
        <IconChecklist className="size-8 text-muted-foreground/50" />
        <p className="text-sm font-medium">Nothing open</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          {assignedToMe
            ? "No open tasks are assigned to you. Switch to All tasks to see everything in your projects."
            : "Every task in your projects is in its final column."}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <section key={section.key}>
          <h3
            className={cn(
              "mb-1.5 flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-wide",
              SECTION_ACCENT[section.key],
            )}
          >
            {section.label}
            <Badge
              variant="secondary"
              className="h-5 px-1.5 font-normal tabular-nums"
            >
              {section.tasks.length}
            </Badge>
          </h3>
          <div className="space-y-0.5">
            {section.tasks.map((task) => (
              <TaskRow key={String(task.id)} task={task} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
