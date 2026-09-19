using BlitzTask.Backend.Features.Activity;
using BlitzTask.Backend.Features.Notifications;
using BlitzTask.Backend.Features.ProjectColumns;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Realtime;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;

namespace BlitzTask.Backend.Infrastructure.Data;

/// <summary>
/// Tells the people looking at a project that it changed.
/// <para>
/// An interceptor rather than a call in every handler, and that is the whole point: there is no
/// list of "places that must remember to publish" to fall behind. Anything that writes a task, a
/// column, a project or an activity entry is a change worth hearing about, and a feature added
/// later gets this for free instead of being the one that quietly does not update.
/// </para>
/// <para>
/// <b>Collected before the save, published after it.</b> Before, because once
/// <c>SaveChanges</c> returns every entry reads as <c>Unchanged</c> and there is no longer any
/// way to know what moved. After, because a client told to refetch mid-transaction would read
/// the state it was being told had changed.
/// </para>
/// <para>
/// Registered <b>scoped</b>, not singleton: it carries the affected ids between the two halves
/// of one save, and a singleton would have concurrent requests overwriting each other's.
/// </para>
/// </summary>
public class RealtimePublishInterceptor(
    IHubContext<RealtimeHub> hub,
    IHttpContextAccessor httpContextAccessor,
    ILogger<RealtimePublishInterceptor> logger
) : SaveChangesInterceptor
{
    private readonly HashSet<int> _projectIds = [];
    private readonly HashSet<int> _notifiedUserIds = [];

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default
    )
    {
        Collect(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    public override async ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData,
        int result,
        CancellationToken cancellationToken = default
    )
    {
        // Never let a push failure fail the write. The database is the record; this is a hint
        // that it moved, and a client that misses one is stale rather than wrong — it still has
        // every other refetch trigger it had before this feature existed.
        try
        {
            await PublishAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to publish realtime updates");
        }
        finally
        {
            _projectIds.Clear();
            _notifiedUserIds.Clear();
        }

        return await base.SavedChangesAsync(eventData, result, cancellationToken);
    }

    private void Collect(DbContext? context)
    {
        if (context is null)
            return;

        foreach (var entry in context.ChangeTracker.Entries())
        {
            if (entry.State is not (EntityState.Added or EntityState.Modified or EntityState.Deleted))
                continue;

            switch (entry.Entity)
            {
                // A comment has no project id of its own, but writing one always records an
                // activity entry beside it — so covering ActivityEvent covers the discussion too.
                case ActivityEvent activity:
                    _projectIds.Add(activity.ProjectId);
                    break;
                case ProjectTask task:
                    _projectIds.Add(task.RelatedProjectId);
                    break;
                case ProjectColumn column:
                    _projectIds.Add(column.ProjectId);
                    break;
                case Project project:
                    _projectIds.Add(project.Id);
                    break;
                case ProjectParticipant participant:
                    _projectIds.Add(participant.ProjectId);
                    break;
                case Notification notification:
                    _notifiedUserIds.Add(notification.UserId);
                    break;
            }
        }
    }

    private async Task PublishAsync(CancellationToken cancellationToken)
    {
        if (_projectIds.Count == 0 && _notifiedUserIds.Count == 0)
            return;

        // Read from HttpContext.Items the same way the handlers do. Null outside a request —
        // the reminder sweep and the purge job both write through here — which simply means
        // nobody gets to claim the change as their own echo.
        var actorId = httpContextAccessor.HttpContext?.Items["CurrentUser"] is Features.Auth.User user
            ? user.Id
            : (int?)null;

        foreach (var projectId in _projectIds)
        {
            await hub.Clients
                .Group(RealtimeGroups.Project(projectId))
                .SendAsync(
                    RealtimeMessages.ProjectChanged,
                    new ProjectChangedEvent(projectId, actorId),
                    cancellationToken
                );
        }

        foreach (var userId in _notifiedUserIds)
        {
            await hub.Clients
                .Group(RealtimeGroups.User(userId))
                .SendAsync(RealtimeMessages.NotificationsChanged, cancellationToken);
        }
    }
}
