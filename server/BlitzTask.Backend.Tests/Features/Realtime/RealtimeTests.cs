using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Notifications;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Realtime;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using static BlitzTask.Backend.Tests.Features.ProjectTasks.UserTasksTestData;

namespace BlitzTask.Backend.Tests.Features.Realtime;

/// <summary>
/// The realtime layer. Two things are worth pinning, and neither is "does SignalR work".
/// <para>
/// The first is that <b>nothing has to remember to publish</b> — the interceptor derives it from
/// what was written, so a feature added later cannot be the one that silently does not update.
/// The second is that a connection joins the groups the <b>server</b> chooses, since a group the
/// client names is a live feed of someone else's project waiting for an authorization slip.
/// </para>
/// </summary>
public class RealtimeTests
{
    /// <summary>
    /// Records what was sent where. `SendAsync` is an extension over `SendCoreAsync`, so the
    /// mock has to catch the latter — the method name and arguments arrive as plain values.
    /// </summary>
    private sealed class SentMessages
    {
        public List<(string Group, string Method, object?[] Args)> Sent { get; } = [];

        public IHubContext<RealtimeHub> HubContext()
        {
            var clients = new Mock<IHubClients>();
            var hub = new Mock<IHubContext<RealtimeHub>>();

            clients
                .Setup(c => c.Group(It.IsAny<string>()))
                .Returns((string group) =>
                {
                    var proxy = new Mock<IClientProxy>();
                    proxy
                        .Setup(p => p.SendCoreAsync(
                            It.IsAny<string>(),
                            It.IsAny<object?[]>(),
                            It.IsAny<CancellationToken>()
                        ))
                        .Callback((string method, object?[] args, CancellationToken _) =>
                            Sent.Add((group, method, args))
                        )
                        .Returns(Task.CompletedTask);
                    return proxy.Object;
                });

            hub.Setup(h => h.Clients).Returns(clients.Object);
            return hub.Object;
        }
    }

    private static ApplicationDbContext CreateContextWithInterceptor(
        SentMessages sent,
        User? actor = null
    )
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();

        var httpContext = new DefaultHttpContext();
        if (actor is not null)
            httpContext.Items["CurrentUser"] = actor;

        var accessor = new Mock<IHttpContextAccessor>();
        accessor.Setup(a => a.HttpContext).Returns(actor is null ? null : httpContext);

        var interceptor = new RealtimePublishInterceptor(
            sent.HubContext(),
            accessor.Object,
            NullLogger<RealtimePublishInterceptor>.Instance
        );

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(connection)
            .AddInterceptors(interceptor)
            .Options;

        var dbContext = new ApplicationDbContext(options);
        dbContext.Database.EnsureCreated();
        return dbContext;
    }

    [Fact]
    public async Task WritingATaskAnnouncesItsProject_WithoutAnyHandlerSayingSo()
    {
        var sent = new SentMessages();
        using var dbContext = CreateContextWithInterceptor(sent);

        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        sent.Sent.Clear();

        await SeedTaskAsync(dbContext, project, todo, "Ship it");

        // Nothing in SeedTaskAsync knows this feature exists — which is the point of deriving
        // the publish from what was written rather than from a call someone has to remember.
        var message = Assert.Single(sent.Sent);
        Assert.Equal(RealtimeGroups.Project(project.Id), message.Group);
        Assert.Equal(RealtimeMessages.ProjectChanged, message.Method);

        var payload = Assert.IsType<ProjectChangedEvent>(message.Args[0]);
        Assert.Equal(project.Id, payload.ProjectId);
    }

    [Fact]
    public async Task TheChangeCarriesWhoCausedIt_SoAClientCanIgnoreItsOwnEcho()
    {
        var sent = new SentMessages();
        var actor = new User
        {
            Id = 42,
            Name = "Alice",
            Email = "alice@example.com",
            Password = "x",
        };

        using var dbContext = CreateContextWithInterceptor(sent, actor);

        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        sent.Sent.Clear();

        await SeedTaskAsync(dbContext, project, todo, "Ship it");

        var payload = Assert.IsType<ProjectChangedEvent>(Assert.Single(sent.Sent).Args[0]);

        // The client that made the change already applied it optimistically; refetching over the
        // top of an in-flight drag is the jump this feature exists to prevent.
        Assert.Equal(42, payload.ActorId);
    }

    [Fact]
    public async Task AWriteWithNoRequestBehindItStillPublishes_WithNobodyToClaimIt()
    {
        // The reminder sweep and the purge job save through the same context with no HttpContext
        // at all. They must not throw, and nobody should be able to treat their changes as an
        // echo of their own action.
        var sent = new SentMessages();
        using var dbContext = CreateContextWithInterceptor(sent, actor: null);

        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        sent.Sent.Clear();

        await SeedTaskAsync(dbContext, project, todo, "Ship it");

        var payload = Assert.IsType<ProjectChangedEvent>(Assert.Single(sent.Sent).Args[0]);
        Assert.Null(payload.ActorId);
    }

    [Fact]
    public async Task OneSaveTouchingTwoProjectsAnnouncesBoth_Once_Each()
    {
        var sent = new SentMessages();
        using var dbContext = CreateContextWithInterceptor(sent);

        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (first, firstTodo, _) = await SeedProjectAsync(dbContext, "First", alice.Id);
        var (second, secondTodo, _) = await SeedProjectAsync(dbContext, "Second", alice.Id);

        var a = await SeedTaskAsync(dbContext, first, firstTodo, "A");
        var b = await SeedTaskAsync(dbContext, second, secondTodo, "B");
        sent.Sent.Clear();

        // Two tasks in two projects, plus a third change in one of them, in a single save.
        a.Name = "A renamed";
        b.Name = "B renamed";
        await dbContext.ProjectTasks.AddAsync(
            new ProjectTask
            {
                Name = "C",
                Description = "",
                Score = 1,
                RelatedColumnId = firstTodo.Id,
                RelatedProjectId = first.Id,
            }
        );
        await dbContext.SaveChangesAsync();

        // A set, not a list: three changed rows across two projects is two messages, because the
        // client's answer to each is the same single refetch.
        Assert.Equal(2, sent.Sent.Count);
        Assert.Contains(sent.Sent, m => m.Group == RealtimeGroups.Project(first.Id));
        Assert.Contains(sent.Sent, m => m.Group == RealtimeGroups.Project(second.Id));
    }

    [Fact]
    public async Task ANotificationIsAnnouncedToItsOwnerAlone()
    {
        var sent = new SentMessages();
        using var dbContext = CreateContextWithInterceptor(sent);

        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");
        sent.Sent.Clear();

        dbContext.Notifications.Add(
            new Notification
            {
                UserId = bob.Id,
                Kind = NotificationKind.TASK_ASSIGNED,
                ActorId = alice.Id,
                ActorName = alice.Name,
                ProjectId = project.Id,
                TaskId = task.Id,
                TaskName = task.Name,
            }
        );
        await dbContext.SaveChangesAsync();

        // The personal channel, not the project one: a notification is addressed to a person.
        Assert.Contains(
            sent.Sent,
            m =>
                m.Group == RealtimeGroups.User(bob.Id)
                && m.Method == RealtimeMessages.NotificationsChanged
        );
        Assert.DoesNotContain(sent.Sent, m => m.Group == RealtimeGroups.User(alice.Id));
    }

    [Fact]
    public async Task ASaveThatChangesNothingInterestingSaysNothing()
    {
        var sent = new SentMessages();
        using var dbContext = CreateContextWithInterceptor(sent);

        await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        sent.Sent.Clear();

        await dbContext.SaveChangesAsync();

        // A user row belongs to no project and is nobody's notification. Publishing on every
        // save would wake every board in the app on an unrelated write.
        Assert.Empty(sent.Sent);
    }

    [Fact]
    public async Task APushFailureDoesNotFailTheWrite()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();

        var clients = new Mock<IHubClients>();
        clients.Setup(c => c.Group(It.IsAny<string>())).Throws(new InvalidOperationException("boom"));
        var hub = new Mock<IHubContext<RealtimeHub>>();
        hub.Setup(h => h.Clients).Returns(clients.Object);

        var accessor = new Mock<IHttpContextAccessor>();
        accessor.Setup(a => a.HttpContext).Returns((HttpContext?)null);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(connection)
            .AddInterceptors(
                new RealtimePublishInterceptor(
                    hub.Object,
                    accessor.Object,
                    NullLogger<RealtimePublishInterceptor>.Instance
                )
            )
            .Options;

        using var dbContext = new ApplicationDbContext(options);
        dbContext.Database.EnsureCreated();

        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        // The database is the record; the push is a hint that it moved. A client that misses one
        // is stale, which it already could be — a write that fails because a socket did is worse.
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        Assert.Equal("Ship it", (await dbContext.ProjectTasks.SingleAsync(t => t.Id == task.Id)).Name);
    }
}
