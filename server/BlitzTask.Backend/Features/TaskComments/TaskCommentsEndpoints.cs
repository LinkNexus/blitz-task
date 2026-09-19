using BlitzTask.Backend.Features.Activity;
using BlitzTask.Backend.Features.Notifications;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Extensions;
using BlitzTask.Backend.Infrastructure.Filters;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.TaskComments
{
    public static class TaskCommentsEndpoints
    {
        public static IEndpointRouteBuilder MapTaskCommentsEndpoints(this IEndpointRouteBuilder app)
        {
            // Its own endpoints rather than a list riding on the task request the way L26's
            // checklist does. A checklist is part of what the task *is*, arrives whole, and is
            // small; a thread only grows, and `GET /api/projects/{id}` returns every task of a
            // project in full — carrying comments there would put the entire discussion of every
            // task into every board render.
            var group = app.MapGroup("/api/{projectId:int}/tasks/{taskId:int}/comments")
                .WithTags("Task Comments")
                .RequireAuthorization("EmailConfirmed");

            // Reading takes membership only. A Viewer cannot join the discussion but must be
            // able to follow it — a project you can see with a conversation you cannot read
            // would be a strange thing to have been given access to.
            group
                .MapGet("", ListComments)
                .WithName("list-task-comments")
                .AddEndpointFilter(new RequireProjectPermissionFilter())
                .Produces<List<TaskCommentDetails>>()
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound);

            group
                .MapPost("", CreateComment)
                .WithName("create-task-comment")
                .AddEndpointFilter(new RequireProjectPermissionFilter(ProjectPermission.Comment))
                .AddEndpointFilter(ValidationFilter<CreateTaskCommentRequest>.Body())
                .Produces<TaskCommentDetails>(StatusCodes.Status201Created)
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound)
                .Produces<ValidationErrors>(StatusCodes.Status422UnprocessableEntity);

            group
                .MapPut("/{commentId:int}", UpdateComment)
                .WithName("update-task-comment")
                .AddEndpointFilter(new RequireProjectPermissionFilter(ProjectPermission.Comment))
                .AddEndpointFilter(ValidationFilter<UpdateTaskCommentRequest>.Body())
                .Produces<TaskCommentDetails>()
                .Produces<ApiMessageResponse>(StatusCodes.Status403Forbidden)
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound)
                .Produces<ValidationErrors>(StatusCodes.Status422UnprocessableEntity);

            // Deleting needs only membership at the filter, because the rule is not a role: the
            // author may always retract their own remark, including a Viewer who has since been
            // demoted. Who else may is decided in the handler.
            group
                .MapDelete("/{commentId:int}", DeleteComment)
                .WithName("delete-task-comment")
                .AddEndpointFilter(new RequireProjectPermissionFilter())
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ApiMessageResponse>(StatusCodes.Status403Forbidden)
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound);

            return app;
        }

        private static IResult Forbidden() =>
            Results.Json(
                new ApiMessageResponse(
                    "You do not have permission to do this action or access this resource"
                ),
                statusCode: StatusCodes.Status403Forbidden
            );

        /// <summary>
        /// Everyone's remarks on one task, oldest first — a conversation is read in the order it
        /// was had, which is the opposite of every other list in this app.
        /// </summary>
        public static async Task<
            Results<Ok<List<TaskCommentDetails>>, NotFound<ApiMessageResponse>>
        > ListComments(
            int projectId,
            int taskId,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();

            // The task is matched against the route's project rather than trusted: the filter
            // authorised {projectId}, so a task reached under a project it does not belong to
            // must not resolve. Same rule as the checklist's PATCH.
            var taskExists = await dbContext.ProjectTasks.AnyAsync(
                t => t.Id == taskId && t.RelatedProjectId == projectId,
                cancellationToken
            );

            if (!taskExists)
                return TypedResults.NotFound(new ApiMessageResponse("Task not found"));

            var canModerate = await CanModerateAsync(dbContext, projectId, user.Id, cancellationToken);

            var comments = await dbContext
                .TaskComments.Where(c => c.ProjectTaskId == taskId)
                .OrderBy(c => c.CreatedAt)
                .ThenBy(c => c.Id)
                .Select(c => new
                {
                    c.Id,
                    c.Body,
                    c.AuthorId,
                    AuthorName = c.Author.Name,
                    c.CreatedAt,
                    c.UpdatedAt,
                })
                .ToListAsync(cancellationToken);

            return TypedResults.Ok(
                comments.ConvertAll(c => Describe(
                    c.Id,
                    c.Body,
                    c.AuthorId,
                    c.AuthorName,
                    c.CreatedAt,
                    c.UpdatedAt,
                    user.Id,
                    canModerate
                ))
            );
        }

        public static async Task<
            Results<Created<TaskCommentDetails>, NotFound<ApiMessageResponse>>
        > CreateComment(
            int projectId,
            int taskId,
            CreateTaskCommentRequest request,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();

            // The whole row rather than an existence check: the activity entry names the task
            // that was commented on, and history that resolves that name later is not history.
            var task = await dbContext.ProjectTasks.FirstOrDefaultAsync(
                t => t.Id == taskId && t.RelatedProjectId == projectId,
                cancellationToken
            );

            if (task is null)
                return TypedResults.NotFound(new ApiMessageResponse("Task not found"));

            var comment = new TaskComment
            {
                ProjectTaskId = taskId,
                AuthorId = user.Id,
                Body = request.Body.Trim(),
            };

            dbContext.TaskComments.Add(comment);
            ActivityRecorder.RecordTask(dbContext, user, task, ActivityKind.COMMENT_ADDED);

            // Who is "in" this conversation: the people the work is on, plus the people already
            // talking about it. A task has no creator column to fall back on, and everyone who
            // can see the project is far too wide a net — that turns a bell into a mailing list.
            var assigneeIds = await dbContext
                .ProjectTasks.Where(t => t.Id == taskId)
                .SelectMany(t => t.Assignees.Select(a => a.Id))
                .ToListAsync(cancellationToken);

            var priorCommenterIds = await dbContext
                .TaskComments.Where(c => c.ProjectTaskId == taskId)
                .Select(c => c.AuthorId)
                .Distinct()
                .ToListAsync(cancellationToken);

            NotificationRecorder.NotifyAboutTask(
                dbContext,
                user,
                task,
                NotificationKind.TASK_COMMENTED,
                assigneeIds.Concat(priorCommenterIds)
            );

            await dbContext.SaveChangesAsync(cancellationToken);

            var canModerate = await CanModerateAsync(dbContext, projectId, user.Id, cancellationToken);

            return TypedResults.Created(
                $"/api/{projectId}/tasks/{taskId}/comments/{comment.Id}",
                Describe(
                    comment.Id,
                    comment.Body,
                    user.Id,
                    user.Name,
                    comment.CreatedAt,
                    comment.UpdatedAt,
                    user.Id,
                    canModerate
                )
            );
        }

        /// <summary>
        /// Rewrites a comment — the author's own, and nobody else's.
        /// <para>
        /// No moderator exception on purpose: holding the project does not make someone else's
        /// sentence yours to reword. A remark that cannot stand gets taken down by
        /// <see cref="DeleteComment"/>, which is visible as a removal rather than passing as the
        /// author's words.
        /// </para>
        /// </summary>
        public static async Task<IResult> UpdateComment(
            int projectId,
            int taskId,
            int commentId,
            UpdateTaskCommentRequest request,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();

            var comment = await FindAsync(dbContext, projectId, taskId, commentId, cancellationToken);

            if (comment is null)
                return Results.NotFound(new ApiMessageResponse("Comment not found"));

            if (comment.AuthorId != user.Id)
                return Forbidden();

            comment.Body = request.Body.Trim();
            await dbContext.SaveChangesAsync(cancellationToken);

            var canModerate = await CanModerateAsync(dbContext, projectId, user.Id, cancellationToken);

            return Results.Ok(
                Describe(
                    comment.Id,
                    comment.Body,
                    comment.AuthorId,
                    user.Name,
                    comment.CreatedAt,
                    comment.UpdatedAt,
                    user.Id,
                    canModerate
                )
            );
        }

        /// <summary>
        /// Takes a comment down — the author's, or anyone's if you run the project.
        /// <para>
        /// A hard delete, and the one place in the app after L29 where something is destroyed on
        /// request. Retracting a sentence is deliberate and loses no work; routing it through a
        /// 30-day trash would leave a remark someone regretted sitting there for a month, which
        /// is the opposite of what they asked for.
        /// </para>
        /// </summary>
        public static async Task<IResult> DeleteComment(
            int projectId,
            int taskId,
            int commentId,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();

            var comment = await FindAsync(dbContext, projectId, taskId, commentId, cancellationToken);

            if (comment is null)
                return Results.NotFound(new ApiMessageResponse("Comment not found"));

            var canModerate = await CanModerateAsync(dbContext, projectId, user.Id, cancellationToken);

            if (comment.AuthorId != user.Id && !canModerate)
                return Forbidden();

            dbContext.TaskComments.Remove(comment);
            await dbContext.SaveChangesAsync(cancellationToken);

            return Results.NoContent();
        }

        private static Task<TaskComment?> FindAsync(
            ApplicationDbContext dbContext,
            int projectId,
            int taskId,
            int commentId,
            CancellationToken cancellationToken
        ) =>
            dbContext.TaskComments.FirstOrDefaultAsync(
                c =>
                    c.Id == commentId
                    && c.ProjectTaskId == taskId
                    && c.ProjectTask.RelatedProjectId == projectId,
                cancellationToken
            );

        /// <summary>
        /// Whether the caller may take down remarks that are not theirs. <c>ManageParticipants</c>
        /// rather than a permission of its own: the people who decide who is in a project are the
        /// people who answer for what gets said in it.
        /// </summary>
        private static async Task<bool> CanModerateAsync(
            ApplicationDbContext dbContext,
            int projectId,
            int userId,
            CancellationToken cancellationToken
        )
        {
            var role = await dbContext
                .ProjectParticipants.Where(pp => pp.ProjectId == projectId && pp.UserId == userId)
                .Select(pp => (ProjectRole?)pp.Role)
                .FirstOrDefaultAsync(cancellationToken);

            return role?.HasPermission(ProjectPermission.ManageParticipants) ?? false;
        }

        private static TaskCommentDetails Describe(
            int id,
            string body,
            int authorId,
            string authorName,
            DateTime createdAt,
            DateTime updatedAt,
            int callerId,
            bool callerCanModerate
        )
        {
            var isAuthor = authorId == callerId;

            return new TaskCommentDetails(
                id,
                body,
                authorId,
                authorName,
                createdAt,
                updatedAt,
                IsEdited: updatedAt > createdAt,
                CanEdit: isAuthor,
                CanDelete: isAuthor || callerCanModerate
            );
        }
    }
}
