using BlitzTask.Backend.Features.Activity;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Notifications;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Extensions;
using BlitzTask.Backend.Infrastructure.Filters;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.ProjectTasks
{
    /// <summary>
    /// Doing one thing to many tasks at once (L38).
    /// <para>
    /// <b>Endpoints rather than a loop in the client, and that is the whole point.</b> The same
    /// work done as N calls to the single-task routes is N transactions that can half-fail, N
    /// realtime pushes, and N round trips; here it is one <c>SaveChanges</c>, so the batch
    /// commits or does not, and <see cref="RealtimePublishInterceptor"/> sends one message
    /// however many tasks moved.
    /// </para>
    /// <para>
    /// <b>An id that does not match is ignored, not an error.</b> A selection is made against
    /// what was on screen, and by the time it is submitted a task may have been filed elsewhere
    /// or trashed by someone else. Failing the whole batch over one stale id would be the
    /// wrong trade, so the handlers report what they actually changed
    /// (<see cref="BulkTaskResult"/>) and the caller can say so.
    /// </para>
    /// </summary>
    public static class BulkTasksEndpoints
    {
        public static IEndpointRouteBuilder MapBulkTasksEndpoints(this IEndpointRouteBuilder app)
        {
            var group = app.MapGroup("/api/{projectId:int}/tasks/bulk")
                .WithTags("Bulk Task Operations")
                .RequireAuthorization("EmailConfirmed")
                .AddEndpointFilter(
                    new RequireProjectPermissionFilter(ProjectPermission.ManageTasks)
                );

            group
                .MapPatch("/move", BulkMoveTasks)
                .WithName("bulk-move-tasks")
                .AddEndpointFilter(ValidationFilter<BulkMoveTasksRequest>.Body())
                .Produces<BulkTaskResult>()
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound)
                .Produces<ValidationErrors>(StatusCodes.Status422UnprocessableEntity);

            group
                .MapPatch("/assignees", BulkAssignTasks)
                .WithName("bulk-assign-tasks")
                .AddEndpointFilter(ValidationFilter<BulkAssignTasksRequest>.Body())
                .Produces<BulkTaskResult>()
                .Produces<ValidationErrors>(StatusCodes.Status422UnprocessableEntity);

            group
                .MapPatch("/tags", BulkTagTasks)
                .WithName("bulk-tag-tasks")
                .AddEndpointFilter(ValidationFilter<BulkTagTasksRequest>.Body())
                .Produces<BulkTaskResult>()
                .Produces<ValidationErrors>(StatusCodes.Status422UnprocessableEntity);

            group
                .MapPost("/delete", BulkDeleteTasks)
                .WithName("bulk-delete-tasks")
                .AddEndpointFilter(ValidationFilter<BulkDeleteTasksRequest>.Body())
                .Produces<BulkTaskResult>()
                .Produces<ValidationErrors>(StatusCodes.Status422UnprocessableEntity);

            return app;
        }

        public static async Task<
            Results<Ok<BulkTaskResult>, NotFound<ApiMessageResponse>>
        > BulkMoveTasks(
            int projectId,
            BulkMoveTasksRequest request,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var column = await dbContext
                .ProjectColumns.Where(c => c.Id == request.ColumnId && c.ProjectId == projectId)
                .FirstOrDefaultAsync(cancellationToken);

            if (column is null)
                return TypedResults.NotFound(new ApiMessageResponse("Column not found"));

            // Every Include here is for SpawnNextOccurrenceAsync, which copies these collections
            // onto the successor. Without them a bulk complete would mint an occurrence with no
            // assignees, no checklist and no reminders — and the series would keep running that
            // way, since each occurrence is copied from the last.
            var tasks = await dbContext
                .ProjectTasks.Where(t =>
                    t.RelatedProjectId == projectId && request.TaskIds.Contains(t.Id)
                )
                .Include(t => t.Assignees)
                .Include(t => t.ChecklistItems)
                .Include(t => t.Reminders)
                .Include(t => t.Recurrence)
                .ToListAsync(cancellationToken);

            if (tasks.Count == 0)
                return TypedResults.Ok(new BulkTaskResult(0, 0));

            var columnNames = await dbContext
                .ProjectColumns.Where(c => c.ProjectId == projectId)
                .ToDictionaryAsync(c => c.Id, c => c.Name, cancellationToken);

            // A bulk move has no visible neighbours to interpolate between — the same problem
            // `PATCH /api/tasks/{id}/project` has, and the same answer: score it server-side, at
            // the top of the target column. The maximum deliberately excludes the selection, or
            // a task already sitting at the top of that column would be measured against itself.
            var maxScore =
                await dbContext
                    .ProjectTasks.Where(t =>
                        t.RelatedColumnId == column.Id && !request.TaskIds.Contains(t.Id)
                    )
                    .Select(t => (float?)t.Score)
                    .MaxAsync(cancellationToken)
                ?? 0f;

            var isLastColumn = !await dbContext.ProjectColumns.AnyAsync(
                c => c.ProjectId == projectId && c.Score > column.Score,
                cancellationToken
            );

            var user = context.GetUser();

            // Tasks render highest score first, so walking the selection in that order and
            // handing out descending scores keeps their relative order as it was on screen.
            var ordered = tasks.OrderByDescending(t => t.Score).ToList();

            for (var i = 0; i < ordered.Count; i++)
            {
                var task = ordered[i];
                var changedColumn = task.RelatedColumnId != column.Id;
                var fromColumnName = columnNames.GetValueOrDefault(task.RelatedColumnId);

                task.RelatedColumnId = column.Id;
                task.Score = maxScore + (ordered.Count - i) * 1000f;

                if (isLastColumn)
                {
                    await ProjectTasksEndpoints.SpawnNextOccurrenceAsync(
                        task,
                        dbContext,
                        cancellationToken
                    );
                }

                // Same rule as a drag: reordering within a column is not news, only leaving one
                // is. A bulk move is exactly where a feed would otherwise fill with noise.
                if (changedColumn)
                {
                    ActivityRecorder.RecordTask(
                        dbContext,
                        user,
                        task,
                        isLastColumn ? ActivityKind.TASK_COMPLETED : ActivityKind.TASK_MOVED,
                        fromColumnName,
                        column.Name
                    );
                }
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            return TypedResults.Ok(new BulkTaskResult(ordered.Count, 0));
        }

        public static async Task<Ok<BulkTaskResult>> BulkAssignTasks(
            int projectId,
            BulkAssignTasksRequest request,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var tasks = await dbContext
                .ProjectTasks.Where(t =>
                    t.RelatedProjectId == projectId && request.TaskIds.Contains(t.Id)
                )
                .Include(t => t.Assignees)
                .ToListAsync(cancellationToken);

            if (tasks.Count == 0)
                return TypedResults.Ok(new BulkTaskResult(0, 0));

            // Only people who are actually on the project. Assigning an outsider would put the
            // task on a "assigned to me" list they cannot open — the same reason FileTask drops
            // assignees who are not participants of the project it files into.
            var participantIds = await dbContext
                .ProjectParticipants.Where(pp =>
                    pp.ProjectId == projectId && request.AssigneeIds.Contains(pp.UserId)
                )
                .Select(pp => pp.UserId)
                .ToListAsync(cancellationToken);

            var users = await dbContext
                .Users.Where(u => participantIds.Contains(u.Id))
                .ToListAsync(cancellationToken);

            var user = context.GetUser();

            foreach (var task in tasks)
            {
                // Diffed rather than read off the result, so someone already on a task is not
                // told again that they have been assigned it.
                var before = task.Assignees.Select(a => a.Id).ToHashSet();

                task.Assignees = request.Mode switch
                {
                    BulkEditMode.Add =>
                    [
                        .. task.Assignees,
                        .. users.Where(u => !before.Contains(u.Id)),
                    ],
                    // Removal works off the requested ids, not the participant-filtered ones:
                    // taking someone off a task must keep working after they have left the
                    // project, which is exactly when you would want to.
                    BulkEditMode.Remove =>
                    [
                        .. task.Assignees.Where(a => !request.AssigneeIds.Contains(a.Id)),
                    ],
                    _ => [.. users],
                };

                NotificationRecorder.NotifyAboutTask(
                    dbContext,
                    user,
                    task,
                    NotificationKind.TASK_ASSIGNED,
                    task.Assignees.Select(a => a.Id).Where(id => !before.Contains(id))
                );
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            return TypedResults.Ok(new BulkTaskResult(tasks.Count, 0));
        }

        public static async Task<Ok<BulkTaskResult>> BulkTagTasks(
            int projectId,
            BulkTagTasksRequest request,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var tasks = await dbContext
                .ProjectTasks.Where(t =>
                    t.RelatedProjectId == projectId && request.TaskIds.Contains(t.Id)
                )
                .ToListAsync(cancellationToken);

            var affected = 0;
            var skipped = 0;

            foreach (var task in tasks)
            {
                List<string> next;

                switch (request.Mode)
                {
                    case BulkEditMode.Add:
                        next = [.. task.Tags, .. request.Tags.Where(t => !task.Tags.Contains(t))];

                        // The cap is per task, so a bulk add can push one over it while leaving
                        // the rest fine. Refused rather than truncated: truncating would drop a
                        // tag the task already had, which is destroying data to satisfy a
                        // request that never mentioned it.
                        if (next.Count > ProjectTask.MaxTagsCount)
                        {
                            skipped++;
                            continue;
                        }
                        break;

                    case BulkEditMode.Remove:
                        next = [.. task.Tags.Where(t => !request.Tags.Contains(t))];
                        break;

                    default:
                        next = [.. request.Tags];
                        break;
                }

                if (next.Count == task.Tags.Count && next.All(task.Tags.Contains))
                    continue;

                task.Tags = next;
                affected++;
            }

            if (affected > 0)
                await dbContext.SaveChangesAsync(cancellationToken);

            return TypedResults.Ok(new BulkTaskResult(affected, skipped));
        }

        public static async Task<Ok<BulkTaskResult>> BulkDeleteTasks(
            int projectId,
            BulkDeleteTasksRequest request,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var tasks = await dbContext
                .ProjectTasks.Where(t =>
                    t.RelatedProjectId == projectId && request.TaskIds.Contains(t.Id)
                )
                .ToListAsync(cancellationToken);

            if (tasks.Count == 0)
                return TypedResults.Ok(new BulkTaskResult(0, 0));

            var user = context.GetUser();

            // One instant across the batch, matching how a cascade stamps a parent and its
            // children — it is what lets "these went to the trash together" be answerable later.
            var deletedAt = DateTime.UtcNow;

            foreach (var task in tasks)
            {
                // Attachments stay on disk until the purge, exactly as in DeleteTask: a restore
                // has to give back a task whose files still open.
                task.DeletedAt = deletedAt;
                ActivityRecorder.RecordTask(dbContext, user, task, ActivityKind.TASK_DELETED);
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            return TypedResults.Ok(new BulkTaskResult(tasks.Count, 0));
        }
    }
}
