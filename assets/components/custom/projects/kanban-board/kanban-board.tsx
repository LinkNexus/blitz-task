import {useApiFetch} from "@/hooks/use-api-fetch";
import type {Project, Task, TaskColumn} from "@/types";
import {memo, useCallback, useEffect, useMemo, useState} from "react";
import {KanbanColumn} from "./kanban-column";
import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {sortableKeyboardCoordinates} from "@dnd-kit/sortable";
import {TaskCard} from "@/components/custom/projects/kanban-board/task-card/task-card.tsx";
import {TaskModal} from "@/components/custom/projects/kanban-board/task-modal/task-modal.tsx";

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

  const handleDragOver = useCallback((event: DragOverEvent) => {
    console.log(event);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    console.log(event);
  }, []);

  useEffect(() => {
    function onTaskCreatedOrUpdated(ev: Event) {
      const task = (ev as CustomEvent).detail as Task;

      setColumns(prevState => prevState.map(
        c => {
          if (c.id === task.relatedColumn.id) {
            if (c.tasks.some(t => t.id === task.id)) {
              return {
                ...c,
                tasks: c.tasks.map(
                  t => t.id === task.id ? task : t
                )
              }
            }
            return {...c, tasks: [...c.tasks, task]}
          }
          return c;
        }
      ))
    }

    document.addEventListener("task.created", onTaskCreatedOrUpdated);

    return () => {
      document.removeEventListener("task.created", onTaskCreatedOrUpdated);
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
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
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
      <TaskModal
        columns={columns} participants={participants}/>
    </>
  );
});
