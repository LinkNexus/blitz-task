import { HubConnectionBuilder, HubConnectionState } from "@microsoft/signalr";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { CurrentUser } from "@/api";
import {
  getProjectQueryKey,
  listNotificationsQueryKey,
} from "@/api/@tanstack/react-query.gen";
import { invalidateUserTasks } from "@/lib/query-invalidation";

type ProjectChangedEvent = { projectId: number; actorId: number | null };

/**
 * Whether a drag is in flight anywhere on the page.
 *
 * A refetch mid-drag is the one thing this feature must not cause: the board's rendered order
 * comes from `useDragNDrop`, and pulling the data out from under an in-progress drag is exactly
 * the jump realtime updates exist to prevent. dnd-kit marks the dragged element, so asking the
 * DOM is both cheap and true across every view without threading state through the layout.
 */
function isDragging() {
  return document.querySelector('[aria-grabbed="true"]') !== null;
}

/**
 * Keeps the open page in step with what other people are doing.
 *
 * Connects once from the layout — the shell never unmounts, so this is a single connection for
 * the session rather than one per route.
 *
 * **It treats a message as a signal, not as data.** The server says a project changed and the
 * client refetches it; nothing here patches the cache from a payload. Applying a remote change
 * by hand would mean a second implementation of the board's optimistic writes, which are subtle
 * enough once (see `use-move-task.ts`).
 */
export function useRealtime(user: CurrentUser | null | undefined) {
  const queryClient = useQueryClient();
  // Read through a ref so a reconnect is never triggered by a re-render — the connection's
  // lifetime is the session's, not this effect's dependencies'.
  const pending = useRef(new Set<number>());

  useEffect(() => {
    if (!user?.emailConfirmed) return;

    const connection = new HubConnectionBuilder()
      .withUrl("/hub/realtime")
      .withAutomaticReconnect()
      .build();

    const refreshProject = (projectId: number) => {
      queryClient.invalidateQueries({
        queryKey: getProjectQueryKey({ path: { projectId } }),
      });
      // The cross-project lists read the same rows through a different key, exactly as they do
      // after a local mutation.
      invalidateUserTasks(queryClient);
    };

    connection.on("projectChanged", (event: ProjectChangedEvent) => {
      const projectId = Number(event.projectId);

      // Your own change, already applied optimistically. Refetching it would be a round trip to
      // confirm what is on screen, and mid-drag it would undo it.
      if (event.actorId !== null && Number(event.actorId) === Number(user.id))
        return;

      if (isDragging()) {
        // Held, not dropped: the board is mid-drag, and the drop is about to write and refetch
        // anyway. Losing the update entirely would leave the other person's change invisible.
        pending.current.add(projectId);
        return;
      }

      refreshProject(projectId);
    });

    connection.on("notificationsChanged", () => {
      queryClient.invalidateQueries({ queryKey: listNotificationsQueryKey() });
    });

    connection.start().catch(() => {
      // Realtime is an enhancement over a page that already worked by refetching on its own.
      // A failed connection is not worth a toast — every query still has its normal triggers.
    });

    const flush = () => {
      if (isDragging() || pending.current.size === 0) return;
      for (const projectId of pending.current) refreshProject(projectId);
      pending.current.clear();
    };

    // The drop itself fires no event this hook can see, so the held updates are flushed on the
    // next pointer release anywhere on the page.
    document.addEventListener("pointerup", flush);

    return () => {
      document.removeEventListener("pointerup", flush);
      if (connection.state !== HubConnectionState.Disconnected)
        connection.stop();
    };
  }, [queryClient, user?.id, user?.emailConfirmed]);
}
