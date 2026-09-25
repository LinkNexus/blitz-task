using System.Net;
using System.Security.Cryptography;
using BlitzTask.Backend.Features.Notifications;
using BlitzTask.Backend.Features.Push;
using BlitzTask.Backend.Infrastructure.Data;
using Lib.Net.Http.WebPush;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using static BlitzTask.Backend.Tests.Features.ProjectTasks.UserTasksTestData;

namespace BlitzTask.Backend.Tests.Features.Push;

/// <summary>
/// A notification written by any handler should buzz the person it is for, without that handler
/// knowing push exists (L32.5 follow-up).
/// </summary>
public class PushNotificationInterceptorTests
{
    private sealed class CountingHandler(HttpStatusCode status) : HttpMessageHandler
    {
        public int Requests { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken
        )
        {
            Requests++;
            return Task.FromResult(new HttpResponseMessage(status));
        }
    }

    private static string B64(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static string BrowserKey()
    {
        using var ecdh = ECDiffieHellman.Create(ECCurve.NamedCurves.nistP256);
        var q = ecdh.ExportParameters(false).Q;
        var point = new byte[65];
        point[0] = 0x04;
        q.X!.CopyTo(point, 1);
        q.Y!.CopyTo(point, 33);
        return B64(point);
    }

    /// <summary>
    /// A context wired the way the app wires it — the interceptor only proves anything if EF
    /// actually calls it, so this builds the real provider rather than invoking it by hand.
    /// </summary>
    private static (ServiceProvider Provider, CountingHandler Handler) BuildAsync(
        SqliteConnection connection,
        HttpStatusCode status = HttpStatusCode.Created
    )
    {
        var handler = new CountingHandler(status);
        var (publicKey, privateKey) = VapidKeyGenerator.Generate();

        var services = new ServiceCollection();
        services.AddLogging();
        services.Configure<PushSettings>(o =>
        {
            o.PublicKey = publicKey;
            o.PrivateKey = privateKey;
            o.Subject = "mailto:test@example.com";
        });
        services.AddSingleton(new PushServiceClient(new HttpClient(handler)));
        services.AddScoped<PushSender>();
        services.AddScoped<PushNotificationInterceptor>();
        services.AddDbContext<ApplicationDbContext>(
            (provider, options) =>
                options
                    .UseSqlite(connection)
                    .AddInterceptors(provider.GetRequiredService<PushNotificationInterceptor>())
        );

        return (services.BuildServiceProvider(), handler);
    }

    [Fact]
    public async Task WritingANotificationPushesToThatPersonsDevice()
    {
        using var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();

        var (provider, handler) = BuildAsync(connection);
        using var scope = provider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        dbContext.Database.EnsureCreated();

        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        dbContext.PushSubscriptions.Add(
            new BlitzTask.Backend.Features.Push.PushSubscription
            {
                UserId = bob.Id,
                Endpoint = "https://push.example.com/bob",
                P256dh = BrowserKey(),
                Auth = B64(RandomNumberGenerator.GetBytes(16)),
            }
        );
        await dbContext.SaveChangesAsync();

        var before = handler.Requests;

        // No handler asked for this. The notification is written and the push follows.
        dbContext.Notifications.Add(
            new Notification
            {
                UserId = bob.Id,
                Kind = NotificationKind.TASK_ASSIGNED,
                ActorId = alice.Id,
                ActorName = "Ada",
                ProjectId = project.Id,
                TaskId = task.Id,
                TaskName = task.Name,
            }
        );
        await dbContext.SaveChangesAsync();

        Assert.Equal(before + 1, handler.Requests);
    }

    [Fact]
    public async Task ASaveWithNoNotificationsPushesNothing()
    {
        using var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();

        var (provider, handler) = BuildAsync(connection);
        using var scope = provider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        dbContext.Database.EnsureCreated();

        await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");

        // Every write in the app goes through this interceptor; only the ones that tell somebody
        // something should cost a request.
        Assert.Equal(0, handler.Requests);
    }

    [Fact]
    public async Task PruningASubscriptionDoesNotReenterTheInterceptor()
    {
        using var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();

        var (provider, handler) = BuildAsync(connection, HttpStatusCode.Gone);
        using var scope = provider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        dbContext.Database.EnsureCreated();

        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        dbContext.PushSubscriptions.Add(
            new BlitzTask.Backend.Features.Push.PushSubscription
            {
                UserId = alice.Id,
                Endpoint = "https://push.example.com/dead",
                P256dh = BrowserKey(),
                Auth = B64(RandomNumberGenerator.GetBytes(16)),
            }
        );
        await dbContext.SaveChangesAsync();

        dbContext.Notifications.Add(
            new Notification
            {
                UserId = alice.Id,
                Kind = NotificationKind.MENTIONED_IN_COMMENT,
                ActorId = alice.Id,
                ActorName = "Ada",
                ProjectId = project.Id,
                TaskId = task.Id,
                TaskName = task.Name,
            }
        );
        await dbContext.SaveChangesAsync();

        // The send deletes the dead subscription, which is itself a SaveChanges. Run on the same
        // context it would land back in this interceptor; the send gets its own scope precisely
        // so it cannot. One request, one pruned row, no recursion.
        Assert.Equal(1, handler.Requests);
        Assert.False(await dbContext.PushSubscriptions.AnyAsync());
    }
}
