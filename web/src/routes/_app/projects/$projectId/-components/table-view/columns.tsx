import { IconGripVertical, IconPaperclip } from "@tabler/icons-react";
import {
  createColumnHelper,
  metaHelper,
  rowSortingFeature,
  tableFeatures,
} from "@tanstack/react-table";
import type {
  ProjectColumnDetails,
  ProjectDetails,
  ProjectTaskDetails,
} from "@/api";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, getInitials } from "@/lib/utils";
import { getPriorityIcon, getPriorityPillClass } from "../kanban-view/lib";
import { ProjectMenu } from "../kanban-view/task-card/menu";

export type TaskRow = ProjectTaskDetails & {
  col: ProjectColumnDetails;
  isOverdue: boolean;
  isCompleted: boolean;
};

export const features = tableFeatures({
  rowSortingFeature,
  tableMeta: metaHelper<{ project: ProjectDetails }>(),
  columnMeta: metaHelper<{}>(),
});

const columnHelper = createColumnHelper<typeof features, TaskRow>();

const empty = <span className="text-xs text-muted-foreground/30">—</span>;

export const columns = columnHelper.columns([
  columnHelper.display({
    id: "drag",
    header: "",
    cell: () => (
      <IconGripVertical className="size-4 text-muted-foreground/30 opacity-0 transition-opacity group-hover/row:opacity-100 cursor-grab active:cursor-grabbing" />
    ),
  }),

  columnHelper.accessor("name", {
    header: "Task",
    cell: (info) => {
      const task = info.row.original;
      return (
        <div
          className={cn(
            "truncate text-sm font-medium text-foreground",
            task.isCompleted && "line-through text-muted-foreground",
          )}
        >
          {task.name}
        </div>
      );
    },
  }),

  columnHelper.accessor("priority", {
    header: "Priority",
    cell: (info) => {
      const task = info.row.original;
      const label = task.priority[0] + task.priority.slice(1).toLowerCase();
      return (
        <div
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
            getPriorityPillClass(task.priority),
          )}
        >
          {getPriorityIcon(task.priority)}
          {label}
        </div>
      );
    },
  }),

  columnHelper.accessor("dueDate", {
    header: "Due date",
    cell: (info) => {
      const task = info.row.original;
      if (!task.dueDate) return empty;
      return (
        <div
          className={cn(
            "flex items-center gap-1.5 text-sm whitespace-nowrap",
            task.isOverdue
              ? "text-red-600 dark:text-red-400 font-medium"
              : "text-muted-foreground",
          )}
        >
          {new Date(task.dueDate).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      );
    },
  }),

  columnHelper.display({
    id: "assignees",
    header: "Assignee",
    cell: (info) => {
      const task = info.row.original;
      const project = info.table.options.meta!.project;
      if (task.assigneeIds.length === 0) return empty;
      return (
        <AvatarGroup>
          {task.assigneeIds.slice(0, 4).map((id) => {
            const participant = project.participants.find(
              (p) => p.userId === id,
            );
            if (!participant) return null;
            return (
              <Avatar
                key={String(id)}
                title={participant.name}
                className="size-6 border-2 border-background"
              >
                <AvatarFallback className="bg-primary/10 text-[10px] font-medium text-primary">
                  {getInitials(participant.name)}
                </AvatarFallback>
              </Avatar>
            );
          })}
          {task.assigneeIds.length > 4 && (
            <AvatarGroupCount className="bg-muted text-[10px] font-medium text-muted-foreground">
              +{task.assigneeIds.length - 4}
            </AvatarGroupCount>
          )}
        </AvatarGroup>
      );
    },
  }),

  columnHelper.display({
    id: "tags",
    header: "Tags",
    cell: (info) => {
      const { tags } = info.row.original;
      if (tags.length === 0) return empty;
      return (
        <div className="flex flex-nowrap items-center gap-1 overflow-hidden">
          {tags.slice(0, 2).map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="shrink-0 max-w-20 rounded-md py-0 px-1.5 text-[11px] font-normal"
            >
              <span className="truncate">{tag}</span>
            </Badge>
          ))}
          {tags.length > 2 && (
            <span className="shrink-0 text-[11px] text-muted-foreground">
              +{tags.length - 2}
            </span>
          )}
        </div>
      );
    },
  }),

  columnHelper.display({
    id: "files",
    header: "Files",
    cell: (info) => {
      const { attachments } = info.row.original;
      if (attachments.length === 0) return empty;
      return (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <IconPaperclip className="size-3.5 shrink-0" />
          {attachments.length}
        </span>
      );
    },
  }),

  columnHelper.display({
    id: "actions",
    header: "",
    cell: (info) => (
      <div
        className="opacity-0 group-hover/row:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <ProjectMenu
          task={info.row.original}
          columns={info.table.options.meta!.project.columns}
        />
      </div>
    ),
  }),
]);
