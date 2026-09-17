import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { ProjectDetails, ProjectTaskDetails } from "@/api";
import {
  getProjectQueryKey,
  moveProjectTaskMutation,
} from "@/api/@tanstack/react-query.gen";
import { invalidateUserTasks } from "@/lib/query-invalidation";

type MoveCallbacks = {
  onSuccess?: (task: ProjectTaskDetails) => void;
  onError?: () => void;
  onSettled?: () => void;
};

/**
 * The single path a task takes to another column, shared by the drag-and-drop hook and the
 * card menu.
 *
 * Only the *score* differs between the two callers — a drop interpolates between the
 * neighbours it landed amongst, a menu move goes to the top (`scoreAtTopOf`). Everything
 * after that is identical and none of it is obvious: the optimistic write has to move one
 * task rather than rebuild columns, crossing into the last column changes what the
 * dashboard considers open, and it may have made the server mint a recurrence successor
 * that exists in no cache. A second copy of that in the menu would drift.
 */
export function useMoveTask(project: ProjectDetails) {
  const queryClient = useQueryClient();
  const moveTaskMut = useMutation(moveProjectTaskMutation());
  const { columns } = project;

  const moveTask = useCallback(
    (
      task: ProjectTaskDetails,
      destinationColumnId: number,
      score: number,
      callbacks: MoveCallbacks = {},
    ) => {
      const taskId = Number(task.id);
      const queryKey = getProjectQueryKey({
        path: { projectId: Number(project.id) },
      });

      const destinationCol = columns.find(
        (c) => Number(c.id) === destinationColumnId,
      );
      if (!destinationCol) return callbacks.onSettled?.();

      const movedTask: ProjectTaskDetails = {
        ...task,
        columnId: destinationColumnId,
        score,
      };

      // Move just this task between columns rather than rebuilding every column from a
      // drag order: that order only contains the tasks the toolbar filters leave visible,
      // so rebuilding from it would drop the hidden ones out of the cache. Order within
      // each column doesn't matter here — both views re-derive it from `score`.
      const placeTask = (updated: ProjectTaskDetails) =>
        queryClient.setQueryData(
          queryKey,
          (p: ProjectDetails | undefined) =>
            p && {
              ...p,
              columns: p.columns.map((col) => ({
                ...col,
                tasks:
                  Number(col.id) === Number(updated.columnId)
                    ? [
                        ...col.tasks.filter((t) => Number(t.id) !== taskId),
                        updated,
                      ]
                    : col.tasks.filter((t) => Number(t.id) !== taskId),
              })),
            },
        );

      placeTask(movedTask);

      moveTaskMut.mutate(
        {
          path: { projectId: Number(project.id), taskId },
          body: { columnId: destinationColumnId, score },
        },
        {
          onSuccess: (updatedTask) => {
            placeTask(updatedTask);

            // A move can cross the last column, which is the only definition of "done" this
            // app has — so the dashboard's open-task list changes even though nothing here
            // touched its query.
            invalidateUserTasks(queryClient);

            // Completing a recurring task makes the server write the *next* occurrence, and
            // that task exists in no cache: the response describes only the one that moved.
            // Refetch, or the new instance stays invisible until something else happens to
            // reload the board.
            const completedARecurringTask =
              !!task.recurrence &&
              !columns.some(
                (c) => Number(c.score) > Number(destinationCol.score),
              );

            if (completedARecurringTask) {
              queryClient.invalidateQueries({ queryKey });
            }

            callbacks.onSuccess?.(updatedTask);
          },
          onError: () => {
            queryClient.invalidateQueries({ queryKey });
            callbacks.onError?.();
          },
          onSettled: () => callbacks.onSettled?.(),
        },
      );
    },
    [columns, moveTaskMut, project.id, queryClient],
  );

  return { moveTask, isPending: moveTaskMut.isPending };
}
