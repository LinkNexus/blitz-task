import {TaskCard} from "@/components/custom/projects/kanban-board/task-card/task-card.tsx";
import {TaskModal} from "@/components/custom/projects/kanban-board/task-modal/task-modal.tsx";
import {useApiFetch} from "@/hooks/use-api-fetch";
import type {Project, Task, TaskColumn} from "@/types";
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
import {memo, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {KanbanColumn} from "./kanban-column";
import {useTaskCrudEvents} from "@/hooks/use-task-crud-events.ts";
import {useColumnsCrudEvents} from "@/hooks/use-columns-crud-events.ts";

type Props = Pick<Project, "id" | "participants">;

export const KanbanBoard = memo(({id, participants}: Props) => {
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

  console.log(columns.map(c => c.score));

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

  // Keep a snapshot to restore state on cancel
  const dragSnapshot = useRef<TaskColumn[] | null>(null);

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

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const {active} = event;
      const activeData = active.data.current;

      // snapshot columns for potential cancel restoration
      dragSnapshot.current = columns;

      if (activeData?.type === "task") {
        setActiveTask(activeData.task as Task);
      }
    },
    [columns]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const {active, over} = event;

      setActiveTask(null);
      if (!over) {
        // restore snapshot if drag was canceled
        if (dragSnapshot.current) setColumns(dragSnapshot.current);
        dragSnapshot.current = null;
        return;
      }

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
        if (list.length === 0) return 1000;
        if (index === 0) return (list[0]?.score ?? 0) + 1000; // above top
        if (index >= list.length)
          return (list[list.length - 1]?.score ?? 0) - 1000; // below bottom
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

  useTaskCrudEvents(setColumns, dragSnapshot);
  useColumnsCrudEvents(setColumns);

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
        <div className="flex gap-3 sm:gap-6 min-h-[500px] sm:min-h-[600px] max-w-full">
          {sortedColumns.map((column) => (
            <KanbanColumn key={column.id} projectId={id} column={column} sortedColumns={sortedColumns}/>
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

