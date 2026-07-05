import { DragDropProvider } from "@dnd-kit/react";
import { type Row, useTable } from "@tanstack/react-table";
import { useMemo } from "react";
import type { ProjectDetails } from "@/api";
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useDragNDrop } from "../kanban-view/hooks";
import { GroupBody } from "./group-body";
import { columns, features, type TaskRow } from "./utils";

type Props = {
  project: ProjectDetails;
};

export function TableView({ project }: Props) {
  const { effectiveColumns, handleDragStart, handleDragOver, handleDragEnd } =
    useDragNDrop(project);

  const sortedColumns = [...effectiveColumns].sort(
    (a, b) => Number(a.score) - Number(b.score),
  );

  const maxColumnsScore = useMemo(
    () => Math.max(0, ...project.columns.map((c) => Number(c.score))),
    [project.columns],
  );

  const flatTasks = useMemo(
    () =>
      sortedColumns.flatMap((col) =>
        [...col.tasks]
          .sort((a, b) => Number(b.score) - Number(a.score))
          .map(
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
    [sortedColumns],
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
      const key = String(row.original.columnId);

      if (!rowsByColumn.has(key)) rowsByColumn.set(key, []);
      rowsByColumn.get(key)!.push(row);
    }

    return sortedColumns.map((col) => ({
      column: col,
      rows: rowsByColumn.get(String(col.id)) ?? [],
    }));
  }, [table.getRowModel().rows, sortedColumns]);

  return (
    <DragDropProvider
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="w-full text-sm border-collapse">
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "text-left font-medium text-muted-foreground whitespace-nowrap",
                        header.column.id === "drag" && "w-8 pr-0",
                        header.column.id === "name" && "min-w-[220px] w-full",
                        header.column.id === "actions" && "w-10",
                      )}
                    >
                      {header.isPlaceholder ? null : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            {groupedRows.map(({ column, rows }) => (
              <GroupBody key={String(column.id)} column={column} rows={rows} />
            ))}
          </Table>
        </div>
      </div>
    </DragDropProvider>
  );
}
