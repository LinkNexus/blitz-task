using BlitzTask.Backend.Features.Shared.Services;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Scheduling;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.ProjectTasks
{
    /// <summary>
    /// Sends the reminders that have come due. See <see cref="TaskReminder"/> for why the firing
    /// time is materialised rather than computed here.
    /// </summary>
    public class TaskReminderJob(
        ApplicationDbContext dbContext,
        MailerService mailerService,
        ILogger<TaskReminderJob> logger
    ) : IScheduledJob
    {
        public string Name => "task-reminders";

        // Matches the runner's tick: a reminder an hour late is a reminder that failed.
        public TimeSpan Interval => TimeSpan.FromMinutes(1);

        public async Task RunAsync(CancellationToken cancellationToken)
        {
            var now = DateTime.UtcNow;

            var due = await dbContext
                .TaskReminders
                // `SentAt < RemindAt` rather than `SentAt == null`: pushing a due date forward
                // moves RemindAt past the old send, which re-arms the reminder. Checking only
                // for null would fire once and then stay silent for the rest of the task's life,
                // however far the deadline moved.
                .Where(r => r.RemindAt <= now && (r.SentAt == null || r.SentAt < r.RemindAt))
                // A reminder about finished work is noise. Same definition of "done" as
                // everywhere else: the task sits in its project's last column.
                .Where(r =>
                    r.ProjectTask.DueDate != null
                    && r.ProjectTask.RelatedProject.Columns.Any(c =>
                        c.Score > r.ProjectTask.RelatedColumn.Score
                    )
                )
                .Select(r => new
                {
                    Reminder = r,
                    r.User.Name,
                    r.User.Email,
                    TaskName = r.ProjectTask.Name,
                    ProjectName = r.ProjectTask.RelatedProject.Name,
                    r.ProjectTask.DueDate,
                    ProjectId = r.ProjectTask.RelatedProjectId,
                })
                .ToListAsync(cancellationToken);

            foreach (var item in due)
            {
                try
                {
                    await mailerService.SendEmailAsync(
                        new EmailMessage(
                            To: [item.Email],
                            Subject: $"Reminder: {item.TaskName}",
                            TemplateName: "TaskReminder",
                            TemplateModel: new TaskReminderEmailModel(
                                UserName: item.Name,
                                TaskName: item.TaskName,
                                ProjectName: item.ProjectName,
                                DueDateText: item.DueDate!.Value.UtcDateTime.ToString("f") + " UTC",
                                TaskLink: $"/projects/{item.ProjectId}"
                            )
                        )
                    );

                    // Marked only after the send returns. A crash before this repeats the email
                    // on the next tick, which is the right way round: a duplicate reminder is an
                    // annoyance, a missed one defeats the feature.
                    item.Reminder.SentAt = now;
                }
                catch (Exception exception)
                {
                    // One undeliverable address must not block everyone else's reminders.
                    logger.LogError(
                        exception,
                        "Failed to send reminder {ReminderId} to {Email}",
                        item.Reminder.Id,
                        item.Email
                    );
                }
            }

            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }
}
