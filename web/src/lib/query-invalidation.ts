import type { QueryClient } from "@tanstack/react-query";
import {
  listProjectsQueryKey,
  listUserTasksQueryKey,
} from "@/api/@tanstack/react-query.gen";

/**
 * Drops the cross-project lists — the sidebar's project list and the dashboard's task list —
 * after a mutation that changes which projects exist or what they are called.
 *
 * Needed because the sidebar lives in the `_app` layout and therefore **never unmounts**: with
 * the default `staleTime` of 0 the dashboard refetches whenever you navigate back to it, but
 * the sidebar would keep showing a deleted project until a full reload, and clicking it 404s.
 *
 * Called with no options on purpose. The generated key is a one-element array whose object
 * carries the request's `query`/`path`, and React Query matches it deep-partially, so the
 * bare key is a prefix that invalidates every parameterisation of these two lists.
 */
export function invalidateProjectLists(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: listProjectsQueryKey() }),
    queryClient.invalidateQueries({ queryKey: listUserTasksQueryKey() }),
  ]);
}
