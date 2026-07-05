import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import type {
  ProjectColumnDetails,
  ProjectDetails,
  ProjectTaskDetails,
} from "@/api";
import {
  getProjectQueryKey,
  moveProjectTaskMutation,
} from "@/api/@tanstack/react-query.gen";

type Column = ProjectColumnDetails & { tasks: ProjectTaskDetails[] };

function sortDesc(tasks: ProjectTaskDetails[]): ProjectTaskDetails[] {
  return [...tasks].sort((a, b) => Number(b.score) - Number(a.score));
}

const taskDndId = (id: string | number) => `task:${id}`;
const colDndId = (id: string | number) => `column:${id}`;
const parseId = (dndId: unknown) => Number(String(dndId).split(":").at(-1));

export function useDragNDrop(project: ProjectDetails) {
  const [optimisticColumns, setOptimisticColumns] = useState<Column[] | null>(
    null,
  );
  const columnsRef = useRef<Column[] | null>(null);
  const queryClient = useQueryClient();
  const { columns, id: projectId } = project;
  const effectiveColumns = optimisticColumns ?? columns;

  const { mutate: moveTask } = useMutation(moveProjectTaskMutation());

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const {
        operation: { source },
      } = event;
      if (!source || source.type !== "task") return;

      const snapshot = columns.map((c) => ({ ...c, tasks: [...c.tasks] }));
      setOptimisticColumns(snapshot);
      columnsRef.current = snapshot;
    },
    [columns],
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const {
      operation: { source, target, shape },
    } = event;
    if (!source || source.type !== "task" || !target) return;

    const prev = columnsRef.current;
    if (!prev) return;

    const cols: Column[] = prev.map((c) => ({ ...c, tasks: [...c.tasks] }));

    // Pull source task out of its current column
    let sourceTask: ProjectTaskDetails | undefined;
    for (const col of cols) {
      const idx = col.tasks.findIndex(
        (t) => taskDndId(t.id) === String(source.id),
      );
      if (idx !== -1) {
        [sourceTask] = col.tasks.splice(idx, 1);
        break;
      }
    }
    if (!sourceTask) return;

    let targetCol: Column | undefined;

    if (target.type === "task") {
      for (const col of cols) {
        const foundIdx = col.tasks.findIndex(
          (t) => taskDndId(t.id) === String(target.id),
        );
        if (foundIdx === -1) continue;

        targetCol = col;
        const sorted = sortDesc(col.tasks);
        const tIdx = sorted.findIndex(
          (t) => taskDndId(t.id) === String(target.id),
        );

        // Above or below the target card?
        const dragY = shape?.current?.center?.y ?? 0;
        const targetY = target.shape?.center?.y ?? 0;
        const insertBefore = dragY < targetY;

        let tempScore: number;
        if (insertBefore) {
          const above = tIdx > 0 ? sorted[tIdx - 1] : null;
          const scoreAbove = above
            ? Number(above.score)
            : Number(sorted[tIdx].score) + 2000;
          tempScore = (scoreAbove + Number(sorted[tIdx].score)) / 2;
        } else {
          const below = tIdx < sorted.length - 1 ? sorted[tIdx + 1] : null;
          const scoreBelow = below
            ? Number(below.score)
            : Number(sorted[tIdx].score) - 2000;
          tempScore = (Number(sorted[tIdx].score) + scoreBelow) / 2;
        }

        sourceTask = {
          ...sourceTask,
          score: tempScore,
          columnId: Number(col.id),
        };
        break;
      }
    } else if (target.type === "column") {
      targetCol = cols.find((c) => colDndId(c.id) === String(target.id));
      if (targetCol) {
        const sorted = sortDesc(targetCol.tasks);
        const bottom =
          sorted.length > 0 ? Number(sorted[sorted.length - 1].score) : 1000;
        sourceTask = {
          ...sourceTask,
          score: bottom - 1000,
          columnId: Number(targetCol.id),
        };
      }
    }

    if (!targetCol) return;

    targetCol.tasks.push(sourceTask);
    columnsRef.current = cols;
    setOptimisticColumns(cols);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const {
        operation: { source, target },
        canceled,
      } = event;

      if (canceled || !source || source.type !== "task" || !target) {
        setOptimisticColumns(null);
        columnsRef.current = null;
        return;
      }

      const currentCols = columnsRef.current;
      if (!currentCols) return;

      let targetColumnId: number | undefined;
      let newScore: number | undefined;

      for (const col of currentCols) {
        const sorted = sortDesc(col.tasks);
        const idx = sorted.findIndex(
          (t) => taskDndId(t.id) === String(source.id),
        );
        if (idx === -1) continue;

        targetColumnId = Number(col.id);
        const above = idx > 0 ? sorted[idx - 1] : null;
        const below = idx < sorted.length - 1 ? sorted[idx + 1] : null;

        if (!above && !below) newScore = 1000;
        else if (!above) newScore = Number(below!.score) + 1000;
        else if (!below) newScore = Number(above.score) - 1000;
        else newScore = (Number(above.score) + Number(below.score)) / 2;
        break;
      }

      if (targetColumnId === undefined || newScore === undefined) {
        setOptimisticColumns(null);
        columnsRef.current = null;
        return;
      }

      const numericTaskId = parseId(source.id);
      const finalColumnId = targetColumnId;
      const finalScore = newScore;

      moveTask(
        {
          path: { projectId: Number(projectId), taskId: numericTaskId },
          body: { columnId: finalColumnId, score: finalScore },
        },
        {
          onSuccess: (updatedTask) => {
            queryClient.setQueryData(
              getProjectQueryKey({ path: { projectId: Number(projectId) } }),
              (p: ProjectDetails | undefined) => {
                if (!p) return p;
                return {
                  ...p,
                  columns: p.columns.map((col) => ({
                    ...col,
                    tasks:
                      Number(col.id) === finalColumnId
                        ? [
                            ...col.tasks.filter(
                              (t) => Number(t.id) !== numericTaskId,
                            ),
                            updatedTask,
                          ]
                        : col.tasks.filter(
                            (t) => Number(t.id) !== numericTaskId,
                          ),
                  })),
                };
              },
            );
          },
          onSettled: () => {
            setOptimisticColumns(null);
            columnsRef.current = null;
          },
        },
      );
    },
    [moveTask, queryClient, projectId],
  );

  return { effectiveColumns, handleDragStart, handleDragOver, handleDragEnd };
}
