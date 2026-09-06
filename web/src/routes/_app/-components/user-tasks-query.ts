import { z } from "zod";
import { listUserTasksOptions } from "@/api/@tanstack/react-query.gen";

/**
 * The dashboard, Today and Upcoming all read every open task rather than a page of them: the
 * dashboard's stat tiles are counts that a truncated page would quietly under-report, and the
 * other two bucket by date, which a page boundary would cut through. The cap is the endpoint's
 * own ceiling; past it the tiles understate, which ROADMAP L51 fixes with server-side counts.
 *
 * The endpoint orders dated work first and soonest first, so the rows that fall off the end are
 * the furthest-out ones — the least interesting to all three screens.
 */
const TASK_LIMIT = 200;

/**
 * One query for all three views, deliberately: an identical key means navigating between them
 * hits a warm cache instead of refetching the same rows in a slightly different shape. Adding a
 * `dueBefore` per view would have split it into three entries for no gain, since each view
 * filters what it renders anyway.
 */
export const userTasksQueryOptions = (assignedToMe: boolean) =>
  listUserTasksOptions({ query: { assignedToMe, limit: TASK_LIMIT } });

/**
 * Most tasks in a solo project have no assignee at all, so defaulting to "assigned to me" would
 * show an empty page to the app's main use case. Opt in instead.
 */
export const userTasksSearchSchema = z.object({
  assignedToMe: z.boolean().default(false).catch(false),
});
