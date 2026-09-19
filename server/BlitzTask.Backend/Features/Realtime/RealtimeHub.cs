using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.Realtime
{
    /// <summary>
    /// Names of the groups a connection can belong to. Not a string built at a call site, because
    /// a typo in a group name is silent — the publish succeeds, reaches nobody, and looks exactly
    /// like a client that failed to connect.
    /// </summary>
    public static class RealtimeGroups
    {
        public static string Project(int projectId) => $"project:{projectId}";

        public static string User(int userId) => $"user:{userId}";
    }

    /// <summary>
    /// Where a client hears that something changed.
    /// <para>
    /// <b>Groups are joined by the server on connect, from the caller's own memberships.</b>
    /// There is deliberately no <c>JoinProject(projectId)</c> for a client to call: the moment a
    /// group is named by the client, every subscription becomes an authorization check that has
    /// to be got right, and getting it wrong leaks a live feed of another project's activity.
    /// Reading the memberships here costs one query per connection and makes the mistake
    /// impossible to make.
    /// </para>
    /// <para>
    /// The cost is that a project joined <i>during</i> a session goes unheard until the next
    /// connect — acceptable, because joining a project is not something you do while staring at
    /// its board, and a reload fixes it.
    /// </para>
    /// </summary>
    [Authorize("EmailConfirmed")]
    public class RealtimeHub(ApplicationDbContext dbContext) : Hub
    {
        public override async Task OnConnectedAsync()
        {
            var userId = Context.GetHttpContext()?.GetUser().Id;

            if (userId is null)
            {
                await base.OnConnectedAsync();
                return;
            }

            // The personal channel carries what is addressed to this person (L32's bell); the
            // project channels carry what happened to work they can already see.
            await Groups.AddToGroupAsync(Context.ConnectionId, RealtimeGroups.User(userId.Value));

            var projectIds = await dbContext
                .ProjectParticipants.Where(pp => pp.UserId == userId.Value)
                .Select(pp => pp.ProjectId)
                .ToListAsync(Context.ConnectionAborted);

            foreach (var projectId in projectIds)
            {
                await Groups.AddToGroupAsync(
                    Context.ConnectionId,
                    RealtimeGroups.Project(projectId)
                );
            }

            await base.OnConnectedAsync();
        }
    }
}
