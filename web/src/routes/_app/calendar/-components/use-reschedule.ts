import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import type { CalendarItem } from "@/api";
import { rescheduleUserTaskMutation } from "@/api/@tanstack/react-query.gen";
import { invalidateUserTasks } from "@/lib/query-invalidation";
import { calendarQuery } from "./calendar-query";

/**
 * Moving a task's deadline by dropping it on another day.
 *
 * Deliberately not the board's `useMoveTask`, and it is worth being clear why they stay apart:
 * a drop on a board encodes a *position* and PATCHes a score, a drop on a calendar encodes a
 * *date* and touches no position at all. Sharing a hook would mean one call that sometimes means
 * neither.
 */
export function useRescheduleTask(month: Date) {
  const queryClient = useQueryClient();
  const mutation = useMutation(rescheduleUserTaskMutation());
  const queryKey = calendarQuery(month).queryKey;

  const reschedule = useCallback(
    (item: CalendarItem, dueDate: Date) => {
      // A projected occurrence has no row to write a date onto, and a Viewer may look at work
      // they cannot edit. Both are already un-draggable in the grid; this is the backstop that
      // means a future caller cannot make the request by accident.
      if (item.taskId === null || !item.canReschedule) return;

      const previousDue = new Date(item.dueDate);
      if (previousDue.getTime() === dueDate.getTime()) return;

      const delta = dueDate.getTime() - previousDue.getTime();
      // Ids arrive as `number | string` from the generated client, the same coercion the board
      // does everywhere.
      const taskId = Number(item.taskId);

      // A prediction of what the server will do, not a second definition of it: the span
      // travelling with the deadline is the endpoint's rule, and the refetch below is what
      // makes this only ever a few hundred milliseconds of optimism.
      queryClient.setQueryData(queryKey, (items: CalendarItem[] | undefined) =>
        items?.map((i) =>
          i.taskId !== null && Number(i.taskId) === taskId
            ? {
                ...i,
                dueDate: dueDate.toISOString(),
                startDate: i.startDate
                  ? new Date(
                      new Date(i.startDate).getTime() + delta,
                    ).toISOString()
                  : i.startDate,
              }
            : i,
        ),
      );

      mutation.mutate(
        { path: { taskId }, body: { dueDate: dueDate.toISOString() } },
        {
          onSuccess: () => {
            // The due-date buckets on the dashboard, Today and Upcoming are exactly what just
            // changed, and they read the same rows through a different query.
            invalidateUserTasks(queryClient);
          },
          onError: () => toast.error("Failed to reschedule"),
          // Always, not just on failure. Moving a recurring task moves every occurrence
          // projected after it (L25 anchors the next on the previous due date), and those are
          // computed server-side on purpose — there is nothing here that could shift them.
          onSettled: () => queryClient.invalidateQueries({ queryKey }),
        },
      );
    },
    [mutation, queryClient, queryKey],
  );

  return { reschedule };
}
