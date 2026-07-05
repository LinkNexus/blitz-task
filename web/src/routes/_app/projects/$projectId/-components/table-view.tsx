import { CollisionPriority } from "@dnd-kit/abstract";
import { pointerIntersection } from "@dnd-kit/collision";
import { DragDropProvider, DragOverlay, useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import {
  IconCalendarDue,
  IconGripVertical,
  IconPaperclip,
} from "@tabler/icons-react";
import {
  type CellContext,
  type ColumnDef,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  type Row,
  type RowData,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo } from "react";
import type {
  ProjectColumnDetails,
  ProjectDetails,
  ProjectTaskDetails,
} from "@/api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDragNDrop } from "./kanban-view/hooks";
import { getPriorityIcon, getPriorityPillClass } from "./kanban-view/lib";
import { ProjectMenu } from "./kanban-view/task-card/menu";

// ─── Types ───────────────────────────────────────────────────────────────────

type TaskRow = ProjectTaskDetails & { columnDetails: ProjectColumnDetails };

interface TableMeta {
  project: ProjectDetails;
  maxColumnScore: number;
}

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> extends TableMeta {}
}

// ─── Column definitions ───────────────────────────────────────────────────────

const columnHelper = createColumnHelper<TaskRow>();

const columns: ColumnDef<TaskRow, unknown>[] = [
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
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium truncate">{task.name}</span>
          {task.attachments.length > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
              <IconPaperclip className="size-3" />
              {task.attachments.length}
            </span>
          )}
        </div>
      );
    },
  }),
  columnHelper.accessor("priority", {
    header: "Priority",
    cell: (info) => {
      const task = info.row.original;
      const label =
        task.priority.charAt(0) + task.priority.slice(1).toLowerCase();
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${getPriorityPillClass(task.priority)}`}
        >
          {getPriorityIcon(task.priority)}
          {label}
        </span>
      );
    },
  }),
  columnHelper.accessor("dueDate", {
    header: "Due date",
    cell: (info) => <DueDateCell info={info} />,
  }),
  columnHelper.display({
    id: "assignees",
    header: "Assignees",
    cell: (info) => <AssigneesCell info={info} />,
  }),
  columnHelper.display({
    id: "tags",
    header: "Tags",
    cell: (info) => {
      const { tags } = info.row.original;
      if (tags.length === 0)
        return <span className="text-xs text-muted-foreground/40">—</span>;
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
          {tags.length > 3 && (
            <Badge
              variant="outline"
              className="rounded-md text-[11px] py-0 px-1.5 text-muted-foreground"
            >
              +{tags.length - 3}
            </Badge>
          )}
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
];

// ─── Cell helpers ─────────────────────────────────────────────────────────────

function DueDateCell({ info }: { info: CellContext<TaskRow, unknown> }) {
  const task = info.row.original;
  const { maxColumnScore } = info.table.options.meta!;
  if (!task.dueDate)
    return <span className="text-xs text-muted-foreground/40">—</span>;
  const isOverdue =
    Number(task.columnDetails.score) < maxColumnScore &&
    new Date(task.dueDate) < new Date();
  return (
    <span
      className={`flex items-center gap-1 text-xs ${isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}
    >
      <IconCalendarDue className="size-3.5 shrink-0" />
      {new Date(task.dueDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}
    </span>
  );
}

function AssigneesCell({ info }: { info: CellContext<TaskRow, unknown> }) {
  const task = info.row.original;
  const { project } = info.table.options.meta!;
  if (task.assigneeIds.length === 0)
    return <span className="text-xs text-muted-foreground/40">—</span>;
  return (
    <div className="flex -space-x-1.5">
      {task.assigneeIds.slice(0, 4).map((id) => {
        const participant = project.participants.find(
          (p) => String(p.userId) === String(id),
        );
        if (!participant) return null;
        return (
          <Avatar
            key={String(id)}
            className="size-6 border-2 border-background"
            title={participant.name}
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
  );
}

// ─── Sortable row ─────────────────────────────────────────────────────────────

function SortableRow({ row, index }: { row: Row<TaskRow>; index: number }) {
  const task = row.original;
  const { ref, isDragging } = useSortable({
    id: `task:${task.id}`,
    index,
    type: "task",
    accept: "task",
    collisionDetector: pointerIntersection,
  });

  return (
    <tr
      ref={ref}
      className={cn(
        "group/row border-b last:border-0 cursor-pointer transition-colors hover:bg-muted/40",
        isDragging && "opacity-30",
      )}
      onClick={() =>
        document.dispatchEvent(new CustomEvent("task.update", { detail: task }))
      }
    >
      {row.getVisibleCells().map((cell) => (
        <td
          key={cell.id}
          className={cn(
            "px-4 py-2.5",
            cell.column.id === "drag" && "w-8 pr-0",
            cell.column.id === "name" && "min-w-[220px]",
            cell.column.id === "actions" && "w-10",
          )}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
}

// ─── Group body (one <tbody> per column) ──────────────────────────────────────

function GroupBody({
  column,
  rows,
}: {
  column: ProjectColumnDetails;
  rows: Row<TaskRow>[];
}) {
  const { ref, isDropTarget } = useDroppable({
    id: `column:${column.id}`,
    type: "column",
    accept: ["task"],
    collisionDetector: pointerIntersection,
    collisionPriority: CollisionPriority.Low,
  });

  return (
    <tbody
      ref={ref}
      className={cn("transition-colors", isDropTarget && "bg-primary/5")}
    >
      {/* Group header */}
      <tr className="bg-muted/30 border-b border-t first:border-t-0">
        <td colSpan={columns.length} className="px-4 py-2">
          <div className="flex items-center gap-2">
            <span
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: column.color }}
            />
            <span className="text-xs font-semibold">{column.name}</span>
            <Badge
              variant="secondary"
              className="text-xs h-4 px-1.5 font-normal tabular-nums"
            >
              {rows.length}
            </Badge>
          </div>
        </td>
      </tr>

      {/* Task rows */}
      {rows.map((row, idx) => (
        <SortableRow key={row.id} row={row} index={idx} />
      ))}

      {/* Empty drop target hint */}
      {rows.length === 0 && (
        <tr>
          <td
            colSpan={columns.length}
            className="px-4 py-3 text-center text-xs text-muted-foreground/40"
          >
            {isDropTarget ? "Drop here" : "No tasks"}
          </td>
        </tr>
      )}
    </tbody>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TableView({ project }: { project: ProjectDetails }) {
  const {
    effectiveColumns,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    activeTask,
  } = useDragNDrop(project);

  const sortedColumns = useMemo(
    () =>
      [...effectiveColumns].sort((a, b) => Number(a.score) - Number(b.score)),
    [effectiveColumns],
  );

  const flatTasks = useMemo(
    () =>
      sortedColumns.flatMap((col) =>
        [...col.tasks]
          .sort((a, b) => Number(b.score) - Number(a.score))
          .map((task): TaskRow => ({ ...task, columnDetails: col })),
      ),
    [sortedColumns],
  );

  const maxColumnScore = useMemo(
    () => Math.max(0, ...project.columns.map((c) => Number(c.score))),
    [project.columns],
  );

  const table = useReactTable({
    data: flatTasks,
    columns,
    meta: { project, maxColumnScore },
    getCoreRowModel: getCoreRowModel(),
  });

  // Group TanStack rows back by column for rendering
  const groupedRows = useMemo(() => {
    const rowsByColumn = new Map<string, Row<TaskRow>[]>();
    for (const row of table.getRowModel().rows) {
      const key = String(row.original.columnId);
      if (!rowsByColumn.has(key)) rowsByColumn.set(key, []);
      rowsByColumn.get(key)!.push(row);
    }
    return sortedColumns.map((col) => ({
      column: col,
      rows: rowsByColumn.get(String(col.id)) ?? [],
    }));
  }, [table, sortedColumns]);

  return (
    <DragDropProvider
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b bg-muted/40">
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className={cn(
                        "text-left font-medium text-muted-foreground px-4 py-2.5 whitespace-nowrap",
                        header.column.id === "drag" && "w-8 pr-0",
                        header.column.id === "name" && "min-w-[220px] w-full",
                        header.column.id === "actions" && "w-10",
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            {groupedRows.map(({ column, rows }) => (
              <GroupBody key={String(column.id)} column={column} rows={rows} />
            ))}
          </table>
        </div>
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="rounded-lg border bg-card shadow-xl px-4 py-2.5 text-sm font-medium opacity-95 cursor-grabbing">
            {activeTask.name}
          </div>
        )}
      </DragOverlay>
    </DragDropProvider>
  );
}
