using System.Net;
using System.Security.Cryptography;
using BlitzTask.Backend.Features.Push;
using BlitzTask.Backend.Infrastructure.Data;
using Lib.Net.Http.WebPush;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace BlitzTask.Backend.Tests.Features.Push;

/// <summary>
/// Delivering a push, and — the part that matters over time — forgetting the devices that have
/// stopped existing.
/// </summary>
public class PushSenderTests
{
    /// <summary>Answers every request with one status, so a send can be made to fail on demand.</summary>
    private sealed class StubHandler(HttpStatusCode status) : HttpMessageHandler
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

    private static readonly PushSettings Configured = new()
    {
        // A real P-256 pair: the client signs with it before any request is made, so a
        // placeholder would fail inside the library rather than at the endpoint.
        PublicKey = null,
        PrivateKey = null,
        Subject = "mailto:test@example.com",
    };

    private static PushSettings WorkingKeys()
    {
        var (publicKey, privateKey) = VapidKeyGenerator.Generate();
        return new PushSettings
        {
            PublicKey = publicKey,
            PrivateKey = privateKey,
            Subject = "mailto:test@example.com",
        };
    }

    private static async Task<int> SeedSubscriptionAsync(
        ApplicationDbContext dbContext,
        int userId,
        string endpoint
    )
    {
        var subscription = new BlitzTask.Backend.Features.Push.PushSubscription
        {
            UserId = userId,
            Endpoint = endpoint,
            P256dh = BrowserPublicKey(),
            Auth = Base64Url(RandomNumberGenerator.GetBytes(16)),
        };
        dbContext.PushSubscriptions.Add(subscription);
        await dbContext.SaveChangesAsync();
        return subscription.Id;
    }

    /// <summary>
    /// A real P-256 point, as a browser would hand over.
    /// <para>
    /// It has to be genuine: the payload is encrypted <i>to</i> this key before any request is
    /// made, so a placeholder fails inside the library and the send never reaches the push
    /// service at all — which looks exactly like "nothing was sent" in a test.
    /// </para>
    /// </summary>
    private static string BrowserPublicKey()
    {
        using var key = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var parameters = key.ExportParameters(false);

        var point = new byte[65];
        point[0] = 0x04;
        parameters.Q.X!.CopyTo(point, 1);
        parameters.Q.Y!.CopyTo(point, 33);
        return Base64Url(point);
    }

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static PushSender SenderFor(
        ApplicationDbContext dbContext,
        PushSettings settings,
        HttpMessageHandler handler
    ) =>
        new(
            new PushServiceClient(new HttpClient(handler)),
            dbContext,
            Options.Create(settings),
            NullLogger<PushSender>.Instance
        );

    [Fact]
    public async Task WithNoKeypairConfiguredNothingIsSent()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var user = await TestsUtils.SeedUserAsync(dbContext);
        await SeedSubscriptionAsync(dbContext, user.Id, "https://push.example.com/a");

        var handler = new StubHandler(HttpStatusCode.Created);
        await SenderFor(dbContext, Configured, handler).SendAsync(
            [user.Id],
            new PushPayload("Hi", "There", "/")
        );

        // Push is off until someone configures a pair — not attempted and failing, simply off.
        Assert.Equal(0, handler.Requests);
        Assert.Equal(1, await dbContext.PushSubscriptions.CountAsync());
    }

    [Fact]
    public async Task EveryDeviceAPersonHasIsContacted()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var user = await TestsUtils.SeedUserAsync(dbContext);
        await SeedSubscriptionAsync(dbContext, user.Id, "https://push.example.com/laptop");
        await SeedSubscriptionAsync(dbContext, user.Id, "https://push.example.com/phone");

        var handler = new StubHandler(HttpStatusCode.Created);
        await SenderFor(dbContext, WorkingKeys(), handler).SendAsync(
            [user.Id],
            new PushPayload("Hi", "There", "/")
        );

        // A row per device rather than a column on the user, and this is what that buys.
        Assert.Equal(2, handler.Requests);
        Assert.Equal(2, await dbContext.PushSubscriptions.CountAsync());
    }

    [Theory]
    [InlineData(HttpStatusCode.Gone)]
    [InlineData(HttpStatusCode.NotFound)]
    public async Task ASubscriptionTheServiceHasForgottenIsDeleted(HttpStatusCode status)
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var user = await TestsUtils.SeedUserAsync(dbContext);
        await SeedSubscriptionAsync(dbContext, user.Id, "https://push.example.com/dead");

        await SenderFor(dbContext, WorkingKeys(), new StubHandler(status)).SendAsync(
            [user.Id],
            new PushPayload("Hi", "There", "/")
        );

        // A browser drops its subscription whenever site data is cleared, and the endpoint
        // answers Gone forever after. Without this the table fills with corpses that every
        // later sweep pays to contact.
        Assert.False(await dbContext.PushSubscriptions.AnyAsync());
    }

    [Fact]
    public async Task AFailureThatIsNotGoneKeepsTheSubscription()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var user = await TestsUtils.SeedUserAsync(dbContext);
        await SeedSubscriptionAsync(dbContext, user.Id, "https://push.example.com/flaky");

        await SenderFor(
            dbContext,
            WorkingKeys(),
            new StubHandler(HttpStatusCode.InternalServerError)
        ).SendAsync([user.Id], new PushPayload("Hi", "There", "/"));

        // A push service having a bad minute is not a device that has gone away; deleting on
        // any failure would unsubscribe people for an outage they never noticed.
        Assert.True(await dbContext.PushSubscriptions.AnyAsync());
    }

    [Fact]
    public async Task SomeoneElsesDevicesAreNotContacted()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        await SeedSubscriptionAsync(dbContext, alice.Id, "https://push.example.com/alice");
        await SeedSubscriptionAsync(dbContext, bob.Id, "https://push.example.com/bob");

        var handler = new StubHandler(HttpStatusCode.Created);
        await SenderFor(dbContext, WorkingKeys(), handler).SendAsync(
            [alice.Id],
            new PushPayload("Hi", "There", "/")
        );

        Assert.Equal(1, handler.Requests);
    }
}
