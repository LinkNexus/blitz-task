import { FlexRender } from "@tanstack/react-table";
import { Fragment } from "react";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { columns } from "./columns";
import type { TaskGroup, TaskRows } from "./grouping";

/** One read-only task row, shared by a flat group and a section's column sub-groups. */
function TaskTableRow({ row }: { row: TaskRows[number] }) {
  return (
    <TableRow
      className="group/row transition-colors cursor-pointer hover:bg-muted/40"
      onClick={() =>
        document.dispatchEvent(
          new CustomEvent("task.update", { detail: row.original }),
        )
      }
    >
      {row.getAllCells().map((cell) => (
        <TableCell
          key={cell.id}
          className={cn(
            "py-3",
            cell.column.id === "select" && "w-8 pr-0",
            cell.column.id === "drag" && "w-8 pr-0",
            cell.column.id === "section" && "w-[120px]",
            cell.column.id === "tags" && "w-[140px] max-w-[140px]",
            cell.column.id === "name" && "min-w-[220px]",
            cell.column.id === "actions" && "w-10",
          )}
        >
          {/* Keep the drag column for header alignment, but not its grip: there is nothing to
              drag in a static group. */}
          {cell.column.id !== "drag" && <FlexRender cell={cell} />}
        </TableCell>
      ))}
    </TableRow>
  );
}

/**
 * Body for a non-column grouping. Rows are read-only here: dragging encodes a
 * move to a column at a score, which says nothing about a task's priority,
 * assignee or due date, so there is nothing coherent for a drop to write.
 */
export function StaticGroupBody({ group }: { group: TaskGroup }) {
  return (
    <TableBody>
      <TableRow className="hover:bg-transparent border-b border-t first:border-t-0">
        <TableCell colSpan={columns.length} className="py-3">
          <div className="flex items-center gap-2.5">
            <span className="text-[15px] font-semibold tracking-tight">
              {group.label}
            </span>
            <span className="text-xs text-muted-foreground/60">
              {group.rows.length}
            </span>
          </div>
        </TableCell>
      </TableRow>

      {/* A section keeps the column axis rather than replacing it, so its rows are shown under
          the column they are in — the table's answer to the board's swimlanes. Every other
          grouping has no sub-level and falls through to the flat list below. */}
      {group.subGroups?.map((subGroup) => (
        <Fragment key={subGroup.key}>
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columns.length} className="py-1.5 pl-8">
              <span className="text-xs font-medium text-muted-foreground">
                {subGroup.label}
              </span>
              <span className="ml-2 text-xs text-muted-foreground/50">
                {subGroup.rows.length}
              </span>
            </TableCell>
          </TableRow>
          {subGroup.rows.map((row) => (
            <TaskTableRow key={row.id} row={row} />
          ))}
        </Fragment>
      ))}

      {!group.subGroups &&
        group.rows.map((row) => <TaskTableRow key={row.id} row={row} />)}

      {group.rows.length === 0 && (
        <TableRow className="hover:bg-transparent">
          <TableCell
            className="py-4 text-center text-muted-foreground/40"
            colSpan={columns.length}
          >
            No tasks
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}
