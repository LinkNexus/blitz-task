import type { Plugins } from "@dnd-kit/abstract";
import { OptimisticSortingPlugin } from "@dnd-kit/dom/sortable";
import { move } from "@dnd-kit/helpers";
import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import type {
  ProjectColumnDetails,
  ProjectDetails,
  ProjectTaskDetails,
} from "@/api";
import {
  getProjectQueryKey,
  moveProjectColumnMutation,
  moveProjectTaskMutation,
} from "@/api/@tanstack/react-query.gen";

export const colDndId = (id: ProjectColumnDetails["id"]) => `column:${id}`;
export const taskDndId = (id: ProjectTaskDetails["id"]) => `task:${id}`;
// A column is both a task drop target (`colDndId`) and a reorderable item
// (`colSortDndId`); the two need distinct ids so dnd-kit's registry keeps them
// apart.
export const colSortDndId = (id: ProjectColumnDetails["id"]) => `colsort:${id}`;
const parseTaskDndId = (dndId: string) => Number(dndId.split(":")[1]);
const parseColSortDndId = (dndId: string) => Number(dndId.split(":")[1]);

/**
 * React drives the optimistic reordering during a drag (see `handleDragOver`),
 * so dnd-kit's OptimisticSortingPlugin — which physically relocates the dragged
 * element in the DOM via `insertAdjacentElement` — is both redundant and, on
 * table rows, the source of "removeChild: node is not a child of this node"
 * crashes when its DOM move races React's reconciliation. Drop it and let React
 * own the DOM; the sortable transition still animates index changes.
 */
export const sortablePlugins = (defaults: Plugins): Plugins =>
  defaults.filter((plugin) => plugin !== OptimisticSortingPlugin);

export function scoreBetween(above?: number, below?: number): number {
  const a = above ?? NaN;
  const b = below ?? NaN;
  if (Number.isNaN(a) && Number.isNaN(b)) return 1000;
  if (Number.isNaN(a)) return b + 1000;
  if (Number.isNaN(b)) return a - 1000;
  return (a + b) / 2;
}

// Columns render in ascending score order (leftmost/topmost = lowest), so the
// neighbour semantics are flipped relative to tasks: `before` is the lower-score
// column, `after` the higher one.
export function columnScoreBetween(before?: number, after?: number): number {
  const a = before ?? NaN;
  const b = after ?? NaN;
  if (Number.isNaN(a) && Number.isNaN(b)) return 1000;
  if (Number.isNaN(a)) return b - 1000;
  if (Number.isNaN(b)) return a + 1000;
  return (a + b) / 2;
}

type TasksOrder = Record<string, string[]>;
type ColumnsOrder = string[];

export type DndReturnValue = {
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  effectiveColumns: ProjectColumnDetails[];
};

export function useDragNDrop(project: ProjectDetails): DndReturnValue {
  const queryClient = useQueryClient();
  const orderRef = useRef<TasksOrder>(null);
  const columnsRef = useRef<ColumnsOrder>(null);
  const [optimisticOrder, setOptimisticOrder] = useState<TasksOrder | null>(
    null,
  );
  const [optimisticColumns, setOptimisticColumns] =
    useState<ColumnsOrder | null>(null);
  const { columns } = project;

  const moveTaskMut = useMutation(moveProjectTaskMutation());
  const moveColumnMut = useMutation(moveProjectColumnMutation());

  const tasksByIds = useMemo(
    () =>
      columns
        .flatMap((c) => c.tasks)
        .reduce(
          (acc, task) => acc.set(Number(task.id), task),
          new Map<number, ProjectTaskDetails>(),
        ),
    [columns],
  );

  // Base order is derived purely from `score` (highest first) so it always
  // matches how both views render tasks. During a drag the optimistic order
  // (from `move`) takes over; scores are only rewritten on drop.
  const tasksMap = useMemo(
    () =>
      columns.reduce((acc, col) => {
        acc[colDndId(col.id)] = [...col.tasks]
          .sort((a, b) => Number(b.score) - Number(a.score))
          .map((t) => taskDndId(t.id));
        return acc;
      }, {} as TasksOrder),
    [columns],
  );

  // Base column order is derived purely from `score` (lowest first). During a
  // column drag the optimistic order takes over; scores are rewritten on drop.
  const baseColumnOrder = useMemo(
    () =>
      [...columns]
        .sort((a, b) => Number(a.score) - Number(b.score))
        .map((c) => colSortDndId(c.id)),
    [columns],
  );

  const rebuildColumnsFromOrder = useCallback(
    (order: TasksOrder, overrides?: Map<number, ProjectTaskDetails>) =>
      Object.entries(order).map(
        ([colId, tasksIds]): ProjectColumnDetails => ({
          ...columns.find((c) => colDndId(c.id) === colId)!,
          tasks: tasksIds.map((taskId) => {
            const id = parseTaskDndId(taskId);
            return overrides?.get(id) ?? tasksByIds.get(id)!;
          }),
        }),
      ),
    [columns, tasksByIds],
  );

  // Column order and task order are independent: a drag reorders one or the
  // other, never both, so each optimistic layer falls back to its score-sorted
  // base when idle.
  const effectiveColumns = useMemo(() => {
    const taskOrder = optimisticOrder ?? tasksMap;
    const columnOrder = optimisticColumns ?? baseColumnOrder;
    return columnOrder.map((sortId): ProjectColumnDetails => {
      const col = columns.find((c) => colSortDndId(c.id) === sortId)!;
      const taskIds = taskOrder[colDndId(col.id)] ?? [];
      return {
        ...col,
        tasks: taskIds.map((taskId) => tasksByIds.get(parseTaskDndId(taskId))!),
      };
    });
  }, [
    optimisticOrder,
    optimisticColumns,
    tasksMap,
    baseColumnOrder,
    columns,
    tasksByIds,
  ]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { source } = event.operation;
      if (!source) return;

      const cloneOrder = () => {
        return Object.entries(tasksMap).reduce((acc, kv) => {
          acc[kv[0]] = [...kv[1]];
          return acc;
        }, {} as TasksOrder);
      };

      if (source.type === "task") {
        setOptimisticOrder(cloneOrder());
        orderRef.current = cloneOrder();
      }

      if (source.type === "column") {
        setOptimisticColumns([...baseColumnOrder]);
        columnsRef.current = [...baseColumnOrder];
      }
    },
    [tasksMap, baseColumnOrder],
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { source, target } = event.operation;
    if (!source || !target) return;

    if (source.type === "task") {
      const prev = orderRef.current;
      if (!prev) return;
      const next = move(prev, event);
      orderRef.current = next;
      setOptimisticOrder(next);
      return;
    }

    if (source.type === "column") {
      const prev = columnsRef.current;
      if (!prev) return;
      const next = move(prev, event);
      columnsRef.current = next;
      setOptimisticColumns(next);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { source, target } = event.operation;

      const cleanup = () => {
        setOptimisticOrder(null);
        orderRef.current = null;
        setOptimisticColumns(null);
        columnsRef.current = null;
      };

      const queryKeyBase = getProjectQueryKey({
        path: { projectId: Number(project.id) },
      });

      if (!source || !target) return cleanup();

      if (source.type === "column") {
        const newColOrder = columnsRef.current;
        if (!newColOrder) return cleanup();

        const movedSortId = String(source.id);
        const movedColId = parseColSortDndId(movedSortId);
        const idx = newColOrder.indexOf(movedSortId);
        if (idx === -1) return cleanup();

        const getColScore = (sortId: string | undefined) => {
          if (!sortId) return undefined;
          return Number(
            columns.find((c) => colSortDndId(c.id) === sortId)?.score,
          );
        };

        const newScore = columnScoreBetween(
          getColScore(newColOrder[idx - 1]),
          getColScore(newColOrder[idx + 1]),
        );

        queryClient.setQueryData(
          queryKeyBase,
          (p: ProjectDetails | undefined) =>
            p && {
              ...p,
              columns: p.columns.map((c) =>
                Number(c.id) === movedColId ? { ...c, score: newScore } : c,
              ),
            },
        );

        moveColumnMut.mutate(
          {
            path: { projectId: Number(project.id), columnId: movedColId },
            body: { score: newScore },
          },
          {
            onSuccess: (updatedColumn) => {
              queryClient.setQueryData(
                queryKeyBase,
                (p: ProjectDetails | undefined) =>
                  p && {
                    ...p,
                    columns: p.columns.map((c) =>
                      Number(c.id) === movedColId
                        ? { ...c, score: updatedColumn.score }
                        : c,
                    ),
                  },
              );
            },
            onError: () => {
              queryClient.invalidateQueries({ queryKey: queryKeyBase });
            },
            onSettled: cleanup,
          },
        );
        return;
      }

      if (source.type !== "task") return cleanup();

      const newOrder = orderRef.current;
      if (!newOrder) return cleanup();

      const sourceId = parseTaskDndId(String(source.id));
      const sourceDndId = String(source.id);

      // The destination is whichever column now holds the source after `move`,
      // regardless of whether it was dropped onto a task or an empty column.
      const destEntry = Object.entries(newOrder).find(([, ids]) =>
        ids.includes(sourceDndId),
      );
      if (!destEntry) return cleanup();

      const [destColDndId, destIds] = destEntry;
      const destinationCol = columns.find(
        (c) => colDndId(c.id) === destColDndId,
      );
      if (!destinationCol) return cleanup();

      // Score is computed from the source's real neighbours at its landing
      // position (their scores are unchanged — only the source's moves).
      const srcIdx = destIds.indexOf(sourceDndId);

      const getTaskScore = (taskId: string | undefined) => {
        if (!taskId) return undefined;
        return Number(tasksByIds.get(parseTaskDndId(taskId))?.score);
      };

      const newScore = scoreBetween(
        getTaskScore(destIds[srcIdx - 1]),
        getTaskScore(destIds[srcIdx + 1]),
      );

      const queryKey = getProjectQueryKey({
        path: { projectId: Number(project.id) },
      });

      const movedTask: ProjectTaskDetails = {
        ...tasksByIds.get(sourceId)!,
        columnId: Number(destinationCol.id),
        score: newScore,
      };
      const overrides = new Map([[sourceId, movedTask]]);

      queryClient.setQueryData(queryKey, {
        ...project,
        columns: rebuildColumnsFromOrder(newOrder, overrides),
      });

      moveTaskMut.mutate(
        {
          path: { projectId: Number(project.id), taskId: sourceId },
          body: {
            columnId: Number(destinationCol.id),
            score: newScore,
          },
        },
        {
          onSuccess: (updatedTask) => {
            queryClient.setQueryData(
              queryKey,
              (p: ProjectDetails | undefined) =>
                p && {
                  ...p,
                  columns: p.columns.map((col) => ({
                    ...col,
                    tasks:
                      Number(col.id) === Number(updatedTask.columnId)
                        ? [
                            ...col.tasks.filter(
                              (t) => Number(t.id) !== sourceId,
                            ),
                            updatedTask,
                          ]
                        : col.tasks.filter((t) => Number(t.id) !== sourceId),
                  })),
                },
            );
          },
          onError: () => {
            queryClient.invalidateQueries({ queryKey });
          },
          onSettled: () => {
            cleanup();
          },
        },
      );
    },
    [
      columns,
      moveTaskMut,
      moveColumnMut,
      project,
      queryClient,
      rebuildColumnsFromOrder,
      tasksByIds,
    ],
  );

  return {
    effectiveColumns,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}
