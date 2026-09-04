using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Tests.Features.Auth;

/// <summary>
/// Real SQLite rather than the in-memory provider: the job runs a single `ExecuteDeleteAsync`,
/// which is a server-side DELETE the in-memory provider does not translate the same way.
/// </summary>
public class ExpiredTokenCleanupJobTests
{
    private static async Task<UserToken> SeedTokenAsync(
        ApplicationDbContext dbContext,
        User user,
        UserTokenType type,
        DateTime? expiresAt
    )
    {
        var token = new UserToken
        {
            Value = Guid.NewGuid().ToString(),
            UserId = user.Id,
            Type = type,
            ExpiresAt = expiresAt,
        };
        dbContext.UserTokens.Add(token);
        await dbContext.SaveChangesAsync();
        return token;
    }

    [Fact]
    public async Task DeletesExpiredTokens()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var user = await TestsUtils.SeedUserAsync(dbContext);
        await SeedTokenAsync(
            dbContext,
            user,
            UserTokenType.EmailConfirmation,
            DateTime.UtcNow.AddHours(-1)
        );

        await new ExpiredTokenCleanupJob(dbContext).RunAsync(CancellationToken.None);

        Assert.Empty(await dbContext.UserTokens.ToListAsync());
    }

    [Fact]
    public async Task KeepsTokensThatHaveNotExpiredYet()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var user = await TestsUtils.SeedUserAsync(dbContext);
        await SeedTokenAsync(
            dbContext,
            user,
            UserTokenType.PasswordReset,
            DateTime.UtcNow.AddHours(1)
        );

        await new ExpiredTokenCleanupJob(dbContext).RunAsync(CancellationToken.None);

        Assert.Single(await dbContext.UserTokens.ToListAsync());
    }

    [Fact]
    public async Task KeepsTokensWithNoExpiry()
    {
        // The load-bearing case. A null ExpiresAt means "never expires" — SecurityStamp tokens
        // are stored that way — and in SQL `NULL < now` is NULL, not true, so the rows survive
        // by accident of three-valued logic rather than by intent. Drop the null check from the
        // predicate and this test is what notices that every security stamp just vanished.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var user = await TestsUtils.SeedUserAsync(dbContext);
        await SeedTokenAsync(dbContext, user, UserTokenType.SecurityStamp, null);

        await new ExpiredTokenCleanupJob(dbContext).RunAsync(CancellationToken.None);

        Assert.Single(await dbContext.UserTokens.ToListAsync());
    }

    [Fact]
    public async Task DeletesOnlyTheExpiredOnes()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var user = await TestsUtils.SeedUserAsync(dbContext);
        var expired = await SeedTokenAsync(
            dbContext,
            user,
            UserTokenType.EmailConfirmation,
            DateTime.UtcNow.AddDays(-2)
        );
        var live = await SeedTokenAsync(
            dbContext,
            user,
            UserTokenType.PasswordReset,
            DateTime.UtcNow.AddHours(3)
        );
        var permanent = await SeedTokenAsync(dbContext, user, UserTokenType.SecurityStamp, null);

        await new ExpiredTokenCleanupJob(dbContext).RunAsync(CancellationToken.None);

        var remaining = await dbContext.UserTokens.Select(t => t.Id).ToListAsync();
        Assert.Equal([live.Id, permanent.Id], remaining.OrderBy(id => id));
        Assert.DoesNotContain(expired.Id, remaining);
    }

    [Fact]
    public async Task IsIdempotent()
    {
        // Restart-safety in miniature: the container is replaced on every deploy, so a job has
        // to tolerate running again over work it already did.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var user = await TestsUtils.SeedUserAsync(dbContext);
        await SeedTokenAsync(
            dbContext,
            user,
            UserTokenType.EmailConfirmation,
            DateTime.UtcNow.AddHours(-1)
        );

        var job = new ExpiredTokenCleanupJob(dbContext);
        await job.RunAsync(CancellationToken.None);
        await job.RunAsync(CancellationToken.None);

        Assert.Empty(await dbContext.UserTokens.ToListAsync());
    }
}
