using BlitzTask.Backend.Features.Push;
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
        PushSender pushSender,
        AppUrlBuilder urlBuilder,
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
                // `< RemindAt` rather than `== null`: pushing a due date forward moves RemindAt
                // past the old send, which re-arms the reminder. Checking only for null would
                // fire once and then stay silent for the rest of the task's life, however far
                // the deadline moved.
                //
                // Either channel outstanding is enough to pick the row up, and each is then
                // judged on its own below — a push that failed last tick must not drag the
                // email along with it.
                .Where(r =>
                    r.RemindAt <= now
                    && (
                        (r.EmailSentAt == null || r.EmailSentAt < r.RemindAt)
                        || (r.PushSentAt == null || r.PushSentAt < r.RemindAt)
                    )
                )
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
                    r.UserId,
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
                var link = urlBuilder.Build($"/projects/{item.ProjectId}");
                var dueText = item.DueDate!.Value.UtcDateTime.ToString("f") + " UTC";

                // Each channel is tried and marked separately. One timestamp for both would mean
                // a failing push re-arming the row and the next tick re-sending the email —
                // exactly the duplicate that "mark sent only after the send returns" prevents.
                if (
                    item.Reminder.PushSentAt is null
                    || item.Reminder.PushSentAt < item.Reminder.RemindAt
                )
                {
                    try
                    {
                        // Marked only if it actually went. The sender swallows its own failures
                        // so a push service outage cannot break anything else, which means the
                        // return value is the only way to tell delivery from silence — and
                        // marking regardless would retire the channel after one failed attempt.
                        var delivered = await pushSender.SendAsync(
                            [item.UserId],
                            new PushPayload(
                                Title: $"Reminder: {item.TaskName}",
                                Body: $"{item.ProjectName} — due {dueText}",
                                Url: $"/projects/{item.ProjectId}"
                            ),
                            cancellationToken
                        );

                        if (delivered)
                            item.Reminder.PushSentAt = now;
                    }
                    catch (Exception exception)
                    {
                        logger.LogError(
                            exception,
                            "Failed to push reminder {ReminderId}",
                            item.Reminder.Id
                        );
                    }
                }

                if (
                    item.Reminder.EmailSentAt is not null
                    && item.Reminder.EmailSentAt >= item.Reminder.RemindAt
                )
                {
                    continue;
                }

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
                                DueDateText: dueText,
                                // Absolute: there is no request here to resolve a
                                // relative href against, and a mail client will not
                                // invent one either.
                                TaskLink: link
                            )
                        )
                    );

                    // Marked only after the send returns. A crash before this repeats the email
                    // on the next tick, which is the right way round: a duplicate reminder is an
                    // annoyance, a missed one defeats the feature.
                    item.Reminder.EmailSentAt = now;
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
