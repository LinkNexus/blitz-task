import { CollisionPriority } from "@dnd-kit/abstract";
import { useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { IconPlus } from "@tabler/icons-react";
import { FlexRender, type Row } from "@tanstack/react-table";
import type { ProjectColumnDetails } from "@/api";
import { Button } from "@/components/ui/button";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ProjectColumnMenu } from "../kanban-view/column/menu";
import { colDndId, sortablePlugins, taskDndId } from "../use-drag-n-drop";
import { columns, type features, type TaskRow } from "./columns";

type Props = {
  column: ProjectColumnDetails;
  rows: Row<typeof features, TaskRow>[];
  projectId: number;
};

export function GroupBody({ column, rows, projectId }: Props) {
  const { ref, isDropTarget } = useDroppable({
    id: colDndId(column.id),
    type: "column",
    accept: ["task"],
    collisionPriority: CollisionPriority.Low,
  });

  return (
    <TableBody
      ref={ref}
      className={cn("transition-colors", isDropTarget && "bg-primary/5")}
    >
      <TableRow className="hover:bg-transparent border-b border-t first:border-t-0">
        <TableCell colSpan={columns.length} className="py-3">
          <div className="flex items-center gap-2.5">
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold text-white"
              style={{ backgroundColor: column.color }}
            >
              {column.name.charAt(0).toUpperCase()}
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              {column.name}
            </span>
            <span className="text-xs text-muted-foreground/60">
              {rows.length}
            </span>
            <div className="ml-auto">
              <ProjectColumnMenu column={column} projectId={projectId} />
            </div>
          </div>
        </TableCell>
      </TableRow>

      {rows.map((row, idx) => (
        <DraggableRow
          key={row.id}
          index={idx}
          row={row}
          groupDndId={colDndId(column.id)}
        />
      ))}

      {!isDropTarget && rows.length === 0 && (
        <TableRow className="hover:bg-transparent">
          <TableCell
            className="py-4 text-center text-muted-foreground/40"
            colSpan={columns.length}
          >
            No tasks
          </TableCell>
        </TableRow>
      )}

      {isDropTarget && rows.length - 1 === 0 && (
        <TableRow className="hover:bg-transparent">
          <TableCell
            className="py-4 text-center text-muted-foreground/40"
            colSpan={columns.length}
          >
            Drop here
          </TableCell>
        </TableRow>
      )}

      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={columns.length} className="py-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-full justify-start gap-1.5 px-2 text-sm font-normal text-muted-foreground hover:text-foreground"
            onClick={() =>
              document.dispatchEvent(
                new CustomEvent("task.create", {
                  detail: { columnId: column.id },
                }),
              )
            }
          >
            <IconPlus className="size-4" />
            Add task
          </Button>
        </TableCell>
      </TableRow>
    </TableBody>
  );
}

function DraggableRow({
  index,
  row,
  groupDndId,
}: {
  index: number;
  row: Props["rows"][number];
  groupDndId: string;
}) {
  const task = row.original;

  const { ref, isDragging } = useSortable({
    index,
    id: taskDndId(task.id),
    type: "task",
    accept: "task",
    // Use the column the row is currently rendered under so cross-column
    // optimistic drags report the right group to dnd-kit.
    group: groupDndId,
    plugins: sortablePlugins,
  });

  return (
    <TableRow
      ref={ref}
      className={cn(
        "group/row transition-colors cursor-pointer hover:bg-muted/40",
        isDragging && "border shadow-lg bg-muted/50",
      )}
      onClick={() =>
        document.dispatchEvent(new CustomEvent("task.update", { detail: task }))
      }
    >
      {row.getAllCells().map((cell) => (
        <TableCell
          key={cell.id}
          className={cn(
            "py-3",
            cell.column.id === "drag" && "w-8 pr-0",
            cell.column.id === "tags" && "w-[140px] max-w-[140px]",
            cell.column.id === "name" && "min-w-[220px]",
            cell.column.id === "actions" && "w-10",
          )}
        >
          <FlexRender cell={cell} />
        </TableCell>
      ))}
    </TableRow>
  );
}
