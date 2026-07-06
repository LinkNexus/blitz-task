import { DragDropProvider } from "@dnd-kit/react";
import { type Row, useTable } from "@tanstack/react-table";
import { useMemo } from "react";
import type { ProjectDetails } from "@/api";
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { DndReturnValue } from "../use-drag-n-drop";
import { columns, features, type TaskRow } from "./columns";
import { GroupBody } from "./group-body";

type Props = {
  project: ProjectDetails;
  dndProps: DndReturnValue;
};

export function TableView({ project, dndProps }: Props) {
  const sortedColumns = useMemo(
    () =>
      [...dndProps.effectiveColumns].sort(
        (a, b) => Number(a.score) - Number(b.score),
      ),
    [dndProps.effectiveColumns],
  );

  const maxColumnsScore = useMemo(
    () => Math.max(0, ...project.columns.map((c) => Number(c.score))),
    [project.columns],
  );

  // Render in the order provided by the dnd hook (score-sorted at rest, the
  // optimistic order mid-drag). Re-sorting by score here would undo the
  // optimistic reorder, since scores only change once a drag is dropped.
  const flatTasks = useMemo(
    () =>
      sortedColumns.flatMap((col) =>
        col.tasks.map(
          (task): TaskRow => ({
            ...task,
            col,
            isCompleted: col.score === maxColumnsScore,
            isOverdue:
              !!task.dueDate &&
              new Date(task.dueDate) < new Date() &&
              Number(col.score) < maxColumnsScore,
          }),
        ),
      ),
    [sortedColumns, maxColumnsScore],
  );

  const table = useTable({
    features,
    data: flatTasks,
    columns,
    meta: { project },
  });

  const groupedRows = useMemo(() => {
    const rowsByColumn = new Map<string, Row<typeof features, TaskRow>[]>();

    for (const row of table.getRowModel().rows) {
      // Group by the effective column (set in flatTasks) rather than the task's
      // own columnId, so a task dragged across columns is shown under its new
      // column optimistically — its columnId only updates once the drag drops.
      const key = String(row.original.col.id);

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
      onDragStart={dndProps.handleDragStart}
      onDragOver={dndProps.handleDragOver}
      onDragEnd={dndProps.handleDragEnd}
    >
      <div className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="w-full text-sm">
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="hover:bg-transparent">
                  {hg.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "text-left text-xs font-medium text-muted-foreground/70 whitespace-nowrap",
                        header.column.id === "drag" && "w-8 pr-0",
                        header.column.id === "tags" && "w-fit max-w-[200px]",
                        header.column.id === "name" && "min-w-[220px] w-full",
                        header.column.id === "actions" && "w-10",
                      )}
                    >
                      {!header.isPlaceholder && (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            {groupedRows.map(({ column, rows }) => (
              <GroupBody
                key={String(column.id)}
                column={column}
                rows={rows}
                projectId={Number(project.id)}
              />
            ))}
          </Table>
        </div>
      </div>
    </DragDropProvider>
  );
}
