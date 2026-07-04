import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/react";
import { useCallback, useRef, useState } from "react";
import type { ProjectColumnDetails, ProjectDetails } from "@/api";

export function useDragNDrop(project: ProjectDetails) {
  const { columns } = project;
  const [optimisticColumns, setOptimisticColumns] = useState<
    ProjectColumnDetails[] | null
  >(null);

  const effectiveColumns = optimisticColumns ?? columns;

  const findColumn = useCallback(
    (id: number, type: any) => {
      if (type === "column") return columns.find((column) => column.id === id);
      else if (type === "task") {
        for (const column of columns) {
          if (column.tasks.some((task) => task.id === id)) return column;
        }
      }

      return null;
    },
    [columns],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const {
      operation: { source },
    } = event;

    if (source && source.type === "task") {
      setOptimisticColumns(columns);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const {
      operation: { source, target },
    } = event;

    if (!source || source.type !== "task" || !target || !target.type) {
      if (optimisticColumns) setOptimisticColumns(null);
      return;
    }

    const sourceColumn = findColumn(Number(source.id), source.type);
    const targetColumn = findColumn(Number(target.id), target.type);

    if (!sourceColumn || !targetColumn) {
      setOptimisticColumns(null);
      return;
    }

    const destSorted = [...targetColumn.tasks].sort(
      (a, b) => Number(b.score) - Number(a.score),
    );

    let insertIndex;

    if (target.type === "task") {
      if (target.id === source.id) {
        setOptimisticColumns(null);
        return;
      }

      const index = destSorted.findIndex(
        (task) => task.id === Number(target.id),
      );
      insertIndex = index === -1 ? destSorted.length : index;
    } else {
      insertIndex = destSorted.length;
    }

    setOptimisticColumns((prevColumns) => {
      if (!prevColumns) return null;

      console.log("hello");

      return prevColumns.map((column) => {
        const tasks = [...column.tasks];
        if (column.id === sourceColumn.id) {
          const index = column.tasks.findIndex(
            (task) => task.id === Number(source.id),
          );

          if (sourceColumn.id === targetColumn.id) {
            tasks.splice(insertIndex, 0, tasks.splice(index, 1)[0]);
          } else {
            tasks.splice(index, 1);
          }

          return {
            ...column,
            tasks,
          };
        }

        if (column.id === targetColumn.id) {
          tasks.splice(
            insertIndex,
            0,
            sourceColumn.tasks.find((task) => task.id === Number(source.id))!,
          );
          return {
            ...column,
            tasks,
          };
        }

        return column;
      });
    });
  };

  const handleDragEnd = useCallback((event: DragEndEvent) => {}, []);

  return {
    effectiveColumns,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}
