using System.Net;
using System.Text.Json;
using BlitzTask.Backend.Infrastructure.Data;
using Lib.Net.Http.WebPush;
using Lib.Net.Http.WebPush.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PushMessage = Lib.Net.Http.WebPush.PushMessage;

namespace BlitzTask.Backend.Features.Push
{
    /// <summary>What a push says, and where tapping it should land.</summary>
    public record PushPayload(string Title, string Body, string Url);

    /// <summary>
    /// Delivers a push to every device a person has registered.
    /// <para>
    /// <b>Swallows its own failures, like the realtime interceptor.</b> A push is a hint that
    /// something happened; the database is the record. A push service being slow or down must
    /// never fail the write that prompted it, or a task assignment would roll back because
    /// somebody's phone was unreachable.
    /// </para>
    /// </summary>
    public class PushSender(
        PushServiceClient client,
        ApplicationDbContext dbContext,
        IOptions<PushSettings> settings,
        ILogger<PushSender> logger
    )
    {
        private static readonly JsonSerializerOptions PayloadOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        };

        /// <returns>
        /// Whether the caller may consider this push delivered.
        /// <para>
        /// <b>Needed because this method swallows its own failures.</b> Not throwing is right —
        /// a push service having a bad minute must never fail the write that prompted it — but a
        /// caller that records "push sent" has to be able to tell delivery from silence, or a
        /// channel that never worked is marked done anyway. That is how the per-channel
        /// timestamps would have quietly stopped meaning anything.
        /// </para>
        /// <para>
        /// A person with no devices, or an instance with no keys, counts as delivered: there is
        /// nothing outstanding to retry. A subscription the service has forgotten does not count
        /// against it either — it was pruned, not missed.
        /// </para>
        /// </returns>
        public async Task<bool> SendAsync(
            IEnumerable<int> userIds,
            PushPayload payload,
            CancellationToken cancellationToken = default
        )
        {
            var options = settings.Value;
            if (!options.IsConfigured)
                return true;

            var ids = userIds.Distinct().ToList();
            if (ids.Count == 0)
                return true;

            var subscriptions = await dbContext
                .PushSubscriptions.Where(s => ids.Contains(s.UserId))
                .ToListAsync(cancellationToken);

            if (subscriptions.Count == 0)
                return true;

            client.DefaultAuthentication = new VapidAuthentication(
                options.PublicKey!,
                options.PrivateKey!
            )
            {
                Subject = options.Subject!,
            };

            var message = new PushMessage(JsonSerializer.Serialize(payload, PayloadOptions))
            {
                Topic = "blitz-task",
            };

            var gone = new List<PushSubscription>();
            var failed = false;

            foreach (var subscription in subscriptions)
            {
                try
                {
                    // `SetKey`, not a `Keys = { … }` initialiser: that property starts null, so
                    // the collection-initialiser form throws a NullReferenceException before
                    // any request is made — and this method swallows its own failures, so it
                    // would have looked exactly like a push service that never answered.
                    var target = new Lib.Net.Http.WebPush.PushSubscription
                    {
                        Endpoint = subscription.Endpoint,
                    };
                    target.SetKey(PushEncryptionKeyName.P256DH, subscription.P256dh);
                    target.SetKey(PushEncryptionKeyName.Auth, subscription.Auth);

                    await client.RequestPushMessageDeliveryAsync(
                        target,
                        message,
                        cancellationToken
                    );
                }
                catch (PushServiceClientException ex)
                    when (ex.StatusCode
                            is HttpStatusCode.NotFound
                                or HttpStatusCode.Gone
                    )
                {
                    // A browser drops its subscription whenever site data is cleared or the push
                    // service rotates it, and the endpoint answers Gone forever afterwards.
                    // Without pruning, the table fills with corpses that every later send pays
                    // to contact.
                    gone.Add(subscription);
                }
                catch (Exception ex)
                {
                    failed = true;
                    logger.LogWarning(
                        ex,
                        "Push delivery failed for subscription {SubscriptionId}",
                        subscription.Id
                    );
                }
            }

            if (gone.Count > 0)
            {
                dbContext.PushSubscriptions.RemoveRange(gone);
                await dbContext.SaveChangesAsync(cancellationToken);
            }

            return !failed;
        }
    }
}
