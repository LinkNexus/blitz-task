using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectColumns;
using System.Security.Cryptography;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Push;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Shared.Services;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging.Abstractions;
using Lib.Net.Http.WebPush;
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
            Options.Create(new AppSettings { SupportEmail = "help@example.test" }),
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
            EmailSentAt = sentAt,
        };
        dbContext.TaskReminders.Add(reminder);
        await dbContext.SaveChangesAsync();
        return reminder;
    }

    /// <summary>A sender whose every delivery throws, standing in for a push channel that is down.</summary>
    private sealed class FailingHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken
        ) => throw new HttpRequestException("push service unreachable");
    }

    private static async Task<RecordingMailer> RunAsync(ApplicationDbContext dbContext)
    {
        var mailer = new RecordingMailer();
        var urlBuilder = new AppUrlBuilder(
            Options.Create(new AppSettings { BaseUrl = "https://blitz.example.com" }),
            new HttpContextAccessor()
        );
        // A sender with no keypair, which is the honest default: push is simply off until
        // someone configures one, so these tests stay about the email channel.
        var pushSender = new PushSender(
            new PushServiceClient(),
            dbContext,
            Options.Create(new PushSettings()),
            NullLogger<PushSender>.Instance
        );

        await new TaskReminderJob(
            dbContext,
            mailer,
            pushSender,
            urlBuilder,
            NullLogger<TaskReminderJob>.Instance
        ).RunAsync(CancellationToken.None);
        return mailer;
    }

    [Fact]
    public async Task SendsAReminderThatHasComeDue()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var (task, owner) = await SeedTaskAsync(dbContext, DateTimeOffset.UtcNow.AddMinutes(30));
        var reminder = await SeedReminderAsync(dbContext, task, owner, minutesBeforeDue: 60);

        var mailer = await RunAsync(dbContext);

        Assert.NotNull(await dbContext.TaskReminders.Select(r => r.EmailSentAt).SingleAsync());
        Assert.Equal(reminder.Id, (await dbContext.TaskReminders.SingleAsync()).Id);

        var (to, html) = Assert.Single(mailer.Sent);
        Assert.Equal(owner.Email, to);
        Assert.Contains("Ship it", html);
        Assert.Contains("Alpha", html);
        // Proves the shared _Layout rendered and the viewBag reached it.
        Assert.Contains("Blitz Task", html);
        Assert.Contains("help@example.test", html);
    }

    [Fact]
    public async Task LeavesAReminderThatIsNotDueYet()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var (task, owner) = await SeedTaskAsync(dbContext, DateTimeOffset.UtcNow.AddDays(5));
        await SeedReminderAsync(dbContext, task, owner, minutesBeforeDue: 60);

        await RunAsync(dbContext);

        Assert.Null(await dbContext.TaskReminders.Select(r => r.EmailSentAt).SingleAsync());
    }

    [Fact]
    public async Task DoesNotSendTheSameReminderTwice()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var (task, owner) = await SeedTaskAsync(dbContext, DateTimeOffset.UtcNow.AddMinutes(30));
        await SeedReminderAsync(dbContext, task, owner, minutesBeforeDue: 60);

        await RunAsync(dbContext);
        var firstSend = await dbContext.TaskReminders.Select(r => r.EmailSentAt).SingleAsync();
        dbContext.ChangeTracker.Clear();
        await RunAsync(dbContext);

        Assert.Equal(firstSend, await dbContext.TaskReminders.Select(r => r.EmailSentAt).SingleAsync());
    }

    [Fact]
    public async Task ReArmsWhenTheDueDateMovesForward()
    {
        // The reason EmailSentAt is compared against RemindAt rather than merely checked for null.
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

        var sentAt = await dbContext.TaskReminders.Select(r => r.EmailSentAt).SingleAsync();
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

        Assert.Null(await dbContext.TaskReminders.Select(r => r.EmailSentAt).SingleAsync());
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

/// <summary>
/// The per-channel rule (L32.5). One `SentAt` covering email and push means a failing push
/// re-arms the row and the next tick sends the email again — the duplicate that "mark sent only
/// after the send returns" was written to prevent.
/// </summary>
public class ReminderChannelTests
{
    private sealed class FailingHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken
        ) => throw new HttpRequestException("push service unreachable");
    }

    private sealed class SilentMailer()
        : MailerService(
            new RazorLightEngineBuilder()
                .UseFileSystemProject(Path.Combine(AppContext.BaseDirectory, "Templates", "Email"))
                .UseMemoryCachingProvider()
                .Build(),
            Options.Create(new AppSettings { SupportEmail = "help@example.test" }),
            NullLogger.Instance
        )
    {
        public int Sends { get; private set; }

        protected override Task SendEmailInternalAsync(EmailMessage message, string htmlBody)
        {
            Sends++;
            return Task.CompletedTask;
        }
    }

    private static async Task<(SilentMailer Mailer, TaskReminder Reminder)> RunTwiceAsync(
        ApplicationDbContext dbContext
    )
    {
        var owner = await TestsUtils.SeedUserAsync(dbContext, "owner@example.com");
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
            DueDate = DateTimeOffset.UtcNow.AddMinutes(30),
            RelatedProjectId = project.Id,
            RelatedColumnId = todo.Id,
        };
        dbContext.ProjectTasks.Add(task);
        await dbContext.SaveChangesAsync();

        var reminder = new TaskReminder
        {
            ProjectTaskId = task.Id,
            UserId = owner.Id,
            MinutesBeforeDue = 60,
            RemindAt = TaskReminder.ResolveRemindAt(task.DueDate.Value, 60),
        };
        dbContext.TaskReminders.Add(reminder);

        var (publicKey, privateKey) = VapidKeyGenerator.Generate();
        var point = new byte[65];
        point[0] = 0x04;
        using (var ecdh = ECDiffieHellman.Create(ECCurve.NamedCurves.nistP256))
        {
            var q = ecdh.ExportParameters(false).Q;
            q.X!.CopyTo(point, 1);
            q.Y!.CopyTo(point, 33);
        }
        static string B64(byte[] b) =>
            Convert.ToBase64String(b).TrimEnd('=').Replace('+', '-').Replace('/', '_');

        dbContext.PushSubscriptions.Add(
            new BlitzTask.Backend.Features.Push.PushSubscription
            {
                UserId = owner.Id,
                Endpoint = "https://push.example.com/device",
                P256dh = B64(point),
                Auth = B64(RandomNumberGenerator.GetBytes(16)),
            }
        );
        await dbContext.SaveChangesAsync();

        var mailer = new SilentMailer();
        var sender = new PushSender(
            new PushServiceClient(new HttpClient(new FailingHandler())),
            dbContext,
            Options.Create(
                new PushSettings
                {
                    PublicKey = publicKey,
                    PrivateKey = privateKey,
                    Subject = "mailto:test@example.com",
                }
            ),
            NullLogger<PushSender>.Instance
        );

        var urlBuilder = new AppUrlBuilder(
            Options.Create(new AppSettings { BaseUrl = "https://blitz.example.com" }),
            new HttpContextAccessor()
        );

        for (var i = 0; i < 2; i++)
        {
            await new TaskReminderJob(
                dbContext,
                mailer,
                sender,
                urlBuilder,
                NullLogger<TaskReminderJob>.Instance
            ).RunAsync(CancellationToken.None);
        }

        return (mailer, reminder);
    }

    [Fact]
    public async Task APushThatKeepsFailingDoesNotResendTheEmail()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var (mailer, reminder) = await RunTwiceAsync(dbContext);

        // The email went once and stayed sent, even though the push never succeeded and the row
        // therefore stayed selected by the sweep on the second tick.
        Assert.Equal(1, mailer.Sends);
        Assert.NotNull(reminder.EmailSentAt);
        Assert.Null(reminder.PushSentAt);
    }
}
