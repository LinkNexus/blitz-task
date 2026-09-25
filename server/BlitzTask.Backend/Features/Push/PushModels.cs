using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Shared.Models;

namespace BlitzTask.Backend.Features.Push
{
    /// <summary>
    /// The VAPID keypair identifying this server to every push service, plus the address they
    /// should contact if it misbehaves.
    /// <para>
    /// <b>It has to outlive the container.</b> A subscription is bound to the public key it was
    /// created with, so regenerating the pair on a deploy silently invalidates every existing
    /// one — the sends keep returning success-shaped failures and nobody's phone ever buzzes
    /// again. It belongs in the environment next to <c>RESEND_API_KEY</c>, never in a file the
    /// image rebuilds.
    /// </para>
    /// </summary>
    public class PushSettings
    {
        public const string SectionName = "Push";

        public string? PublicKey { get; set; }
        public string? PrivateKey { get; set; }

        /// <summary>
        /// The <c>mailto:</c> or origin a push service can use to reach whoever runs this
        /// instance. Required by the VAPID spec; some services reject a send without it.
        /// </summary>
        public string? Subject { get; set; }

        /// <summary>Push is simply off until someone configures a keypair.</summary>
        public bool IsConfigured =>
            !string.IsNullOrWhiteSpace(PublicKey)
            && !string.IsNullOrWhiteSpace(PrivateKey)
            && !string.IsNullOrWhiteSpace(Subject);
    }

    /// <summary>
    /// One browser on one device that has agreed to receive notifications.
    /// <para>
    /// <b>A row per device, not a column on <see cref="User"/>.</b> One person has a laptop and
    /// a phone and expects both to buzz, and each browser mints its own endpoint and keys.
    /// </para>
    /// </summary>
    public class PushSubscription : ICreateable
    {
        public int Id { get; set; }
        public int UserId { get; set; }

        /// <summary>
        /// The push service's URL for this device. Unique on its own — the browser hands back
        /// the same endpoint when it re-subscribes, and two rows for it would mean two buzzes.
        /// </summary>
        public required string Endpoint { get; set; }

        public required string P256dh { get; set; }
        public required string Auth { get; set; }

        public DateTime CreatedAt { get; set; }

        public User User { get; set; } = null!;
    }

    public record PushSubscriptionRequest(string Endpoint, string P256dh, string Auth);

    /// <param name="PublicKey">
    /// Null when this instance has no keypair configured, which is how the client knows to keep
    /// the whole feature hidden rather than offering a button that cannot work.
    /// </param>
    public record PushConfiguration(string? PublicKey);
}
