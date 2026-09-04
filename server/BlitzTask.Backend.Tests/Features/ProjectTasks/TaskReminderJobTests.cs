using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectColumns;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Shared.Services;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RazorLight;

namespace BlitzTask.Backend.Tests.Features.ProjectTasks;

/// <summary>
/// Covers which reminders the sweep picks up. Real SQLite, because the selection is one
/// translated query and the completion check is a correlated subquery.
/// </summary>
public class TaskReminderJobTests
{
    /// <summary>
    /// Captures the delivery instead of performing it, by overriding only the transport.
    /// The base class still renders the real template off disk — the backend's
    /// <c>Templates/Email</c> is copied into the test output — so these tests also prove
    /// <c>TaskReminder.cshtml</c> compiles and its model binds. Rendering failures rethrow, so
    /// a broken template fails the test rather than passing quietly.
    /// </summary>
    private sealed class RecordingMailer()
        : MailerService(
            new RazorLightEngineBuilder()
                .UseFileSystemProject(Path.Combine(AppContext.BaseDirectory, "Templates", "Email"))
                .UseMemoryCachingProvider()
                .Build(),
            NullLogger.Instance
        )
    {
        public List<(string To, string Html)> Sent { get; } = [];

        protected override Task SendEmailInternalAsync(EmailMessage message, string htmlBody)
        {
            Sent.Add((message.To[0], htmlBody));
            return Task.CompletedTask;
        }
    }

    private static async Task<(ProjectTask Task, User Owner)> SeedTaskAsync(
        ApplicationDbContext dbContext,
        DateTimeOffset? dueDate,
        bool completed = false
    )
    {
        var owner = await TestsUtils.SeedUserAsync(dbContext, $"u{Guid.NewGuid():N}@example.com");
        var todo = new ProjectColumn { Name = "Todo", Color = "#fff", Score = 0 };
        var done = new ProjectColumn { Name = "Done", Color = "#000", Score = 1000 };
        var project = new Project
        {
            Name = "Alpha",
            Description = "",
            CreatedById = owner.Id,
            Columns = [todo, done],
        };
        project.Participants.Add(
            new ProjectParticipant { UserId = owner.Id, Role = ProjectRole.Owner }
        );
        dbContext.Projects.Add(project);
        await dbContext.SaveChangesAsync();

        var task = new ProjectTask
        {
            Name = "Ship it",
            Description = "",
            Score = 1,
            DueDate = dueDate,
            RelatedProjectId = project.Id,
            RelatedColumnId = completed ? done.Id : todo.Id,
        };
        dbContext.ProjectTasks.Add(task);
        await dbContext.SaveChangesAsync();
        return (task, owner);
    }

    private static async Task<TaskReminder> SeedReminderAsync(
        ApplicationDbContext dbContext,
        ProjectTask task,
        User user,
        int minutesBeforeDue,
        DateTime? sentAt = null
    )
    {
        var reminder = new TaskReminder
        {
            ProjectTaskId = task.Id,
            UserId = user.Id,
            MinutesBeforeDue = minutesBeforeDue,
            RemindAt = TaskReminder.ResolveRemindAt(task.DueDate!.Value, minutesBeforeDue),
            SentAt = sentAt,
        };
        dbContext.TaskReminders.Add(reminder);
        await dbContext.SaveChangesAsync();
        return reminder;
    }

    private static async Task<RecordingMailer> RunAsync(ApplicationDbContext dbContext)
    {
        var mailer = new RecordingMailer();
        await new TaskReminderJob(dbContext, mailer, NullLogger<TaskReminderJob>.Instance)
            .RunAsync(CancellationToken.None);
        return mailer;
    }

    [Fact]
    public async Task SendsAReminderThatHasComeDue()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var (task, owner) = await SeedTaskAsync(dbContext, DateTimeOffset.UtcNow.AddMinutes(30));
        var reminder = await SeedReminderAsync(dbContext, task, owner, minutesBeforeDue: 60);

        var mailer = await RunAsync(dbContext);

        Assert.NotNull(await dbContext.TaskReminders.Select(r => r.SentAt).SingleAsync());
        Assert.Equal(reminder.Id, (await dbContext.TaskReminders.SingleAsync()).Id);

        var (to, html) = Assert.Single(mailer.Sent);
        Assert.Equal(owner.Email, to);
        Assert.Contains("Ship it", html);
        Assert.Contains("Alpha", html);
    }

    [Fact]
    public async Task LeavesAReminderThatIsNotDueYet()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var (task, owner) = await SeedTaskAsync(dbContext, DateTimeOffset.UtcNow.AddDays(5));
        await SeedReminderAsync(dbContext, task, owner, minutesBeforeDue: 60);

        await RunAsync(dbContext);

        Assert.Null(await dbContext.TaskReminders.Select(r => r.SentAt).SingleAsync());
    }

    [Fact]
    public async Task DoesNotSendTheSameReminderTwice()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var (task, owner) = await SeedTaskAsync(dbContext, DateTimeOffset.UtcNow.AddMinutes(30));
        await SeedReminderAsync(dbContext, task, owner, minutesBeforeDue: 60);

        await RunAsync(dbContext);
        var firstSend = await dbContext.TaskReminders.Select(r => r.SentAt).SingleAsync();
        dbContext.ChangeTracker.Clear();
        await RunAsync(dbContext);

        Assert.Equal(firstSend, await dbContext.TaskReminders.Select(r => r.SentAt).SingleAsync());
    }

    [Fact]
    public async Task ReArmsWhenTheDueDateMovesForward()
    {
        // The reason SentAt is compared against RemindAt rather than merely checked for null.
        // Push the deadline out and the reminder must fire again for the new one; a null check
        // would fire once and stay silent however far the task was rescheduled.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var (task, owner) = await SeedTaskAsync(dbContext, DateTimeOffset.UtcNow.AddMinutes(30));
        var reminder = await SeedReminderAsync(
            dbContext,
            task,
            owner,
            minutesBeforeDue: 60,
            sentAt: DateTime.UtcNow.AddMinutes(-5)
        );

        // Rescheduled a week out, then back to "due in 30 minutes" — RemindAt now sits after the
        // recorded send.
        reminder.RemindAt = DateTime.UtcNow.AddMinutes(-1);
        await dbContext.SaveChangesAsync();

        await RunAsync(dbContext);

        var sentAt = await dbContext.TaskReminders.Select(r => r.SentAt).SingleAsync();
        Assert.True(sentAt > reminder.RemindAt);
    }

    [Fact]
    public async Task SkipsRemindersForCompletedTasks()
    {
        // A reminder about finished work is noise. "Done" is the same definition used everywhere
        // else: the task sits in its project's last column.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var (task, owner) = await SeedTaskAsync(
            dbContext,
            DateTimeOffset.UtcNow.AddMinutes(30),
            completed: true
        );
        await SeedReminderAsync(dbContext, task, owner, minutesBeforeDue: 60);

        await RunAsync(dbContext);

        Assert.Null(await dbContext.TaskReminders.Select(r => r.SentAt).SingleAsync());
    }

    [Fact]
    public void ResolveRemindAt_SubtractsTheOffsetInUtc()
    {
        var due = new DateTimeOffset(2026, 9, 10, 23, 0, 0, TimeSpan.FromHours(2));

        // 23:00+02:00 is 21:00 UTC; a day earlier is the 9th at 21:00 UTC.
        Assert.Equal(
            new DateTime(2026, 9, 9, 21, 0, 0, DateTimeKind.Utc),
            TaskReminder.ResolveRemindAt(due, minutesBeforeDue: 24 * 60)
        );
    }
}
