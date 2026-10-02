using System.Security.Cryptography;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Features.Shared.Services;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Extensions;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.Calendar
{
    public static class CalendarEndpoints
    {
        public static IEndpointRouteBuilder MapCalendarEndpoints(this IEndpointRouteBuilder app)
        {
            // Cross-project like GET /api/tasks, so membership is enforced inside the query
            // rather than by RequireProjectPermissionFilter — there is no single projectId here.
            var group = app.MapGroup("/api/calendar")
                .WithTags("Calendar")
                .RequireAuthorization("EmailConfirmed");

            group
                .MapGet("", GetCalendar)
                .WithName("get-calendar")
                .Produces<List<CalendarItem>>()
                .Produces<ApiMessageResponse>(StatusCodes.Status400BadRequest);

            group
                .MapGet("/feed", GetFeedSubscription)
                .WithName("get-calendar-feed")
                .Produces<CalendarFeedSubscription>();

            group
                .MapPost("/feed", CreateFeedSubscription)
                .WithName("create-calendar-feed")
                .Produces<CalendarFeedSubscription>();

            group
                .MapDelete("/feed", DeleteFeedSubscription)
                .WithName("delete-calendar-feed")
                .Produces(StatusCodes.Status204NoContent);

            // Deliberately outside the authorized group. Nothing polling this can hold a cookie,
            // let alone an antiforgery token — the URL's secret *is* the credential, which is
            // also why it is the one endpoint here that must never be guessable.
            app.MapGet("/api/calendar/feed/{token}.ics", GetIcsFeed)
                .WithTags("Calendar")
                .WithName("get-calendar-ics")
                .AllowAnonymous()
                .ExcludeFromDescription();

            return app;
        }

        /// <summary>
        /// Everything dated that falls inside a window, for every project the caller is in.
        /// <para>
        /// A window rather than a page, and that is the whole reason this is not
        /// <c>GET /api/tasks</c> with another filter. That endpoint answers "the next N things"
        /// and caps at 200 rows; a month view wants *everything* in the range or the grid is
        /// quietly wrong, and the range is what bounds the work instead.
        /// </para>
        /// <para>
        /// It also returns things that are not rows. Projecting recurrences here rather than in
        /// the client is not a preference: <see cref="TaskRecurrence.NextDueDate"/> is where the
        /// weekly-weekday walk and the monthly clamp are defined, and a second implementation in
        /// TypeScript would be a second answer to when a series falls.
        /// </para>
        /// </summary>
        public static async Task<Results<Ok<List<CalendarItem>>, BadRequest<ApiMessageResponse>>> GetCalendar(
            DateTimeOffset from,
            DateTimeOffset to,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken,
            bool assignedToMe = false
        )
        {
            if (to <= from)
                return TypedResults.BadRequest(new ApiMessageResponse("`to` must be after `from`."));

            if ((to - from).TotalDays > CalendarWindow.MaxDays)
            {
                return TypedResults.BadRequest(
                    new ApiMessageResponse(
                        $"A calendar window cannot be longer than {CalendarWindow.MaxDays} days."
                    )
                );
            }

            var items = await CollectAsync(
                dbContext,
                context.GetUser().Id,
                from,
                to,
                assignedToMe,
                cancellationToken
            );

            return TypedResults.Ok(items);
        }

        /// <summary>
        /// The calendar's contents for one person over one window — the whole of what
        /// <see cref="GetCalendar"/> answers, lifted out so the ICS feed is the same query rather
        /// than a second one that drifts. It takes a <b>user id</b> and not an
        /// <see cref="HttpContext"/> for exactly that reason: the feed's caller is a token in a
        /// URL, with no signed-in user to read.
        /// </summary>
        public static async Task<List<CalendarItem>> CollectAsync(
            ApplicationDbContext dbContext,
            int userId,
            DateTimeOffset from,
            DateTimeOffset to,
            bool assignedToMe,
            CancellationToken cancellationToken
        )
        {
            // The caller's role in each of their projects, so every row can say whether it may
            // be dragged. Read once rather than projected per row: ProjectPermissions is a
            // dictionary lookup in C# and nothing EF can translate, and the calendar's rows come
            // from a handful of projects however many days the window covers.
            var roles = await dbContext
                .ProjectParticipants.Where(pp => pp.UserId == userId)
                .ToDictionaryAsync(pp => pp.ProjectId, pp => pp.Role, cancellationToken);

            var query = dbContext
                .ProjectTasks.Where(t => t.RelatedProject.Participants.Any(pp => pp.UserId == userId))
                .Where(t => t.DueDate != null);

            if (assignedToMe)
                query = query.Where(t => t.Assignees.Any(a => a.Id == userId));

            // Anything overlapping the window, not merely due inside it: a task that started last
            // month and is due next month crosses every day of this one, and a calendar that drops
            // it is hiding exactly the long-running work it exists to show. Translated to SQL only
            // because UtcDateTimeOffsetConverter stores these as UTC — see the notes on
            // GET /api/tasks.
            // Overlap, not containment: a span starts before `from` or ends after `to` and still
            // crosses the window. Testing `DueDate <= to && StartDate >= from` would drop exactly
            // the long-running work a calendar exists to show.
            var rows = await query
                .Where(t =>
                    (t.StartDate == null ? t.DueDate : t.StartDate) <= to && t.DueDate >= from
                )
                .OrderBy(t => t.DueDate)
                .Select(t => new
                {
                    t.Id,
                    t.Name,
                    t.Priority,
                    t.StartDate,
                    t.DueDate,
                    t.HasStartTime,
                    t.HasDueTime,
                    t.RelatedProjectId,
                    ProjectName = t.RelatedProject.Name,
                    t.RelatedProject.Accent,
                    ColumnColor = t.RelatedColumn.Color,
                    IsCompleted = !t.RelatedProject.Columns.Any(c => c.Score > t.RelatedColumn.Score),
                    t.RelatedProject.IsInbox,
                })
                .ToListAsync(cancellationToken);

            List<CalendarItem> items =
            [
                .. rows.Select(t => new CalendarItem(
                    t.Id,
                    t.Id,
                    t.Name,
                    t.Priority,
                    t.StartDate,
                    t.DueDate!.Value,
                    t.HasStartTime,
                    t.HasDueTime,
                    t.RelatedProjectId,
                    t.ProjectName,
                    t.Accent,
                    t.ColumnColor,
                    t.IsCompleted,
                    t.IsInbox,
                    IsProjected: false,
                    roles[t.RelatedProjectId].HasPermission(ProjectPermission.ManageTasks)
                )),
            ];

            items.AddRange(
                await ProjectRecurrencesAsync(query, from, to, cancellationToken)
            );

            return items.OrderBy(i => i.DueDate).ToList();
        }


        /// <summary>The caller's subscription URL, or null if they have never made one.</summary>
        public static async Task<Ok<CalendarFeedSubscription>> GetFeedSubscription(
            ApplicationDbContext dbContext,
            HttpContext context,
            AppUrlBuilder urlBuilder,
            CancellationToken cancellationToken
        )
        {
            var userId = context.GetUser().Id;

            var token = await dbContext
                .UserTokens.Where(t => t.UserId == userId && t.Type == UserTokenType.CalendarFeed)
                .Select(t => t.Value)
                .FirstOrDefaultAsync(cancellationToken);

            return TypedResults.Ok(new CalendarFeedSubscription(FeedUrl(urlBuilder, token)));
        }

        /// <summary>
        /// Creates the subscription, or replaces the secret if one already exists.
        /// <para>
        /// One endpoint for both because they are the same intent — "give me a URL" — and because
        /// replacing is the only way to revoke a credential already handed to Google. The old URL
        /// stops working the moment this returns, which is the point, and is why the UI has to
        /// say so before calling it.
        /// </para>
        /// </summary>
        public static async Task<Ok<CalendarFeedSubscription>> CreateFeedSubscription(
            ApplicationDbContext dbContext,
            HttpContext context,
            AppUrlBuilder urlBuilder,
            CancellationToken cancellationToken
        )
        {
            var userId = context.GetUser().Id;

            // Base64**Url**, not Base64: this sits in a path segment that a person copies by hand
            // into another application, and the `+` and `/` of ordinary Base64 would have to
            // survive being pasted, re-encoded and polled by someone else's HTTP client.
            var value = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));

            var existing = await dbContext.UserTokens.FirstOrDefaultAsync(
                t => t.UserId == userId && t.Type == UserTokenType.CalendarFeed,
                cancellationToken
            );

            if (existing is null)
            {
                dbContext.UserTokens.Add(
                    new UserToken
                    {
                        UserId = userId,
                        Type = UserTokenType.CalendarFeed,
                        Value = value,
                        // No expiry. A subscription that stopped working after a month would look
                        // like a broken feed rather than an expired credential, and there is no
                        // prompt anywhere that would tell the user to renew it.
                        ExpiresAt = null,
                    }
                );
            }
            else
            {
                existing.Value = value;
            }

            await dbContext.SaveChangesAsync(cancellationToken);

            return TypedResults.Ok(new CalendarFeedSubscription(FeedUrl(urlBuilder, value)));
        }

        /// <summary>Revokes the subscription. Anything still polling it starts getting 404s.</summary>
        public static async Task<NoContent> DeleteFeedSubscription(
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var userId = context.GetUser().Id;

            await dbContext
                .UserTokens.Where(t => t.UserId == userId && t.Type == UserTokenType.CalendarFeed)
                .ExecuteDeleteAsync(cancellationToken);

            return TypedResults.NoContent();
        }

        /// <summary>
        /// The feed itself: every dated thing the token's owner can see, as iCalendar.
        /// <para>
        /// <b>Every event is all-day, and which day is computed in the subscriber's timezone.</b>
        /// That timezone comes from the URL because it is the only place it can come from: a due
        /// date here is an <i>instant</i> with no time of day anyone ever chose — the picker
        /// writes local midnight — and the server has no user timezone to fall back on.
        /// Publishing the UTC date instead would put every deadline a day early for everyone east
        /// of UTC, whose local midnight is the previous afternoon in UTC. The browser knows its
        /// own zone, so it writes it into the URL when the subscription is made.
        /// </para>
        /// <para>
        /// All-day rather than timed because a timed event renders as a midnight appointment in a
        /// day grid, and what this publishes is a deadline — a property of a day.
        /// </para>
        /// <para>
        /// An unknown token is a <b>404 and nothing else</b>: telling "no such feed" apart from
        /// "revoked" would confirm to someone guessing that a token had once been real.
        /// </para>
        /// </summary>
        public static async Task<Results<ContentHttpResult, NotFound>> GetIcsFeed(
            string token,
            ApplicationDbContext dbContext,
            AppUrlBuilder urlBuilder,
            CancellationToken cancellationToken,
            string? tz = null
        )
        {
            var owner = await dbContext
                .UserTokens.Where(t => t.Value == token && t.Type == UserTokenType.CalendarFeed)
                .Select(t => new { t.UserId, t.User.Name })
                .FirstOrDefaultAsync(cancellationToken);

            if (owner is null)
                return TypedResults.NotFound();

            var zone = ResolveTimeZone(tz);
            var now = DateTimeOffset.UtcNow;

            var items = await CollectAsync(
                dbContext,
                owner.UserId,
                now.AddDays(-CalendarFeed.PastDays),
                now.AddDays(CalendarFeed.FutureDays),
                assignedToMe: false,
                cancellationToken
            );

            var events = items.Select(item =>
            {
                var end = DayIn(item.DueDate, zone);
                var start = item.StartDate is null ? end : DayIn(item.StartDate.Value, zone);

                return new IcsEvent(
                    // Stable across polls, and distinct per occurrence: a projected date has no
                    // row, so several events share one SourceTaskId and a UID built from that
                    // alone would collapse a weekly chore into one event that jumps around.
                    Uid: item.TaskId is int id
                        ? $"task-{id}@blitz-task"
                        : $"task-{item.SourceTaskId}-{end:yyyyMMdd}@blitz-task",
                    Summary: item.Name,
                    Start: start,
                    End: end,
                    Description: item.IsInbox ? "Inbox" : item.ProjectName,
                    Url: item.TaskId is null
                        ? null
                        : urlBuilder.Build(item.IsInbox ? "/inbox" : $"/projects/{item.ProjectId}"),
                    IsCompleted: item.IsCompleted,
                    // A deadline with a time becomes a timed event at that instant. The half
                    // hour is a rendering decision, not a claim about the work: a zero-length
                    // event is drawn inconsistently (Google puts it on the previous day), and a
                    // deadline is a moment rather than a duration, so it gets the smallest block
                    // that reads correctly everywhere. When the task also has a start time and
                    // it genuinely precedes the deadline, the event spans the two instead.
                    StartAt: !item.HasDueTime
                        ? null
                        : item.HasStartTime
                          && item.StartDate is DateTimeOffset s
                          && s < item.DueDate
                            ? s
                            : item.DueDate.AddMinutes(-30),
                    EndAt: item.HasDueTime ? item.DueDate : null
                );
            });

            var body = IcsWriter.Write($"{owner.Name} — Blitz Task", events, now.UtcDateTime);

            // text/calendar is what makes a browser hand this to a calendar application rather
            // than display it.
            return TypedResults.Text(body, "text/calendar; charset=utf-8");
        }

        private static string? FeedUrl(AppUrlBuilder urlBuilder, string? token) =>
            token is null ? null : urlBuilder.Build($"/api/calendar/feed/{token}.ics");

        /// <summary>
        /// Resolves an IANA zone name, falling back to UTC rather than failing.
        /// <para>
        /// A feed that 500s because a timezone database moved a city is worse than one a few
        /// hours out: the subscription simply stops updating, inside an application the user is
        /// not looking at.
        /// </para>
        /// </summary>
        private static TimeZoneInfo ResolveTimeZone(string? id)
        {
            if (string.IsNullOrWhiteSpace(id))
                return TimeZoneInfo.Utc;

            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (Exception exception)
                when (exception is TimeZoneNotFoundException or InvalidTimeZoneException)
            {
                return TimeZoneInfo.Utc;
            }
        }

        private static DateOnly DayIn(DateTimeOffset instant, TimeZoneInfo zone) =>
            DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(instant, zone).DateTime);

        /// <summary>
        /// Walks each live recurrence rule forward through the window, producing the occurrences
        /// that have no row yet.
        /// <para>
        /// Only from tasks that are <b>not complete</b>: completing an instance is what writes the
        /// next one, so a finished occurrence has already handed its future to a real row, and
        /// projecting from it too would draw every date twice.
        /// </para>
        /// </summary>
        private static async Task<List<CalendarItem>> ProjectRecurrencesAsync(
            IQueryable<ProjectTask> query,
            DateTimeOffset from,
            DateTimeOffset to,
            CancellationToken cancellationToken
        )
        {
            var recurring = await query
                .Where(t => t.Recurrence != null)
                .Where(t => t.RelatedProject.Columns.Any(c => c.Score > t.RelatedColumn.Score))
                .Select(t => new
                {
                    t.Id,
                    t.Name,
                    t.Priority,
                    t.StartDate,
                    t.DueDate,
                    t.HasStartTime,
                    t.HasDueTime,
                    t.RelatedProjectId,
                    ProjectName = t.RelatedProject.Name,
                    t.RelatedProject.Accent,
                    ColumnColor = t.RelatedColumn.Color,
                    t.RelatedProject.IsInbox,
                    Recurrence = t.Recurrence!,
                })
                .ToListAsync(cancellationToken);

            List<CalendarItem> projected = [];

            foreach (var task in recurring)
            {
                var due = task.DueDate!.Value;
                // The span is carried forward whole, the same way a real successor carries it.
                var length = task.StartDate is null ? TimeSpan.Zero : due - task.StartDate.Value;

                for (var i = 0; i < CalendarWindow.MaxProjectedPerTask; i++)
                {
                    // notBefore is the previous occurrence itself: this walks the series one step
                    // at a time rather than catching up, because a calendar wants every date in
                    // the window and not just the next one still in the future.
                    due = TaskRecurrence.NextDueDate(task.Recurrence, due, due.AddTicks(-1));

                    if (due > to)
                        break;

                    if (due < from)
                        continue;

                    projected.Add(
                        new CalendarItem(
                            TaskId: null,
                            SourceTaskId: task.Id,
                            task.Name,
                            task.Priority,
                            length == TimeSpan.Zero ? null : due - length,
                            due,
                            task.HasStartTime,
                            task.HasDueTime,
                            task.RelatedProjectId,
                            task.ProjectName,
                            task.Accent,
                            task.ColumnColor,
                            IsCompleted: false,
                            task.IsInbox,
                            IsProjected: true,
                            // No row, nothing to write a date onto. The rule it was computed
                            // from is edited on the task that carries it.
                            CanReschedule: false
                        )
                    );
                }
            }

            return projected;
        }
    }
}
