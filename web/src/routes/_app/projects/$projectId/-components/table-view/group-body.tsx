import { CollisionPriority } from "@dnd-kit/abstract";
import { useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { FlexRender, type Row } from "@tanstack/react-table";
import type { ProjectColumnDetails } from "@/api";
import { Badge } from "@/components/ui/badge";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { columns, type features, type TaskRow } from "./utils";

type Props = {
  column: ProjectColumnDetails;
  rows: Row<typeof features, TaskRow>[];
};

export function GroupBody({ column, rows }: Props) {
  const { ref, isDropTarget } = useDroppable({
    id: `column:${column.id}`,
    type: "column",
    accept: ["task"],
    collisionPriority: CollisionPriority.Low,
  });

  return (
    <TableBody
      ref={ref}
      className={cn("transition-colors", isDropTarget && "bg-primary/5")}
    >
      <TableRow className="bg-muted/30 border-b border-t first:border-t-0">
        <TableCell colSpan={columns.length}>
          <div className="flex items-center gap-2">
            <span
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: column.color }}
            />
            <span className="text-xl font-semibold">{column.name}</span>
            <Badge
              variant="secondary"
              className="text-xs h-4 px-1.5 font-normal tabular-nums"
            >
              {rows.length}
            </Badge>
          </div>
        </TableCell>
      </TableRow>

      {rows.map((row, idx) => (
        <SortableRow key={row.id} row={row} index={idx} />
      ))}

      {rows.length === 0 && (
        <TableRow>
          <TableCell
            className="text-center text-muted-foreground/40"
            colSpan={columns.length}
          >
            {isDropTarget ? "Drop here" : "No tasks"}
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}

type SortableRowProps = {
  row: Props["rows"][number];
  index: number;
};

function SortableRow({ row, index }: SortableRowProps) {
  const task = row.original;
  const { ref, isDragging } = useSortable({
    id: `task:${task.id}`,
    index,
    type: "task",
    accept: ["task"],
  });

  return (
    <TableRow
      ref={ref}
      className={cn(
        "transition-colors cursor-pointer hover:bg-muted/40",
        isDragging ? " bg-muted shadow-accent" : "border-b last:border-0",
      )}
      onClick={() =>
        document.dispatchEvent(new CustomEvent("task.update", { detail: task }))
      }
    >
      {row.getAllCells().map((cell) => (
        <TableCell
          key={cell.id}
          className={cn(
            cell.column.id === "drag" && "w-8 pr-0",
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
