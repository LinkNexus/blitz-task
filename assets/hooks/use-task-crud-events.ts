import type {Task, TaskColumn} from "@/types.ts";
import {type Dispatch, type RefObject, type SetStateAction, useEffect} from "react";
import {apiFetch} from "@/lib/api-fetch.ts";
import {toast} from "sonner";

export function useTaskCrudEvents(
  setColumns: Dispatch<SetStateAction<TaskColumn[]>>,
  dragSnapshot: RefObject<TaskColumn[] | null>
) {
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
      const {columnId, task, score} = (e as CustomEvent).detail as {
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
                    relatedColumn: {id: c.id},
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
      })
        .then(() => {
          dragSnapshot.current = null;
        })
        .catch(() => {
          toast.error("An error happened when moving the task");
          if (dragSnapshot.current)
            setColumns(dragSnapshot.current);
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
}
