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

            if (!includeCompleted)
                query = query.IncompleteTasks();

            // Everything due-date-shaped runs in memory. SQLite cannot ORDER BY a DateTimeOffset
            // (EF throws), and comparing one in a WHERE silently degrades to a text comparison
            // that is correct only while every row carries the same UTC offset — which is true of
            // today's data by luck, not by construction. Both operations therefore happen after
            // materialisation, over the already-narrowed set of this user's matching tasks; the
            // clamp below is what bounds the response, not the query. ROADMAP L50 removes this.
            var rows = await query.SelectUserTaskSummariesFor(user.Id).ToListAsync(cancellationToken);

            var tasks = rows.Where(t => !dueBefore.HasValue || (t.DueDate.HasValue && t.DueDate <= dueBefore.Value))
                .InDashboardOrder()
                .Take(Math.Clamp(limit, 1, MaxUserTaskPageSize))
                .ToList();

            return TypedResults.Ok(tasks);
        }

        // A dashboard widget shows a handful of rows; the cap exists so a malformed `limit`
        // cannot turn this into a full table scan serialised over the wire.
        private const int MaxUserTaskPageSize = 200;

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
                .FirstOrDefaultAsync(cancellationToken);

            if (task is null)
                return TypedResults.NotFound(new ApiMessageResponse("Task not found"));

            task.Name = request.Name;
            task.Description = request.Description;
            task.Priority = request.Priority;
            task.Tags = request.Tags ?? [];
            task.StartDate = request.StartDate;
            task.DueDate = request.DueDate;

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
            var task = await dbContext
                .ProjectTasks.Where(t => t.Id == taskId && t.RelatedProjectId == projectId)
                .Include(t => t.Assignees)
                .Include(t => t.Attachments)
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
