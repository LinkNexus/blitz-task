using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectColumns;
using BlitzTask.Backend.Features.ProjectMembers;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Extensions;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.Projects
{
    public static class InboxEndpoints
    {
        public static IEndpointRouteBuilder MapInboxEndpoints(this IEndpointRouteBuilder app)
        {
            // Outside the /api/projects group: there is no projectId in the route to run
            // RequireProjectPermissionFilter against, because finding — or creating — the
            // caller's own Inbox is what the endpoint is for.
            app.MapGet("/api/inbox", GetInbox)
                .WithTags("Inbox")
                .WithName("get-inbox")
                .RequireAuthorization("EmailConfirmed")
                .Produces<InboxSummary>();

            return app;
        }

        /// <summary>
        /// The caller's Inbox, created on first use.
        /// <para>
        /// Get-or-create rather than a row written at registration plus a data migration for the
        /// accounts that already exist: the migration would have to invent a project, its two
        /// columns and a participant row per user in raw SQL, and any account that slipped
        /// through — restored from a backup, created by a path that forgot — would have no Inbox
        /// and no way to get one. This heals itself on the next request instead.
        /// </para>
        /// </summary>
        public static async Task<Ok<InboxSummary>> GetInbox(
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();

            var inbox = await dbContext
                .Projects.Include(p => p.Columns)
                .FirstOrDefaultAsync(p => p.IsInbox && p.CreatedById == user.Id, cancellationToken);

            inbox ??= await CreateInboxAsync(user, dbContext, cancellationToken);

            // Lowest score is where the board renders the first column, and where a capture with
            // no opinion about status belongs.
            var captureColumn = inbox.Columns.OrderBy(c => c.Score).First();

            return TypedResults.Ok(new InboxSummary(inbox.Id, captureColumn.Id));
        }

        private static async Task<Project> CreateInboxAsync(
            User user,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken
        )
        {
            var inbox = new Project
            {
                Name = "Inbox",
                Description = "Work captured before it was decided where it belongs.",
                IsInbox = true,
                CreatedBy = user,
                Participants =
                [
                    new ProjectParticipant
                    {
                        User = user,
                        Role = ProjectRole.Owner,
                        CreatedAt = DateTime.UtcNow,
                    },
                ],
                Invitations = [],
                // Two columns, not one: "done" is a position in this app rather than a flag, so
                // an Inbox with a single column would hold tasks that can never be completed —
                // and IncompleteTasks, which powers the dashboard, would show every capture ever
                // made forever.
                Columns =
                [
                    new ProjectColumn
                    {
                        Name = "Captured",
                        Score = 0,
                        Color = "#6366F1",
                    },
                    new ProjectColumn
                    {
                        Name = "Done",
                        Score = 1000,
                        Color = "#22C55E",
                    },
                ],
            };

            await dbContext.Projects.AddAsync(inbox, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);

            return inbox;
        }
    }
}
