import { IconCalendarDue, IconGripVertical } from "@tabler/icons-react";
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
import { getPriorityIcon } from "../kanban-view/lib";
import { ProjectMenu } from "../kanban-view/task-card/menu";

export type TaskRow = ProjectTaskDetails & {
  col: ProjectColumnDetails;
  isOverdue: boolean;
  isCompleted: boolean;
};

export const features = tableFeatures({
  rowSortingFeature,
  tableMeta: metaHelper<{ project: ProjectDetails }>(),
  columnMeta: metaHelper<{
    isOverdue: boolean;
    isCompleted: boolean;
    column: ProjectColumnDetails;
  }>(),
});

const columnHelper = createColumnHelper<typeof features, TaskRow>();

export const columns = columnHelper.columns([
  columnHelper.display({
    id: "drag",
    header: "",
    cell: () => (
      <IconGripVertical className="size-3.5 text-muted-foreground/40 group-hover/row:text-muted-foreground transition-colors cursor-grab" />
    ),
  }),
  columnHelper.accessor("name", {
    header: "Task",
    cell: (info) => {
      const task = info.row.original;

      return (
        <span
          className={cn(
            "font-medium text-sm truncate",
            task.isCompleted && "line-through text-muted-foreground",
          )}
        >
          {task.name}
        </span>
      );
    },
  }),
  columnHelper.accessor("priority", {
    header: "Priority",
    cell: (info) => {
      const task = info.row.original;
      const label = task.priority[0] + task.priority.slice(1).toLowerCase();

      return (
        <Badge
          variant="secondary"
          className="text-xs flex items-center gap-1 w-fit"
        >
          {getPriorityIcon(task.priority)}
          <span>{label}</span>
        </Badge>
      );
    },
  }),
  columnHelper.accessor("dueDate", {
    header: "Due Date",
    cell: (info) => {
      const task = info.row.original;

      if (!task.dueDate) {
        return <span className="text-xs text-muted-foreground/40">—</span>;
      }

      return (
        <span
          className={cn(
            "text-xs gap-1 items-center",
            task.isOverdue
              ? "text-red-500 font-medium"
              : "text-muted-foreground",
          )}
        >
          <IconCalendarDue className="size-3.5 shrink-0" />
          {new Date(task.dueDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
          {task.isOverdue && (
            <Badge variant="destructive" className="text-xs px-1 py-0 ml-1">
              Overdue
            </Badge>
          )}
        </span>
      );
    },
  }),
  columnHelper.display({
    id: "assignees",
    header: "Assignees",
    cell: (info) => {
      const task = info.row.original;
      const project = info.table.options.meta!.project;

      if (task.assigneeIds.length === 0) {
        return <span className="text-xs text-muted-foreground/40">—</span>;
      }

      return (
        <AvatarGroup>
          {task.assigneeIds.slice(0, 4).map((id) => {
            const participant = project.participants.find(
              (p) => p.userId === id,
            );

            if (!participant) return null;

            return (
              <Avatar key={String(id)} title={participant.name}>
                <AvatarFallback>{getInitials(participant.name)}</AvatarFallback>
              </Avatar>
            );
          })}
          {task.assigneeIds.length > 4 && (
            <AvatarGroupCount className="bg-primary/10 text-[10px] font-medium text-primary">
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

      if (tags.length === 0) {
        return <span className="text-xs text-muted-foreground/40">—</span>;
      }

      return (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="rounded-md text-[11px] py-0 px-1.5"
            >
              {tag}
            </Badge>
          ))}
        </div>
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
