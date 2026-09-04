using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Scheduling;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.Auth
{
    /// <summary>
    /// Deletes email-confirmation and password-reset tokens that have expired unused.
    /// <para>
    /// Tokens are removed when they are *redeemed*, so every one that is never clicked stays in
    /// the table forever — an unbounded set of dead credentials, each one still matching on
    /// value, kept alive only by the expiry check every lookup happens to perform.
    /// </para>
    /// </summary>
    public class ExpiredTokenCleanupJob(ApplicationDbContext dbContext) : IScheduledJob
    {
        public string Name => "expired-token-cleanup";

        // Nothing depends on this being timely — it is hygiene, not behaviour.
        public TimeSpan Interval => TimeSpan.FromHours(6);

        public async Task RunAsync(CancellationToken cancellationToken)
        {
            var now = DateTime.UtcNow;

            // A null ExpiresAt means the token does not expire — SecurityStamp tokens are stored
            // that way — so the null check is load-bearing, not defensive: without it this
            // deletes every non-expiring token on its first run.
            await dbContext
                .UserTokens.Where(token => token.ExpiresAt != null && token.ExpiresAt < now)
                .ExecuteDeleteAsync(cancellationToken);
        }
    }
}
