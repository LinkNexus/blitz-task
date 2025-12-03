import {useApiFetch} from "@/hooks/use-api-fetch";
import type {Project, Task, TaskColumn} from "@/types";
import {memo, useCallback, useEffect, useMemo, useState} from "react";
import {KanbanColumn} from "./kanban-column";
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
import {sortableKeyboardCoordinates} from "@dnd-kit/sortable";
import {TaskCard} from "@/components/custom/projects/kanban-board/task-card/task-card.tsx";
import {TaskModal} from "@/components/custom/projects/kanban-board/task-modal/task-modal.tsx";
import {apiFetch} from "@/lib/api-fetch.ts";
import {toast} from "sonner";

type Props = Pick<Project, "id" | "participants">

export const KanbanBoard = memo(({id, participants}: Props) => {
  const [columns, setColumns] = useState<TaskColumn[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const activeColumn = columns.find(c => c.id === activeTask?.relatedColumn.id);

  const sortedColumns = useMemo(() => {
    return [...columns].sort((a, b) => a.score - b.score);
  }, [columns]);

  const {pending: fetchingColumns, action: fetchColumns} = useApiFetch<
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
    // Prefer what the pointer is actually over
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;

    // If dragging a task and nothing is under the pointer, try columns first
    if ((args.active.data.current as { type?: string })?.type === "task") {
      const columnCollisions = rectIntersection({
        ...args,
        droppableContainers: args.droppableContainers.filter((c) =>
          String(c.id).startsWith("column-")
        ),
      });
      if (columnCollisions.length > 0) return columnCollisions;
    }

    // Fallback
    return closestCorners(args);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const findColumn = useCallback((id: string | null) => {
    if (!id) return null;

    if (id.startsWith("column-")) {
      for (const column of columns) {
        if (column.id === Number(id.replace("column-", ""))) {
          return column;
        }
      }

      return null;
    }

    const taskIdsWithColumn = columns.flatMap(c => {
      return c.tasks.map(t => ({taskId: t.id, column: c}))
    });

    return taskIdsWithColumn.find(
      i => i.taskId === Number(id.replace("task-", ""))
    )?.column;
  }, [columns]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const {active} = event;
    const activeData = active.data.current;

    if (activeData?.type === "task") {
      setActiveTask(activeData.task as Task);
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const {active, over} = event;

    setActiveTask(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const sourceColumn = findColumn(activeId);
    const destinationColumn = findColumn(overId);

    if (!sourceColumn || !destinationColumn) return;

    const activeTaskId = Number(activeId.replace("task-", ""));
    const activeData = active.data.current as { type?: string; task?: Task } | undefined;
    const task: Task | undefined = activeData?.type === "task" ? (activeData.task as Task) :
      columns.flatMap((c) => c.tasks).find((t) => t.id === activeTaskId);
    if (!task) return;

    // Determine destination tasks sorted by score (desc)
    const destTasksSorted = [...destinationColumn.tasks].sort((a, b) => b.score - a.score);

    // If dropping over the same task, do nothing
    if (overId.startsWith("task-")) {
      const overTaskId = Number(overId.replace("task-", ""));
      if (overTaskId === activeTaskId) return;
    }

    // Compute insertion index in destination list (before the over task)
    let insertIndex: number;
    if (overId.startsWith("task-")) {
      const overTaskId = Number(overId.replace("task-", ""));
      insertIndex = destTasksSorted.findIndex((t) => t.id === overTaskId);
      if (insertIndex === -1) insertIndex = destTasksSorted.length;
    } else {
      // Dropped on column, append to end (bottom)
      insertIndex = destTasksSorted.length;
    }

    // For same-column move, remove the moving task from consideration
    const listForScoring = destinationColumn.id === sourceColumn.id
      ? destTasksSorted.filter((t) => t.id !== activeTaskId)
      : destTasksSorted;

    // Clamp insertIndex within the list after potential removal
    if (insertIndex > listForScoring.length) insertIndex = listForScoring.length;

    // Compute new integer score
    let newScore: number;
    if (listForScoring.length === 0) {
      newScore = 100;
    } else if (insertIndex === 0) {
      newScore = (listForScoring[0]?.score ?? 0) + 100;
    } else if (insertIndex >= listForScoring.length) {
      const lastScore = listForScoring[listForScoring.length - 1]?.score ?? 0;
      newScore = lastScore - 100;
    } else {
      const prev = listForScoring[insertIndex - 1].score;
      const next = listForScoring[insertIndex].score;
      if (prev - next > 1) {
        newScore = Math.floor((prev + next) / 2);
      } else {
        // No space between neighbors; nudge above prev
        newScore = prev + 1;
      }
    }

    // Dispatch a global event to let the existing listener optimistically update state and persist
    document.dispatchEvent(
      new CustomEvent("task.move", {
        detail: {
          columnId: destinationColumn.id,
          task,
          score: newScore,
        },
      }),
    );
  }, [columns, findColumn]);

  useEffect(() => {
    function onTaskCreatedOrUpdated(ev: Event) {
      const task = (ev as CustomEvent).detail as Task;

      setColumns(prevState => prevState.map(
        c => {
          if (c.id !== task.relatedColumn.id) return c;

          if (!c.tasks.some(t => t.id === task.id))
            return {
              ...c,
              tasks: [...c.tasks, task]
            };

          return {
            ...c,
            tasks: c.tasks.map(t => t.id === task.id ? task : t)
          };
        }
      ))
    }

    function onTaskDeleted(ev: Event) {
      const taskId = (ev as CustomEvent).detail.id;
      setColumns(prevState => prevState.map(
        c => {
          if (!c.tasks.some(t => t.id === taskId)) return c;
          return {
            ...c,
            tasks: c.tasks.filter(t => t.id != taskId)
          }
        }
      ))
    }

    async function onTaskMove(e: Event) {
      const {columnId, task, score} = (e as CustomEvent).detail as {
        columnId: number,
        task: Task,
        score: number | null
      };

      const moveTaskData: { columnId: number; score: number; id: number } = {
        columnId,
        id: task.id,
        score: 0
      };

      setColumns(columns => columns.map(
        c => {
          if (task.relatedColumn.id !== columnId) {
            if (c.id === task.relatedColumn.id) {
              return {
                ...c,
                tasks: c.tasks.filter(t => t.id !== task.id)
              }
            }
            if (c.id === columnId) {
              return {
                ...c,
                tasks: [
                  ...c.tasks,
                  {
                    ...task,
                    relatedColumn: {id: c.id},
                    score:
                      !score ?
                        (function () {
                          const highestScore = c.tasks.length < 1 ? 0 : Math.max(...c.tasks.map(t => t.score))
                          moveTaskData["score"] = highestScore;
                          return highestScore;
                        })() :
                        score
                  }
                ]
              }
            }

            return c;
          }
          return {
            ...c,
            tasks: c.tasks.map(t => {
              moveTaskData["score"] = score!;
              if (t.id === task.id) {
                return {
                  ...t,
                  score: score!
                }
              }
              return t
            })
          };
        }
      ))

      await apiFetch("/api/tasks/move", {
        data: moveTaskData
      })
        .catch(() => {
          toast.error("An error happened when moving the task");
        })
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
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    fetchColumns({searchParams: {projectId: id}});
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
            <KanbanColumn key={column.id} column={column} columns={columns}/>
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
      <TaskModal projectId={id} participants={participants}/>
    </>
  );
});
