using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Extensions;
using Microsoft.AspNetCore.Http.HttpResults;
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

            var user = context.GetUser();

            var query = dbContext
                .ProjectTasks.Where(t => t.RelatedProject.Participants.Any(pp => pp.UserId == user.Id))
                .Where(t => t.DueDate != null);

            if (assignedToMe)
                query = query.Where(t => t.Assignees.Any(a => a.Id == user.Id));

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
                    t.RelatedProjectId,
                    ProjectName = t.RelatedProject.Name,
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
                    t.RelatedProjectId,
                    t.ProjectName,
                    t.ColumnColor,
                    t.IsCompleted,
                    t.IsInbox,
                    IsProjected: false
                )),
            ];

            items.AddRange(
                await ProjectRecurrencesAsync(query, from, to, cancellationToken)
            );

            return TypedResults.Ok(items.OrderBy(i => i.DueDate).ToList());
        }

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
                    t.RelatedProjectId,
                    ProjectName = t.RelatedProject.Name,
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
                            task.RelatedProjectId,
                            task.ProjectName,
                            task.ColumnColor,
                            IsCompleted: false,
                            task.IsInbox,
                            IsProjected: true
                        )
                    );
                }
            }

            return projected;
        }
    }
}
