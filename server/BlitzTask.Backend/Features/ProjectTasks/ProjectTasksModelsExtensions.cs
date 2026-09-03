using BlitzTask.Backend.Features.Attachments;

namespace BlitzTask.Backend.Features.ProjectTasks
{
    public static class ProjectTasksModelsExtensions
    {
        public static ProjectTaskDetails ToProjectTasksDetails(this ProjectTask task)
        {
            return new ProjectTaskDetails(
                task.Id,
                task.Name,
                task.Description,
                task.Priority,
                task.Score,
                task.Tags,
                task.StartDate,
                task.DueDate,
                task.CreatedAt,
                task.UpdatedAt,
                [.. task.Assignees.Select(a => a.Id)],
                [.. task.Attachments.Select(a => new AttachmentMetadata(
                    a.Id, a.OriginalFilename, a.ContentType, a.SizeInBytes, a.CreatedAt
                ))],
                task.RelatedColumnId
            );
        }

        /// <summary>
        /// Projects tasks as cross-project list rows, restricted to projects the given user
        /// participates in. Membership is the authorization — there is no
        /// RequireProjectPermissionFilter to run because the query spans every project at once,
        /// so a project the user is not in simply contributes no rows.
        /// </summary>
        public static IQueryable<UserTaskSummary> SelectUserTaskSummariesFor(
            this IQueryable<ProjectTask> tasks,
            int userId
        )
        {
            return tasks
                .Where(t => t.RelatedProject.Participants.Any(pp => pp.UserId == userId))
                .Select(t => new UserTaskSummary(
                    t.Id,
                    t.Name,
                    t.Description,
                    t.Priority,
                    t.Tags,
                    t.StartDate,
                    t.DueDate,
                    t.CreatedAt,
                    t.UpdatedAt,
                    t.Assignees.Select(a => a.Id).ToList(),
                    t.RelatedProjectId,
                    t.RelatedProject.Name,
                    t.RelatedColumnId,
                    t.RelatedColumn.Name,
                    t.RelatedColumn.Color,
                    // There is no "done" flag on a task — the board expresses completion as
                    // position, so a task is done once it sits in its project's last
                    // (highest-score) column. Inlined rather than factored into a helper because
                    // this runs inside an expression tree: EF cannot translate a method call.
                    // Kept identical to IncompleteTasks below and to the frontend's overdue test.
                    !t.RelatedProject.Columns.Any(c => c.Score > t.RelatedColumn.Score)
                ));
        }

        /// <summary>
        /// The complement of the IsCompleted projection above: tasks that are *not* in their
        /// project's last column. Applied before the projection because EF cannot filter on a
        /// computed member of an already-projected record.
        /// </summary>
        public static IQueryable<ProjectTask> IncompleteTasks(this IQueryable<ProjectTask> tasks) =>
            tasks.Where(t => t.RelatedProject.Columns.Any(c => c.Score > t.RelatedColumn.Score));

        /// <summary>
        /// Dashboard order: dated work first and soonest first, because an undated task has no
        /// claim on today; priority then separates the undated tail, which is otherwise an
        /// arbitrary pile.
        /// <para>
        /// Applied to the entity queryable, before the projection — sorting an already-projected
        /// record asks EF to ORDER BY a member of a constructed object, which it cannot
        /// translate. The due-date keys only work in SQL at all because
        /// <see cref="Infrastructure.Data.UtcDateTimeOffsetConverter"/> stores them as UTC.
        /// </para>
        /// </summary>
        public static IQueryable<ProjectTask> InDashboardOrder(this IQueryable<ProjectTask> tasks) =>
            tasks
                .OrderBy(t => t.DueDate == null)
                .ThenBy(t => t.DueDate)
                .ThenByDescending(t => t.Priority)
                .ThenByDescending(t => t.UpdatedAt);
    }
}
