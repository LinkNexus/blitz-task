using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.Activity
{
    public static class ActivityEndpoints
    {
        public static IEndpointRouteBuilder MapActivityEndpoints(this IEndpointRouteBuilder app)
        {
            var group = app.MapGroup("/api/{projectId:int}/activity")
                .WithTags("Activity")
                .RequireAuthorization("EmailConfirmed");

            // Membership only. Everyone who can see a project can see what has been done to it —
            // a history visible to some members and not others would be a worse record than none,
            // and every label in it was already visible to anyone who could open the board.
            group
                .MapGet("", ListActivity)
                .WithName("list-project-activity")
                .AddEndpointFilter(new RequireProjectPermissionFilter())
                .Produces<List<ActivityEntry>>();

            return app;
        }

        /// <summary>
        /// A project's history, newest first — the order the question is asked in ("what has
        /// happened since I last looked"), and the opposite of L30's comment thread, which is
        /// read in the order it was said.
        /// </summary>
        public static async Task<Ok<List<ActivityEntry>>> ListActivity(
            int projectId,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken,
            int limit = ActivityFeed.DefaultPageSize
        )
        {
            var entries = await dbContext
                .ActivityEvents.Where(e => e.ProjectId == projectId)
                .OrderByDescending(e => e.CreatedAt)
                .ThenByDescending(e => e.Id)
                .Take(Math.Clamp(limit, 1, ActivityFeed.MaxPageSize))
                .Select(e => new ActivityEntry(
                    e.Id,
                    e.Kind,
                    e.ActorId,
                    e.ActorName,
                    e.TaskId,
                    e.Subject,
                    e.FromLabel,
                    e.ToLabel,
                    e.CreatedAt
                ))
                .ToListAsync(cancellationToken);

            return TypedResults.Ok(entries);
        }
    }
}
