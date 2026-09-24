import type {
  ProjectDetails,
  ProjectTaskDetails,
  TaskDependencyLink,
} from "@/api";

/**
 * Whether a column is the one that means "done".
 *
 * Completion is a *position* in this app — the last column — which is why the server sends a
 * blocker's `columnId` rather than deciding for us: the rule already lives here, and a second
 * copy on the server would be one projection away from disagreeing with this one.
 */
export function isCompletedColumn(
  columnId: number | string,
  project: ProjectDetails,
): boolean {
  if (project.columns.length === 0) return false;

  const maxScore = Math.max(...project.columns.map((c) => Number(c.score)));
  const column = project.columns.find((c) => String(c.id) === String(columnId));

  return !!column && Number(column.score) === maxScore;
}

/**
 * The blockers of `task` that are not finished yet.
 *
 * A trashed blocker never reaches here — the server's soft-delete filter drops it from the
 * projection — so anything in this list is a live task somebody still has to do.
 */
export function openBlockers(
  task: Pick<ProjectTaskDetails, "blockedBy">,
  project: ProjectDetails,
): TaskDependencyLink[] {
  return task.blockedBy.filter(
    (blocker) => !isCompletedColumn(blocker.columnId, project),
  );
}
