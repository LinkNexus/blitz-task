import { TaskCard } from "@/components/custom/projects/kanban-board/task-card/task-card.tsx";
import { TaskModal } from "@/components/custom/projects/kanban-board/task-modal/task-modal.tsx";
import { useApiFetch } from "@/hooks/use-api-fetch";
import { apiFetch } from "@/lib/api-fetch.ts";
import type { Project, Task, TaskColumn } from "@/types";
import {
  closestCorners,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { KanbanColumn } from "./kanban-column";

type Props = Pick<Project, "id" | "participants">;

export const KanbanBoard = memo(({ id, participants }: Props) => {
  const [columns, setColumns] = useState<TaskColumn[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const activeColumn = columns.find(
    (c) => c.id === activeTask?.relatedColumn.id
  );

  // --- ID helpers ---------------------------------------------------------
  const isTaskId = useCallback(
    (raw: string | null | undefined) => !!raw && raw.startsWith("task-"),
    []
  );
  const isColumnId = useCallback(
    (raw: string | null | undefined) => !!raw && raw.startsWith("column-"),
    []
  );
  const parseTaskId = useCallback(
    (raw: string) => Number(raw.replace("task-", "")),
    []
  );
  const parseColumnId = useCallback(
    (raw: string) => Number(raw.replace("column-", "")),
    []
  );

  const sortedColumns = useMemo(() => {
    return [...columns].sort((a, b) => a.score - b.score);
  }, [columns]);

  const { pending: fetchingColumns, action: fetchColumns } = useApiFetch<
    TaskColumn[]
  >({
    url: `/api/columns`,
    options: {
      onSuccess(res) {
        setColumns(res.data);
      },
    },
  });

  const collisionDetection: CollisionDetection = useCallback((args) => {
    // 1) Prefer what the pointer is actually over
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;

    // 2) If dragging a task and nothing is under the pointer, prefer columns
    if ((args.active.data.current as { type?: string })?.type === "task") {
      const columnCollisions = rectIntersection({
        ...args,
        droppableContainers: args.droppableContainers.filter((c) =>
          String(c.id).startsWith("column-")
        ),
      });
      if (columnCollisions.length > 0) return columnCollisions;
    }

    // 3) Fallback to classic heuristic
    return closestCorners(args);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const findColumn = useCallback(
    (rawId: string | null) => {
      if (!rawId) return null;

      if (isColumnId(rawId)) {
        const cid = parseColumnId(rawId);
        return columns.find((c) => c.id === cid) ?? null;
      }

      if (isTaskId(rawId)) {
        const tid = parseTaskId(rawId);
        for (const c of columns) {
          if (c.tasks.some((t) => t.id === tid)) return c;
        }
      }

      return null;
    },
    [columns, isColumnId, isTaskId, parseColumnId, parseTaskId]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const activeData = active.data.current;

    if (activeData?.type === "task") {
      setActiveTask(activeData.task as Task);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      setActiveTask(null);
      if (!over) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      const sourceColumn = findColumn(activeId);
      const destinationColumn = findColumn(overId);
      if (!sourceColumn || !destinationColumn) return;

      const activeTaskId = isTaskId(activeId) ? parseTaskId(activeId) : NaN;
      const activeData = active.data.current as
        | { type?: string; task?: Task }
        | undefined;
      const movingTask: Task | undefined =
        activeData?.type === "task"
          ? (activeData.task as Task)
          : columns.flatMap((c) => c.tasks).find((t) => t.id === activeTaskId);
      if (!movingTask) return;

      // Build destination list sorted by score (desc)
      const destSorted = [...destinationColumn.tasks].sort(
        (a, b) => b.score - a.score
      );

      // Ignore no-op drops over the same task
      if (isTaskId(overId)) {
        const overTaskId = parseTaskId(overId);
        if (overTaskId === movingTask.id) return;
      }

      // Insert index: before the hovered task; else append to top of column
      let insertIndex: number;
      if (isTaskId(overId)) {
        const overTaskId = parseTaskId(overId);
        const idx = destSorted.findIndex((t) => t.id === overTaskId);
        insertIndex = idx === -1 ? destSorted.length : idx;
      } else {
        insertIndex = 0;
      }

      // For intra-column moves, remove the moving task from the scoring list
      const scoringList =
        destinationColumn.id === sourceColumn.id
          ? destSorted.filter((t) => t.id !== movingTask.id)
          : destSorted;

      if (insertIndex > scoringList.length) insertIndex = scoringList.length;

      // Compute a stable integer score based on neighbors in desc order
      const computeScore = (list: Task[], index: number): number => {
        if (list.length === 0) return 100;
        if (index === 0) return (list[0]?.score ?? 0) + 100; // above top
        if (index >= list.length)
          return (list[list.length - 1]?.score ?? 0) - 100; // below bottom
        const prev = list[index - 1].score; // higher
        const next = list[index].score; // lower
        if (prev - next > 1) return Math.floor((prev + next) / 2);
        return prev + 1; // minimal nudge to stay above next
      };

      const newScore = computeScore(scoringList, insertIndex);

      // Dispatch global event to optimistically update and persist
      document.dispatchEvent(
        new CustomEvent("task.move", {
          detail: {
            columnId: destinationColumn.id,
            task: movingTask,
            score: newScore,
          },
        })
      );
    },
    [columns, findColumn, isTaskId, parseTaskId]
  );

  useEffect(() => {
    function onTaskCreatedOrUpdated(ev: Event) {
      const task = (ev as CustomEvent).detail as Task;

      setColumns((prevState) =>
        prevState.map((c) => {
          if (c.id !== task.relatedColumn.id) return c;

          if (!c.tasks.some((t) => t.id === task.id))
            return {
              ...c,
              tasks: [...c.tasks, task],
            };

          return {
            ...c,
            tasks: c.tasks.map((t) => (t.id === task.id ? task : t)),
          };
        })
      );
    }

    function onTaskDeleted(ev: Event) {
      const taskId = (ev as CustomEvent).detail.id;
      setColumns((prevState) =>
        prevState.map((c) => {
          if (!c.tasks.some((t) => t.id === taskId)) return c;
          return {
            ...c,
            tasks: c.tasks.filter((t) => t.id != taskId),
          };
        })
      );
    }

    async function onTaskMove(e: Event) {
      const { columnId, task, score } = (e as CustomEvent).detail as {
        columnId: number;
        task: Task;
        score: number;
      };

      setColumns((columns) =>
        columns.map((c) => {
          if (task.relatedColumn.id !== columnId) {
            if (c.id === task.relatedColumn.id) {
              return {
                ...c,
                tasks: c.tasks.filter((t) => t.id !== task.id),
              };
            }
            if (c.id === columnId) {
              return {
                ...c,
                tasks: [
                  ...c.tasks,
                  {
                    ...task,
                    relatedColumn: { id: c.id },
                    score: score,
                  },
                ],
              };
            }

            return c;
          }
          return {
            ...c,
            tasks: c.tasks.map((t) => {
              if (t.id === task.id) {
                return {
                  ...t,
                  score: score!,
                };
              }
              return t;
            }),
          };
        })
      );

      await apiFetch("/api/tasks/move", {
        data: {
          id: task.id,
          score,
          columnId,
        },
      }).catch(() => {
        toast.error("An error happened when moving the task");
      });
    }

    document.addEventListener("task.created", onTaskCreatedOrUpdated);
    document.addEventListener("task.updated", onTaskCreatedOrUpdated);
    document.addEventListener("task.deleted", onTaskDeleted);
    document.addEventListener("task.move", onTaskMove);

    return () => {
      document.removeEventListener("task.created", onTaskCreatedOrUpdated);
      document.removeEventListener("task.updated", onTaskCreatedOrUpdated);
      document.removeEventListener("task.deleted", onTaskDeleted);
      document.removeEventListener("task.move", onTaskMove);
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    fetchColumns({ searchParams: { projectId: id } });
  }, [id]);

  if (fetchingColumns) return <div>Loading...</div>;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 sm:gap-6 min-h-[500px] sm:min-h-[600px]">
          {sortedColumns.map((column) => (
            <KanbanColumn key={column.id} column={column} columns={columns} />
          ))}
        </div>

        <DragOverlay>
          {activeTask && (
            <TaskCard
              task={activeTask}
              columns={columns}
              currentColumn={activeColumn!}
            />
          )}
        </DragOverlay>
      </DndContext>
      <TaskModal projectId={id} participants={participants} />
    </>
  );
});
