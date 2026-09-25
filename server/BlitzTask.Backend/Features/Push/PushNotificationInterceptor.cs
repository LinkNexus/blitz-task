using BlitzTask.Backend.Features.Notifications;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace BlitzTask.Backend.Infrastructure.Data;

/// <summary>
/// Sends a push for every <see cref="Notification"/> a save writes.
/// <para>
/// An interceptor for the same reason <see cref="RealtimePublishInterceptor"/> is one: there is
/// then no list of "places that must remember to push" to fall behind, and a feature that starts
/// notifying someone next year gets a push for free. <see cref="NotificationRecorder"/>
/// deliberately adds without saving, so pushing from there would announce writes that then
/// failed — this fires only once the row is committed.
/// </para>
/// <para>
/// <b>Collected before the save, sent after it</b>, and <b>in its own scope</b>. The second part
/// matters: <see cref="Features.Push.PushSender"/> deletes subscriptions a push service has
/// forgotten, and doing that on the context currently inside its own <c>SaveChanges</c> would
/// re-enter this interceptor. A fresh scope gives the send its own context, the same way the job
/// runner builds one per tick.
/// </para>
/// </summary>
public class PushNotificationInterceptor(
    IServiceScopeFactory scopeFactory,
    ILogger<PushNotificationInterceptor> logger
) : SaveChangesInterceptor
{
    private readonly List<Notification> _pending = [];

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default
    )
    {
        // Before the save, because once it returns every entry reads as Unchanged and there is
        // no longer any way to tell which notifications this save created.
        if (eventData.Context is not null)
        {
            foreach (var entry in eventData.Context.ChangeTracker.Entries<Notification>())
            {
                if (entry.State == EntityState.Added)
                    _pending.Add(entry.Entity);
            }
        }

        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    public override async ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData,
        int result,
        CancellationToken cancellationToken = default
    )
    {
        var pending = _pending.ToList();
        _pending.Clear();

        if (pending.Count > 0)
        {
            try
            {
                await SendAsync(pending, cancellationToken);
            }
            catch (Exception ex)
            {
                // Never let a push failure fail the write. The row is the record; this is a
                // buzz about it, and a missed buzz still leaves the notification in the bell.
                logger.LogError(ex, "Failed to push notifications");
            }
        }

        return await base.SavedChangesAsync(eventData, result, cancellationToken);
    }

    private async Task SendAsync(
        IReadOnlyList<Notification> notifications,
        CancellationToken cancellationToken
    )
    {
        using var scope = scopeFactory.CreateScope();
        var sender = scope.ServiceProvider.GetRequiredService<Features.Push.PushSender>();

        foreach (var notification in notifications)
        {
            await sender.SendAsync(
                [notification.UserId],
                new Features.Push.PushPayload(
                    Title: Title(notification),
                    Body: notification.TaskName ?? "Open Blitz Task",
                    Url: Link(notification)
                ),
                cancellationToken
            );
        }
    }

    /// <summary>
    /// The same sentence the notification bell shows, so a push and the list it lands in do not
    /// describe the same event two different ways.
    /// </summary>
    private static string Title(Notification notification) =>
        notification.Kind switch
        {
            NotificationKind.TASK_ASSIGNED => $"{notification.ActorName} assigned you",
            NotificationKind.MENTIONED_IN_COMMENT =>
                $"{notification.ActorName} mentioned you on",
            _ => $"{notification.ActorName} commented on",
        };

    /// <summary>
    /// A task is addressed by its id alone, never through a project, because filing moves it
    /// (L24) — and a comment carries the permalink that scrolls to the remark itself.
    /// </summary>
    private static string Link(Notification notification) =>
        notification.TaskId is null
            ? "/dashboard"
            : notification.CommentId is null
                ? $"/tasks/{notification.TaskId}"
                : $"/tasks/{notification.TaskId}?comment={notification.CommentId}";
}
