import type { QueryClient } from "@tanstack/react-query";
import {
  listProjectsQueryKey,
  listUserTasksQueryKey,
} from "@/api/@tanstack/react-query.gen";

/**
 * Drops the cross-project task list behind the dashboard after a mutation that changes a task.
 *
 * Every task mutation writes its result straight into the *project* query with `setQueryData`,
 * which leaves this list untouched — and it is a different shape of the same rows, so nothing
 * else refreshes it. Nothing but the query's own staleness used to save it, and `staleTime` in
 * `main.tsx` is now 30s rather than 0, so a task created and then looked for on the dashboard
 * would be missing.
 *
 * Called with no options on purpose. The generated key is a one-element array whose object
 * carries the request's `query`/`path`, and React Query matches it deep-partially, so the bare
 * key is a prefix that invalidates every parameterisation of the list — `assignedToMe` and
 * every `limit` alike.
 */
export function invalidateUserTasks(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: listUserTasksQueryKey() });
}

/**
 * Drops the cross-project lists — the sidebar's project list and the dashboard's task list —
 * after a mutation that changes which projects exist or what they are called.
 *
 * Needed because the sidebar lives in the `_app` layout and therefore **never unmounts**: a
 * route component refetches when you navigate back to it, but the sidebar would keep showing a
 * deleted project until a full reload, and clicking it 404s.
 */
export function invalidateProjectLists(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: listProjectsQueryKey() }),
    invalidateUserTasks(queryClient),
  ]);
}
