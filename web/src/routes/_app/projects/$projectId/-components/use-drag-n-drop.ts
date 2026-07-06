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
  moveProjectTaskMutation,
} from "@/api/@tanstack/react-query.gen";

export const colDndId = (id: ProjectColumnDetails["id"]) => `column:${id}`;
export const taskDndId = (id: ProjectTaskDetails["id"]) => `task:${id}`;
const parseColDndId = (dndId: string) => Number(dndId.split(":")[1]);
const parseTaskDndId = (dndId: string) => Number(dndId.split(":")[1]);

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

type TasksOrder = Record<string, string[]>;

export type DndReturnValue = {
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  effectiveColumns: ProjectColumnDetails[];
};

export function useDragNDrop(project: ProjectDetails): DndReturnValue {
  const queryClient = useQueryClient();
  const orderRef = useRef<TasksOrder>(null);
  const [optimisticOrder, setOptimisticOrder] = useState<TasksOrder | null>(
    null,
  );
  const { columns } = project;

  const moveTaskMut = useMutation(moveProjectTaskMutation());

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

  const effectiveColumns = useMemo(
    () => rebuildColumnsFromOrder(optimisticOrder ?? tasksMap),
    [optimisticOrder, tasksMap, rebuildColumnsFromOrder],
  );

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
    },
    [tasksMap],
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { source, target } = event.operation;

    if (!source || source.type !== "task" || !target) {
      return;
    }

    const prev = orderRef.current;
    if (!prev) return;

    const next = move(prev, event);
    orderRef.current = next;
    setOptimisticOrder(next);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { source, target } = event.operation;

      const cleanup = () => {
        setOptimisticOrder(null);
        orderRef.current = null;
      };

      if (!source || !target) return cleanup();

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
