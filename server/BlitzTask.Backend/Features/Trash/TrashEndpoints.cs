using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Extensions;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.Trash
{
    public static class TrashEndpoints
    {
        public static IEndpointRouteBuilder MapTrashEndpoints(this IEndpointRouteBuilder app)
        {
            // No RequireProjectPermissionFilter anywhere here: it reads one projectId out of the
            // route, and the listing spans every project the caller is in while the item routes
            // are keyed by the deleted thing rather than by its project. Membership and the role
            // check are done in the handlers, and — as in that filter — a project the caller does
            // not participate in reads as "not found" rather than "forbidden".
            var group = app.MapGroup("/api/trash")
                .WithTags("Trash")
                .RequireAuthorization("EmailConfirmed");

            group.MapGet("", ListTrash).WithName("list-trash").Produces<List<TrashItem>>();

            group
                .MapPost("/projects/{projectId:int}/restore", RestoreProject)
                .WithName("restore-project")
                .Produces<ApiMessageResponse>()
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound)
                .Produces<ApiMessageResponse>(StatusCodes.Status403Forbidden);

            group
                .MapPost("/tasks/{taskId:int}/restore", RestoreTask)
                .WithName("restore-task")
                .Produces<ApiMessageResponse>()
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound)
                .Produces<ApiMessageResponse>(StatusCodes.Status400BadRequest)
                .Produces<ApiMessageResponse>(StatusCodes.Status403Forbidden);

            group
                .MapDelete("/projects/{projectId:int}", PurgeProject)
                .WithName("purge-project")
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound)
                .Produces<ApiMessageResponse>(StatusCodes.Status403Forbidden);

            group
                .MapDelete("/tasks/{taskId:int}", PurgeTask)
                .WithName("purge-task")
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound)
                .Produces<ApiMessageResponse>(StatusCodes.Status403Forbidden);

            return app;
        }

        private static IResult Forbidden() =>
            Results.Json(
                new ApiMessageResponse(
                    "You do not have permission to do this action or access this resource"
                ),
                statusCode: StatusCodes.Status403Forbidden
            );

        public static async Task<Ok<List<TrashItem>>> ListTrash(
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();

            var roles = await dbContext
                .ProjectParticipants.Where(pp => pp.UserId == user.Id)
                .ToDictionaryAsync(pp => pp.ProjectId, pp => pp.Role, cancellationToken);

            var projectIds = roles.Keys.ToList();

            var projects = await dbContext
                .Projects.IgnoreQueryFilters()
                .Where(p => p.DeletedAt != null && projectIds.Contains(p.Id))
                .Select(p => new
                {
                    p.Id,
                    p.Name,
                    p.DeletedAt,
                    // Only what came down with the project: a task trashed earlier on its own
                    // stays in the trash when the project is restored, so counting it here would
                    // promise more than the restore delivers.
                    TaskCount = p.Tasks.Count(t => t.DeletedAt == p.DeletedAt),
                })
                .ToListAsync(cancellationToken);

            // Tasks whose project is also in the trash are deliberately absent: they come back
            // with it, and listing them would offer a restore that cannot work on its own.
            var tasks = await dbContext
                .ProjectTasks.IgnoreQueryFilters()
                .Where(t =>
                    t.DeletedAt != null
                    && projectIds.Contains(t.RelatedProjectId)
                    && t.RelatedProject.DeletedAt == null
                )
                .Select(t => new
                {
                    t.Id,
                    t.Name,
                    t.DeletedAt,
                    t.RelatedProjectId,
                    ProjectName = t.RelatedProject.Name,
                })
                .ToListAsync(cancellationToken);

            List<TrashItem> items =
            [
                .. projects.Select(p => new TrashItem(
                    TrashItemKind.PROJECT,
                    p.Id,
                    p.Name,
                    p.DeletedAt!.Value,
                    TrashRetention.PurgeAt(p.DeletedAt!.Value),
                    p.Id,
                    p.Name,
                    p.TaskCount,
                    roles[p.Id].HasPermission(ProjectPermission.DeleteProject)
                )),
                .. tasks.Select(t => new TrashItem(
                    TrashItemKind.TASK,
                    t.Id,
                    t.Name,
                    t.DeletedAt!.Value,
                    TrashRetention.PurgeAt(t.DeletedAt!.Value),
                    t.RelatedProjectId,
                    t.ProjectName,
                    null,
                    roles[t.RelatedProjectId].HasPermission(ProjectPermission.ManageTasks)
                )),
            ];

            // Most recently deleted first: the thing you are looking for is almost always the
            // thing you just lost.
            return TypedResults.Ok(items.OrderByDescending(i => i.DeletedAt).ToList());
        }

        /// <summary>
        /// Resolves a trashed project the caller is allowed to act on, or the result to return
        /// instead. Membership failures read as 404 so the endpoint cannot be used to discover
        /// which project ids exist.
        /// </summary>
        private static async Task<(Project? Project, IResult? Failure)> ResolveProjectAsync(
            int projectId,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();

            var project = await dbContext
                .Projects.IgnoreQueryFilters()
                .Include(p => p.Columns)
                .Include(p => p.Tasks)
                .FirstOrDefaultAsync(p => p.Id == projectId && p.DeletedAt != null, cancellationToken);

            if (project is null)
                return (null, Results.NotFound(new ApiMessageResponse("Project not found.")));

            var participant = await dbContext.ProjectParticipants.FirstOrDefaultAsync(
                pp => pp.ProjectId == projectId && pp.UserId == user.Id,
                cancellationToken
            );

            if (participant is null)
                return (null, Results.NotFound(new ApiMessageResponse("Project not found.")));

            return participant.Role.HasPermission(ProjectPermission.DeleteProject)
                ? (project, null)
                : (null, Forbidden());
        }

        private static async Task<(
            ProjectTasks.ProjectTask? Task,
            IResult? Failure
        )> ResolveTaskAsync(
            int taskId,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();

            var task = await dbContext
                .ProjectTasks.IgnoreQueryFilters()
                .Include(t => t.RelatedProject)
                .Include(t => t.Attachments)
                .FirstOrDefaultAsync(t => t.Id == taskId && t.DeletedAt != null, cancellationToken);

            if (task is null)
                return (null, Results.NotFound(new ApiMessageResponse("Task not found.")));

            var participant = await dbContext.ProjectParticipants.FirstOrDefaultAsync(
                pp => pp.ProjectId == task.RelatedProjectId && pp.UserId == user.Id,
                cancellationToken
            );

            if (participant is null)
                return (null, Results.NotFound(new ApiMessageResponse("Task not found.")));

            return participant.Role.HasPermission(ProjectPermission.ManageTasks)
                ? (task, null)
                : (null, Forbidden());
        }

        public static async Task<IResult> RestoreProject(
            int projectId,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var (project, failure) = await ResolveProjectAsync(
                projectId,
                dbContext,
                context,
                cancellationToken
            );

            if (failure is not null)
                return failure;

            // Only what came down with the project. Matching on the exact instant the cascade
            // stamped is what keeps a task the user deliberately threw away last week in the
            // trash where they put it, instead of quietly reappearing on the board.
            var deletedAt = project!.DeletedAt;

            foreach (var column in project.Columns.Where(c => c.DeletedAt == deletedAt))
                column.DeletedAt = null;

            foreach (var task in project.Tasks.Where(t => t.DeletedAt == deletedAt))
                task.DeletedAt = null;

            project.DeletedAt = null;
            await dbContext.SaveChangesAsync(cancellationToken);

            return Results.Ok(new ApiMessageResponse("Project restored."));
        }

        public static async Task<IResult> RestoreTask(
            int taskId,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var (task, failure) = await ResolveTaskAsync(
                taskId,
                dbContext,
                context,
                cancellationToken
            );

            if (failure is not null)
                return failure;

            if (task!.RelatedProject.DeletedAt is not null)
            {
                return Results.BadRequest(
                    new ApiMessageResponse(
                        "Restore the project first — this task came out of a project that is also in the trash."
                    )
                );
            }

            // A task's column may itself be trashed, which is exactly what happens when a column
            // is deleted. Rather than dragging the column back — the user threw away that part of
            // the board on purpose — the task lands in the first live column, the same answer
            // filing a task into a project with no stated column already gives.
            var columnIsGone = await dbContext
                .ProjectColumns.IgnoreQueryFilters()
                .AnyAsync(
                    c => c.Id == task.RelatedColumnId && c.DeletedAt != null,
                    cancellationToken
                );

            if (columnIsGone)
            {
                var fallback = await dbContext
                    .ProjectColumns.Where(c => c.ProjectId == task.RelatedProjectId)
                    .OrderBy(c => c.Score)
                    .FirstOrDefaultAsync(cancellationToken);

                if (fallback is null)
                {
                    return Results.BadRequest(
                        new ApiMessageResponse(
                            "This task has nowhere to go — its project has no columns left."
                        )
                    );
                }

                var maxScore =
                    await dbContext
                        .ProjectTasks.Where(t => t.RelatedColumnId == fallback.Id)
                        .Select(t => (float?)t.Score)
                        .MaxAsync(cancellationToken)
                    ?? 0f;

                task.RelatedColumnId = fallback.Id;
                task.Score = maxScore + 1000f;
            }

            task.DeletedAt = null;
            await dbContext.SaveChangesAsync(cancellationToken);

            return Results.Ok(new ApiMessageResponse("Task restored."));
        }

        public static async Task<IResult> PurgeProject(
            int projectId,
            ApplicationDbContext dbContext,
            IFileService fileService,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var (project, failure) = await ResolveProjectAsync(
                projectId,
                dbContext,
                context,
                cancellationToken
            );

            if (failure is not null)
                return failure;

            await TrashPurge.PurgeProjectAsync(project!, dbContext, fileService, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);

            return Results.NoContent();
        }

        public static async Task<IResult> PurgeTask(
            int taskId,
            ApplicationDbContext dbContext,
            IFileService fileService,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var (task, failure) = await ResolveTaskAsync(
                taskId,
                dbContext,
                context,
                cancellationToken
            );

            if (failure is not null)
                return failure;

            await TrashPurge.PurgeTaskAsync(task!, dbContext, fileService, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);

            return Results.NoContent();
        }
    }
}
