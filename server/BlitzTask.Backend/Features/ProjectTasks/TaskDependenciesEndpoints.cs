using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.ProjectTasks
{
    public static class TaskDependenciesEndpoints
    {
        public static IEndpointRouteBuilder MapTaskDependenciesEndpoints(
            this IEndpointRouteBuilder app
        )
        {
            var group = app.MapGroup("/api/{projectId:int}/tasks/{taskId:int}/dependencies")
                .WithTags("Task Dependencies")
                .RequireAuthorization("EmailConfirmed")
                .AddEndpointFilter(
                    new RequireProjectPermissionFilter(ProjectPermission.ManageTasks)
                );

            group
                .MapPost("", AddDependency)
                .WithName("add-task-dependency")
                .Produces<TaskDependencyLink>(StatusCodes.Status201Created)
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound)
                .Produces<ApiMessageResponse>(StatusCodes.Status409Conflict);

            group
                .MapDelete("/{dependsOnTaskId:int}", RemoveDependency)
                .WithName("remove-task-dependency")
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound);

            return app;
        }

        public static async Task<
            Results<
                JsonHttpResult<TaskDependencyLink>,
                NotFound<ApiMessageResponse>,
                Conflict<ApiMessageResponse>
            >
        > AddDependency(
            int projectId,
            int taskId,
            AddTaskDependencyRequest request,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken
        )
        {
            if (request.DependsOnTaskId == taskId)
            {
                return TypedResults.Conflict(
                    new ApiMessageResponse("A task cannot block itself")
                );
            }

            // Both ends looked up inside the project, so a task from elsewhere reads as absent
            // rather than forbidden — and a cross-project edge cannot be created at all.
            var tasks = await dbContext
                .ProjectTasks.Where(t =>
                    t.RelatedProjectId == projectId
                    && (t.Id == taskId || t.Id == request.DependsOnTaskId)
                )
                .Select(t => new TaskDependencyLink(t.Id, t.Name, t.RelatedColumnId))
                .ToListAsync(cancellationToken);

            var blocker = tasks.FirstOrDefault(t => t.Id == request.DependsOnTaskId);

            if (blocker is null || !tasks.Any(t => t.Id == taskId))
                return TypedResults.NotFound(new ApiMessageResponse("Task not found"));

            var alreadyLinked = await dbContext.ProjectTaskDependencies.AnyAsync(
                d => d.DependentTaskId == taskId && d.DependsOnTaskId == request.DependsOnTaskId,
                cancellationToken
            );

            if (alreadyLinked)
            {
                return TypedResults.Conflict(
                    new ApiMessageResponse("That task is already a blocker")
                );
            }

            if (
                await WouldCycleAsync(
                    projectId,
                    taskId,
                    request.DependsOnTaskId,
                    dbContext,
                    cancellationToken
                )
            )
            {
                return TypedResults.Conflict(
                    new ApiMessageResponse(
                        "That would make a loop — the two tasks would each be waiting on the other"
                    )
                );
            }

            dbContext.ProjectTaskDependencies.Add(
                new ProjectTaskDependency
                {
                    DependentTaskId = taskId,
                    DependsOnTaskId = request.DependsOnTaskId,
                }
            );
            await dbContext.SaveChangesAsync(cancellationToken);

            return TypedResults.Json(blocker, statusCode: StatusCodes.Status201Created);
        }

        public static async Task<
            Results<NoContent, NotFound<ApiMessageResponse>>
        > RemoveDependency(
            int projectId,
            int taskId,
            int dependsOnTaskId,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken
        )
        {
            var removed = await dbContext
                .ProjectTaskDependencies.Where(d =>
                    d.DependentTaskId == taskId
                    && d.DependsOnTaskId == dependsOnTaskId
                    && d.DependentTask.RelatedProjectId == projectId
                )
                .ExecuteDeleteAsync(cancellationToken);

            return removed == 0
                ? TypedResults.NotFound(new ApiMessageResponse("Dependency not found"))
                : TypedResults.NoContent();
        }

        /// <summary>
        /// Would adding <paramref name="dependsOnTaskId"/> as a blocker of
        /// <paramref name="dependentTaskId"/> close a loop?
        /// <para>
        /// <b>Walked in memory, and it has to be.</b> SQLite has recursive CTEs and EF Core will
        /// not translate one, so the choice is raw SQL or loading the project's edges and
        /// walking them here — and at any size this app will ever see, the edge set is small
        /// enough that the second is simply the right answer. What is <i>not</i> an option is
        /// checking in the UI: that is a hint, not enforcement, and the endpoint is reachable
        /// without it.
        /// </para>
        /// <para>
        /// The new edge points from dependent to blocker, so a loop exists exactly when the
        /// blocker can already reach the dependent by following blockers of its own.
        /// </para>
        /// </summary>
        private static async Task<bool> WouldCycleAsync(
            int projectId,
            int dependentTaskId,
            int dependsOnTaskId,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken
        )
        {
            var edges = await dbContext
                .ProjectTaskDependencies.Where(d =>
                    d.DependentTask.RelatedProjectId == projectId
                )
                .Select(d => new { d.DependentTaskId, d.DependsOnTaskId })
                .ToListAsync(cancellationToken);

            var blockersOf = edges
                .GroupBy(e => e.DependentTaskId)
                .ToDictionary(g => g.Key, g => g.Select(e => e.DependsOnTaskId).ToList());

            var seen = new HashSet<int>();
            var stack = new Stack<int>();
            stack.Push(dependsOnTaskId);

            while (stack.Count > 0)
            {
                var current = stack.Pop();

                if (current == dependentTaskId)
                    return true;

                // `seen` guards the walk itself: the stored graph is already acyclic, but a
                // diamond would otherwise be explored once per path into it.
                if (!seen.Add(current))
                    continue;

                if (blockersOf.TryGetValue(current, out var next))
                {
                    foreach (var blocker in next)
                        stack.Push(blocker);
                }
            }

            return false;
        }
    }
}
