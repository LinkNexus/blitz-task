using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Extensions;
using BlitzTask.Backend.Infrastructure.Filters;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.ProjectTasks
{
    public static class TaskRemindersEndpoints
    {
        public static IEndpointRouteBuilder MapTaskRemindersEndpoints(
            this IEndpointRouteBuilder app
        )
        {
            // Only project membership is required, not ManageTasks: a reminder is the caller's
            // own note to self, so anyone who can see the task can set one — including a Viewer,
            // who cannot change the task itself.
            var group = app.MapGroup("/api/{projectId:int}/tasks/{taskId:int}/reminders")
                .WithTags("Task Reminders")
                .RequireAuthorization("EmailConfirmed")
                .AddEndpointFilter(new RequireProjectPermissionFilter());

            group
                .MapGet("", ListReminders)
                .WithName("list-task-reminders")
                .Produces<List<TaskReminderDetails>>();

            group
                .MapPost("", CreateReminder)
                .WithName("create-task-reminder")
                .Produces<TaskReminderDetails>(StatusCodes.Status201Created)
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound)
                .Produces<ApiMessageResponse>(StatusCodes.Status409Conflict);

            group
                .MapDelete("/{reminderId:int}", DeleteReminder)
                .WithName("delete-task-reminder")
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ApiMessageResponse>(StatusCodes.Status404NotFound);

            return app;
        }

        public static async Task<Ok<List<TaskReminderDetails>>> ListReminders(
            int projectId,
            int taskId,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();

            // Scoped to the caller: reminders are private, so one member must not see — or be
            // able to delete — another's.
            var reminders = await dbContext
                .TaskReminders.Where(r =>
                    r.ProjectTaskId == taskId
                    && r.UserId == user.Id
                    && r.ProjectTask.RelatedProjectId == projectId
                )
                .OrderBy(r => r.MinutesBeforeDue)
                .Select(r => new TaskReminderDetails(
                    r.Id,
                    r.MinutesBeforeDue,
                    r.RemindAt,
                    r.SentAt
                ))
                .ToListAsync(cancellationToken);

            return TypedResults.Ok(reminders);
        }

        public static async Task<
            Results<
                JsonHttpResult<TaskReminderDetails>,
                NotFound<ApiMessageResponse>,
                Conflict<ApiMessageResponse>
            >
        > CreateReminder(
            int projectId,
            int taskId,
            CreateTaskReminderRequest request,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();

            var task = await dbContext
                .ProjectTasks.Where(t => t.Id == taskId && t.RelatedProjectId == projectId)
                .FirstOrDefaultAsync(cancellationToken);

            if (task is null)
                return TypedResults.NotFound(new ApiMessageResponse("Task not found"));

            // A reminder is defined relative to the due date, so without one there is nothing to
            // be relative to. Rejecting here beats storing an unfireable row.
            if (task.DueDate is null)
            {
                return TypedResults.NotFound(
                    new ApiMessageResponse("This task has no due date to remind you about")
                );
            }

            var alreadyExists = await dbContext.TaskReminders.AnyAsync(
                r =>
                    r.ProjectTaskId == taskId
                    && r.UserId == user.Id
                    && r.MinutesBeforeDue == request.MinutesBeforeDue,
                cancellationToken
            );

            if (alreadyExists)
            {
                return TypedResults.Conflict(
                    new ApiMessageResponse("You already have a reminder set for that time")
                );
            }

            var reminder = new TaskReminder
            {
                ProjectTaskId = taskId,
                UserId = user.Id,
                MinutesBeforeDue = request.MinutesBeforeDue,
                RemindAt = TaskReminder.ResolveRemindAt(
                    task.DueDate.Value,
                    request.MinutesBeforeDue
                ),
            };

            dbContext.TaskReminders.Add(reminder);
            await dbContext.SaveChangesAsync(cancellationToken);

            return TypedResults.Json(
                new TaskReminderDetails(
                    reminder.Id,
                    reminder.MinutesBeforeDue,
                    reminder.RemindAt,
                    reminder.SentAt
                ),
                statusCode: StatusCodes.Status201Created
            );
        }

        public static async Task<Results<NoContent, NotFound<ApiMessageResponse>>> DeleteReminder(
            int projectId,
            int taskId,
            int reminderId,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();

            var deleted = await dbContext
                .TaskReminders.Where(r =>
                    r.Id == reminderId
                    && r.ProjectTaskId == taskId
                    && r.UserId == user.Id
                    && r.ProjectTask.RelatedProjectId == projectId
                )
                .ExecuteDeleteAsync(cancellationToken);

            return deleted == 0
                ? TypedResults.NotFound(new ApiMessageResponse("Reminder not found"))
                : TypedResults.NoContent();
        }
    }
}
