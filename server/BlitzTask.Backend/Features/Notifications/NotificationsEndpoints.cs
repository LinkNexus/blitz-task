using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Extensions;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.Notifications
{
    public static class NotificationsEndpoints
    {
        public static IEndpointRouteBuilder MapNotificationsEndpoints(this IEndpointRouteBuilder app)
        {
            // No project in the route and no permission filter: these rows are addressed to one
            // person, so ownership *is* the authorization — the same shape as GET /api/tasks,
            // one step further. Nothing here can be reached by naming someone else's id.
            var group = app.MapGroup("/api/notifications")
                .WithTags("Notifications")
                .RequireAuthorization("EmailConfirmed");

            group
                .MapGet("", ListNotifications)
                .WithName("list-notifications")
                .Produces<NotificationsResponse>();

            group
                .MapPost("/read", MarkAllRead)
                .WithName("mark-notifications-read")
                .Produces<NotificationsResponse>();

            group
                .MapPost("/{notificationId:int}/read", MarkRead)
                .WithName("mark-notification-read")
                .Produces<NotificationDetails>()
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound);

            return app;
        }

        public static async Task<Ok<NotificationsResponse>> ListNotifications(
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken,
            bool unreadOnly = false,
            int limit = NotificationFeed.DefaultPageSize
        )
        {
            var user = context.GetUser();
            var mine = dbContext.Notifications.Where(n => n.UserId == user.Id);

            // Counted over everything, not over the page. The bell says how many are waiting,
            // which is not the same question as what fits in the popover.
            var unreadCount = await mine.CountAsync(n => n.ReadAt == null, cancellationToken);

            var items = await (unreadOnly ? mine.Where(n => n.ReadAt == null) : mine)
                .OrderByDescending(n => n.CreatedAt)
                .ThenByDescending(n => n.Id)
                .Take(Math.Clamp(limit, 1, NotificationFeed.MaxPageSize))
                .Select(n => new NotificationDetails(
                    n.Id,
                    n.Kind,
                    n.ActorId,
                    n.ActorName,
                    n.ProjectId,
                    n.TaskId,
                    n.TaskName,
                    n.CommentId,
                    n.CreatedAt,
                    n.ReadAt != null
                ))
                .ToListAsync(cancellationToken);

            return TypedResults.Ok(new NotificationsResponse(unreadCount, items));
        }

        /// <summary>
        /// Clears the badge. Returns the feed rather than a count, because the caller is about to
        /// re-render both and a second round trip would let them disagree for a frame.
        /// </summary>
        public static async Task<Ok<NotificationsResponse>> MarkAllRead(
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();
            var now = DateTime.UtcNow;

            await dbContext
                .Notifications.Where(n => n.UserId == user.Id && n.ReadAt == null)
                .ExecuteUpdateAsync(n => n.SetProperty(x => x.ReadAt, now), cancellationToken);

            return await ListNotifications(dbContext, context, cancellationToken);
        }

        public static async Task<Results<Ok<NotificationDetails>, NotFound<ApiMessageResponse>>> MarkRead(
            int notificationId,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();

            // Scoped to the caller in the lookup itself: someone else's id must read as missing
            // rather than forbidden, or this endpoint tells you how many notifications exist.
            var notification = await dbContext.Notifications.FirstOrDefaultAsync(
                n => n.Id == notificationId && n.UserId == user.Id,
                cancellationToken
            );

            if (notification is null)
                return TypedResults.NotFound(new ApiMessageResponse("Notification not found"));

            notification.ReadAt ??= DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);

            return TypedResults.Ok(
                new NotificationDetails(
                    notification.Id,
                    notification.Kind,
                    notification.ActorId,
                    notification.ActorName,
                    notification.ProjectId,
                    notification.TaskId,
                    notification.TaskName,
                    notification.CommentId,
                    notification.CreatedAt,
                    IsRead: true
                )
            );
        }
    }
}
