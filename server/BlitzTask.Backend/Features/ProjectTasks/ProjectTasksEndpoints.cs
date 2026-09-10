using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Extensions;
using BlitzTask.Backend.Infrastructure.Filters;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.ProjectTasks
{
    public static class ProjectTasksEndpoints
    {
        public static IEndpointRouteBuilder MapProjectTasksEndpoints(this IEndpointRouteBuilder app)
        {
            var group = app.MapGroup("/api/{projectId:int}/tasks")
                .WithTags("Project Tasks")
                .RequireAuthorization("EmailConfirmed");

            group
                .MapPost("/{columnId:int}/create", CreateTask)
                .WithName("create-project-task")
                .AddEndpointFilter(
                    new RequireProjectPermissionFilter(ProjectPermission.ManageTasks)
                )
                .AddEndpointFilter(ValidationFilter<CreateProjectTaskRequest>.Body())
                .Produces<ProjectTaskDetails>(StatusCodes.Status201Created)
                .Produces<ValidationErrors>(StatusCodes.Status422UnprocessableEntity);

            group
                .MapGet("/{taskId:int}", GetTask)
                .WithName("get-project-task")
                .AddEndpointFilter(new RequireProjectPermissionFilter())
                .Produces<ProjectTaskDetails>()
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound);

            group
                .MapPut("/{taskId:int}", UpdateTask)
                .WithName("update-project-task")
                .AddEndpointFilter(
                    new RequireProjectPermissionFilter(ProjectPermission.ManageTasks)
                )
                .AddEndpointFilter(ValidationFilter<UpdateProjectTaskRequest>.Body())
                .Produces<ProjectTaskDetails>()
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound)
                .Produces<ValidationErrors>(StatusCodes.Status422UnprocessableEntity);

            group
                .MapPatch("/{taskId:int}/move", MoveTask)
                .WithName("move-project-task")
                .AddEndpointFilter(
                    new RequireProjectPermissionFilter(ProjectPermission.ManageTasks)
                )
                .Produces<ProjectTaskDetails>()
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound);

            group
                .MapDelete("/{taskId:int}", DeleteTask)
                .WithName("delete-project-task")
                .AddEndpointFilter(
                    new RequireProjectPermissionFilter(ProjectPermission.ManageTasks)
                )
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound);

            // Cross-project queries live outside the group above: there is no single projectId
            // to run RequireProjectPermissionFilter against, so membership is enforced inside
            // the query instead. The other group's `:int` constraint means the literal "tasks"
            // can never bind as a projectId, so the two routes cannot collide.
            var userTasks = app.MapGroup("/api/tasks")
                .WithTags("Tasks")
                .RequireAuthorization("EmailConfirmed");

            userTasks
                .MapGet("", ListUserTasks)
                .WithName("list-user-tasks")
                .Produces<List<UserTaskSummary>>();

            userTasks
                .MapPatch("/{taskId:int}/project", FileTask)
                .WithName("file-user-task")
                .Produces<UserTaskSummary>()
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound)
                .Produces<ApiMessageResponse>(StatusCodes.Status403Forbidden);

            return app;
        }

        public static async Task<Ok<List<UserTaskSummary>>> ListUserTasks(
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken,
            bool assignedToMe = false,
            bool includeCompleted = false,
            DateTimeOffset? dueBefore = null,
            int? projectId = null,
            int limit = 50
        )
        {
            var user = context.GetUser();
            var query = dbContext.ProjectTasks.AsQueryable();

            if (projectId.HasValue)
                query = query.Where(t => t.RelatedProjectId == projectId.Value);

            if (assignedToMe)
                query = query.Where(t => t.Assignees.Any(a => a.Id == user.Id));

            if (dueBefore.HasValue)
                query = query.Where(t => t.DueDate != null && t.DueDate <= dueBefore.Value);

            if (!includeCompleted)
                query = query.IncompleteTasks();

            // Filtering, ordering and the limit all run in SQL. That is only true because
            // UtcDateTimeOffsetConverter normalises due dates to UTC on the way in — against a
            // bare DateTimeOffset, SQLite cannot ORDER BY at all and the WHERE above would be a
            // text comparison that is right only while every row shares an offset.
            var tasks = await query
                .InDashboardOrder()
                .SelectUserTaskSummariesFor(user.Id)
                .Take(Math.Clamp(limit, 1, MaxUserTaskPageSize))
                .ToListAsync(cancellationToken);

            return TypedResults.Ok(tasks);
        }

        private static IEnumerable<int> DistinctOffsets(List<int>? minutes) =>
            (minutes ?? []).Where(m => m > 0).Distinct();

        /// <summary>
        /// Brings the caller's reminders on a task in line with the offsets they submitted.
        /// <para>
        /// Reconciled rather than deleted-and-recreated, which is the whole point: a rebuilt row
        /// comes back with <c>SentAt</c> null, and an already-fired reminder that looks unfired
        /// is one the sweep will send again. Saving a task must not re-send yesterday's email.
        /// </para>
        /// <para>
        /// Scoped to one user in both directions — reminders are private, so another member's
        /// are neither read nor removed here.
        /// </para>
        /// </summary>
        private static void SyncReminders(ProjectTask task, int userId, List<int>? minutes)
        {
            var desired = DistinctOffsets(minutes).ToHashSet();
            var mine = task.Reminders.Where(r => r.UserId == userId).ToList();

            foreach (var reminder in mine.Where(r => !desired.Contains(r.MinutesBeforeDue)))
                task.Reminders.Remove(reminder);

            foreach (var offset in desired.Where(o => !mine.Any(r => r.MinutesBeforeDue == o)))
            {
                task.Reminders.Add(
                    new TaskReminder
                    {
                        UserId = userId,
                        MinutesBeforeDue = offset,
                        // Re-derived by the caller's loop; set here so the row is never briefly
                        // valid-looking with a default firing time.
                        RemindAt = TaskReminder.ResolveRemindAt(task.DueDate!.Value, offset),
                    }
                );
            }
        }

        /// <summary>
        /// Brings a task's checklist in line with the submitted list — inserting items that
        /// arrived without an id, deleting the ones no longer present, and renumbering the rest
        /// into the order they were sent in.
        /// <para>
        /// The ticked state is never read from the request and never written here. That is the
        /// whole reason items carry an id: matching on it lets an existing row keep its
        /// <c>IsDone</c>, so a save made from a sheet that was opened before someone ticked
        /// something cannot untick it. Delete-and-recreate would clear the lot on every save.
        /// </para>
        /// <para>
        /// Blank text is dropped rather than rejected: it means a row the user started and left
        /// empty, and failing the whole save over it would lose the edits around it.
        /// </para>
        /// </summary>
        private static void SyncChecklist(ProjectTask task, List<ChecklistItemInput>? items)
        {
            var submitted = (items ?? [])
                .Where(i => !string.IsNullOrWhiteSpace(i.Text))
                .ToList();

            var keptIds = submitted.Where(i => i.Id.HasValue).Select(i => i.Id!.Value).ToHashSet();

            foreach (var item in task.ChecklistItems.Where(c => !keptIds.Contains(c.Id)).ToList())
                task.ChecklistItems.Remove(item);

            for (var position = 0; position < submitted.Count; position++)
            {
                var input = submitted[position];
                var existing = input.Id.HasValue
                    ? task.ChecklistItems.FirstOrDefault(c => c.Id == input.Id.Value)
                    : null;

                if (existing is null)
                {
                    task.ChecklistItems.Add(
                        new TaskChecklistItem { Text = input.Text.Trim(), Position = position }
                    );
                    continue;
                }

                existing.Text = input.Text.Trim();
                existing.Position = position;
            }
        }

        // A dashboard widget shows a handful of rows; the cap exists so a malformed `limit`
        // cannot turn this into a full table scan serialised over the wire.
        private const int MaxUserTaskPageSize = 200;

        /// <summary>
        /// Moves a task to another project — what makes the Inbox a staging area rather than a
        /// place captures go to die.
        /// <para>
        /// Cross-project, so it cannot live under <c>/api/projects/{projectId}</c> and cannot use
        /// <see cref="RequireProjectPermissionFilter"/>: there are two projects to authorise, not
        /// one. Both are checked here, and — as in that filter — a project the caller does not
        /// participate in reads as "not found" rather than "forbidden", so the endpoint cannot be
        /// used to discover which project ids exist.
        /// </para>
        /// <para>
        /// The score is computed server-side rather than taken from the caller like
        /// <c>/move</c> does, because "file this somewhere I am not currently looking at" has no
        /// visible neighbours to interpolate between.
        /// </para>
        /// </summary>
        public static async Task<IResult> FileTask(
            int taskId,
            FileTaskRequest request,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();

            var task = await dbContext
                .ProjectTasks.Include(t => t.Assignees)
                .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);

            if (task is null)
                return Results.NotFound(new ApiMessageResponse("Task not found."));

            var roles = await dbContext
                .ProjectParticipants.Where(pp =>
                    pp.UserId == user.Id
                    && (pp.ProjectId == task.RelatedProjectId || pp.ProjectId == request.ProjectId)
                )
                .ToDictionaryAsync(pp => pp.ProjectId, pp => pp.Role, cancellationToken);

            if (!roles.TryGetValue(task.RelatedProjectId, out var sourceRole))
                return Results.NotFound(new ApiMessageResponse("Task not found."));

            if (!roles.TryGetValue(request.ProjectId, out var targetRole))
                return Results.NotFound(new ApiMessageResponse("Project not found."));

            if (
                !sourceRole.HasPermission(ProjectPermission.ManageTasks)
                || !targetRole.HasPermission(ProjectPermission.ManageTasks)
            )
            {
                return Results.Json(
                    new ApiMessageResponse(
                        "You do not have permission to do this action or access this resource"
                    ),
                    statusCode: StatusCodes.Status403Forbidden
                );
            }

            var column = request.ColumnId is int columnId
                ? await dbContext.ProjectColumns.FirstOrDefaultAsync(
                    c => c.Id == columnId && c.ProjectId == request.ProjectId,
                    cancellationToken
                )
                : await dbContext
                    .ProjectColumns.Where(c => c.ProjectId == request.ProjectId)
                    .OrderBy(c => c.Score)
                    .FirstOrDefaultAsync(cancellationToken);

            if (column is null)
                return Results.NotFound(new ApiMessageResponse("Project column was not found"));

            var maxScore =
                await dbContext
                    .ProjectTasks.Where(t => t.RelatedColumnId == column.Id)
                    .Select(t => (float?)t.Score)
                    .MaxAsync(cancellationToken)
                ?? 0f;

            task.RelatedProjectId = request.ProjectId;
            task.RelatedColumnId = column.Id;
            task.Score = maxScore + 1000f;

            // An assignee who is not in the target project keeps an assignment they can no
            // longer see: the task leaves their board but stays in their "assigned to me" list,
            // and nothing they can reach would let them hand it back.
            var targetParticipantIds = await dbContext
                .ProjectParticipants.Where(pp => pp.ProjectId == request.ProjectId)
                .Select(pp => pp.UserId)
                .ToListAsync(cancellationToken);

            foreach (
                var assignee in task
                    .Assignees.Where(a => !targetParticipantIds.Contains(a.Id))
                    .ToList()
            )
            {
                task.Assignees.Remove(assignee);
            }

            await dbContext.SaveChangesAsync(cancellationToken);

            var summary = await dbContext
                .ProjectTasks.Where(t => t.Id == task.Id)
                .SelectUserTaskSummariesFor(user.Id)
                .FirstAsync(cancellationToken);

            return Results.Ok(summary);
        }

        public static async Task<
            Results<JsonHttpResult<ProjectTaskDetails>, NotFound<ApiMessageResponse>>
        > CreateTask(
            int projectId,
            int columnId,
            [FromForm] CreateProjectTaskRequest request,
            ApplicationDbContext dbContext,
            HttpContext context,
            IFileService fileService,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();
            var project = await dbContext.Projects.FindAsync([projectId], cancellationToken);
            if (project is null)
                return TypedResults.NotFound(new ApiMessageResponse("Project not found"));

            var column = await dbContext
                .ProjectColumns.Where(c => c.Id == columnId && c.ProjectId == projectId)
                .FirstOrDefaultAsync(cancellationToken);

            if (column is null)
            {
                return TypedResults.NotFound(
                    new ApiMessageResponse("Project column was not found")
                );
            }

            List<Attachment> attachments = [];
            if (request.Attachments is not null)
            {
                foreach (var attachment in request.Attachments)
                {
                    var uploadRes = await fileService.UploadFileAsync(
                        attachment,
                        "attachments",
                        user.Id,
                        null,
                        cancellationToken
                    );

                    if (uploadRes.Success && uploadRes.Attachment is not null)
                    {
                        attachments.Add(uploadRes.Attachment);
                    }
                }
            }

            List<User> assignees = [];
            if (request.AssigneeIds is not null)
            {
                assignees = await dbContext
                    .Users.Where(u => request.AssigneeIds.Contains(u.Id))
                    .ToListAsync(cancellationToken);
            }

            var maxScore =
                await dbContext
                    .ProjectTasks.Where(t => t.RelatedColumnId == columnId)
                    .Select(t => (float?)t.Score)
                    .MaxAsync(cancellationToken)
                ?? 0f;

            var task = new ProjectTask
            {
                Name = request.Name,
                Description = request.Description,
                RelatedColumnId = columnId,
                RelatedProjectId = projectId,
                Score = maxScore + 1000f,
                StartDate = request.StartDate,
                DueDate = request.DueDate,
                Attachments = attachments,
                Assignees = assignees,
                Priority = request.Priority,
                Tags = request.Tags ?? [],
                // Set here rather than by a follow-up call to the reminders endpoint: that one
                // needs an id, so the task would have to be saved first, and a failure between
                // the two would leave a task whose reminder the user believes they set.
                Reminders = request.DueDate is null
                    ? []
                    :
                    [
                        .. DistinctOffsets(request.ReminderMinutesBeforeDue)
                            .Select(minutes => new TaskReminder
                            {
                                UserId = user.Id,
                                MinutesBeforeDue = minutes,
                                RemindAt = TaskReminder.ResolveRemindAt(
                                    request.DueDate.Value,
                                    minutes
                                ),
                            }),
                    ],
                ChecklistItems =
                [
                    .. (request.ChecklistItems ?? [])
                        .Where(i => !string.IsNullOrWhiteSpace(i.Text))
                        .Select(
                            (item, position) =>
                                new TaskChecklistItem
                                {
                                    Text = item.Text.Trim(),
                                    Position = position,
                                }
                        ),
                ],
            };

            dbContext.ProjectTasks.Add(task);
            await dbContext.SaveChangesAsync(cancellationToken);

            return TypedResults.Json(
                task.ToProjectTasksDetails(),
                statusCode: StatusCodes.Status201Created
            );
        }

        public static async Task<
            Results<Ok<ProjectTaskDetails>, NotFound<ApiMessageResponse>>
        > GetTask(
            int projectId,
            int taskId,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken
        )
        {
            var task = await dbContext
                .ProjectTasks.Where(t => t.Id == taskId && t.RelatedProjectId == projectId)
                .Include(t => t.Assignees)
                .Include(t => t.Attachments)
                .Include(t => t.ChecklistItems)
                .FirstOrDefaultAsync(cancellationToken);

            if (task is null)
                return TypedResults.NotFound(new ApiMessageResponse("Task not found"));

            return TypedResults.Ok(task.ToProjectTasksDetails());
        }

        public static async Task<
            Results<Ok<ProjectTaskDetails>, NotFound<ApiMessageResponse>>
        > UpdateTask(
            int projectId,
            int taskId,
            [FromForm] UpdateProjectTaskRequest request,
            ApplicationDbContext dbContext,
            HttpContext context,
            IFileService fileService,
            CancellationToken cancellationToken
        )
        {
            var task = await dbContext
                .ProjectTasks.Where(t => t.Id == taskId && t.RelatedProjectId == projectId)
                .Include(t => t.Assignees)
                .Include(t => t.Attachments)
                .Include(t => t.Reminders)
                .Include(t => t.ChecklistItems)
                .FirstOrDefaultAsync(cancellationToken);

            if (task is null)
                return TypedResults.NotFound(new ApiMessageResponse("Task not found"));

            task.Name = request.Name;
            task.Description = request.Description;
            task.Priority = request.Priority;
            task.Tags = request.Tags ?? [];
            task.StartDate = request.StartDate;
            task.DueDate = request.DueDate;
            SyncChecklist(task, request.ChecklistItems);

            // TaskReminder.RemindAt is derived from the due date, so moving the deadline has to
            // move the reminders with it — this is the one place a due date ever changes, and
            // forgetting it here is what turns a stored firing time into a stale one. Reminders
            // are kept rather than deleted when a due date is cleared: the job will not fire
            // them (it requires a due date), and setting a deadline again restores them.
            if (task.DueDate is not null)
            {
                SyncReminders(task, context.GetUser().Id, request.ReminderMinutesBeforeDue);

                foreach (var reminder in task.Reminders)
                {
                    reminder.RemindAt = TaskReminder.ResolveRemindAt(
                        task.DueDate.Value,
                        reminder.MinutesBeforeDue
                    );
                }
            }

            if (request.AssigneeIds is not null)
            {
                var assignees = await dbContext
                    .Users.Where(u => request.AssigneeIds.Contains(u.Id))
                    .ToListAsync(cancellationToken);
                task.Assignees = assignees;
            }

            if (request.RemovedAttachmentIds is { Count: > 0 })
            {
                var toRemove = task
                    .Attachments.Where(a => request.RemovedAttachmentIds.Contains(a.Id))
                    .ToList();
                foreach (var attachment in toRemove)
                {
                    await fileService.DeleteFileAsync(attachment.Id, cancellationToken);
                    task.Attachments.Remove(attachment);
                }
            }

            if (request.NewAttachments is { Count: > 0 })
            {
                var user = context.GetUser();
                foreach (var file in request.NewAttachments)
                {
                    var uploadRes = await fileService.UploadFileAsync(
                        file,
                        "attachments",
                        user.Id,
                        null,
                        cancellationToken
                    );
                    if (uploadRes.Success && uploadRes.Attachment is not null)
                    {
                        task.Attachments.Add(uploadRes.Attachment);
                    }
                }
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            return TypedResults.Ok(task.ToProjectTasksDetails());
        }

        public static async Task<
            Results<Ok<ProjectTaskDetails>, NotFound<ApiMessageResponse>>
        > MoveTask(
            int projectId,
            int taskId,
            MoveProjectTaskRequest request,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken
        )
        {
            // Every one of these Includes is load-bearing for the *response*, not the move:
            // ToProjectTasksDetails projects what is loaded, the frontend writes that straight
            // into the project cache, and anything missing here reads on the board as the drag
            // having wiped it.
            var task = await dbContext
                .ProjectTasks.Where(t => t.Id == taskId && t.RelatedProjectId == projectId)
                .Include(t => t.Assignees)
                .Include(t => t.Attachments)
                .Include(t => t.ChecklistItems)
                .FirstOrDefaultAsync(cancellationToken);

            if (task is null)
                return TypedResults.NotFound(new ApiMessageResponse("Task not found"));

            var column = await dbContext
                .ProjectColumns.Where(c => c.Id == request.ColumnId && c.ProjectId == projectId)
                .FirstOrDefaultAsync(cancellationToken);

            if (column is null)
                return TypedResults.NotFound(new ApiMessageResponse("Column not found"));

            task.RelatedColumnId = request.ColumnId;
            task.Score = request.Score;

            await dbContext.SaveChangesAsync(cancellationToken);
            return TypedResults.Ok(task.ToProjectTasksDetails());
        }

        public static async Task<Results<NoContent, NotFound<ApiMessageResponse>>> DeleteTask(
            int projectId,
            int taskId,
            ApplicationDbContext dbContext,
            IFileService fileService,
            CancellationToken cancellationToken
        )
        {
            var task = await dbContext
                .ProjectTasks.Where(t => t.Id == taskId && t.RelatedProjectId == projectId)
                .Include(t => t.Attachments)
                .FirstOrDefaultAsync(cancellationToken);

            if (task is null)
                return TypedResults.NotFound(new ApiMessageResponse("Task not found"));

            foreach (var attachment in task.Attachments)
                await fileService.DeleteFileAsync(attachment.Id, cancellationToken);

            dbContext.ProjectTasks.Remove(task);
            await dbContext.SaveChangesAsync(cancellationToken);
            return TypedResults.NoContent();
        }
    }
}
