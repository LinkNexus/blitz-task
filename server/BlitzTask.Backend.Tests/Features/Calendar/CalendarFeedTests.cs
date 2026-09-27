using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Calendar;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Shared.Services;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using static BlitzTask.Backend.Tests.Features.ProjectTasks.UserTasksTestData;

namespace BlitzTask.Backend.Tests.Features.Calendar;

/// <summary>
/// The ICS feed. Its subject is not really iCalendar — that is
/// <see cref="IcsWriterTests"/> — but the two things a <i>published</i> feed gets wrong:
/// <b>who it lets read</b>, since the URL is the whole credential and nothing polling it can
/// carry a cookie, and <b>which day a deadline lands on</b>, which is a timezone question this
/// app has no stored answer to.
/// </summary>
public class CalendarFeedTests
{
    private static AppUrlBuilder UrlBuilder() =>
        new(
            Options.Create(new AppSettings { BaseUrl = "https://blitz.example.com" }),
            new HttpContextAccessor()
        );

    private static DefaultHttpContext ContextFor(User user)
    {
        var context = new DefaultHttpContext();
        context.Items["CurrentUser"] = user;
        return context;
    }

    private static async Task<string> SubscribeAsync(ApplicationDbContext dbContext, User user)
    {
        var result = await CalendarEndpoints.CreateFeedSubscription(
            dbContext,
            ContextFor(user),
            UrlBuilder(),
            CancellationToken.None
        );

        return Assert.IsType<Ok<CalendarFeedSubscription>>(result).Value!.Url!;
    }

    /// <summary>The token is the last path segment, minus the extension.</summary>
    private static string TokenIn(string url) =>
        url.Split('/').Last().Replace(".ics", "");

    private static async Task<string> FetchAsync(
        ApplicationDbContext dbContext,
        string token,
        string? tz = null
    )
    {
        var result = await CalendarEndpoints.GetIcsFeed(
            token,
            dbContext,
            UrlBuilder(),
            CancellationToken.None,
            tz
        );

        var content = Assert.IsType<ContentHttpResult>(result.Result);

        // The content type is what makes a browser hand the file to a calendar application
        // instead of rendering it as text, so it is part of the answer rather than plumbing.
        Assert.Equal("text/calendar; charset=utf-8", content.ContentType);

        return content.ResponseContent!;
    }

    [Fact]
    public async Task ThereIsNoFeedUntilSomeoneAsksForOne()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");

        var result = await CalendarEndpoints.GetFeedSubscription(
            dbContext,
            ContextFor(alice),
            UrlBuilder(),
            CancellationToken.None
        );

        Assert.Null(Assert.IsType<Ok<CalendarFeedSubscription>>(result).Value!.Url);
    }

    [Fact]
    public async Task TheUrlIsAbsoluteAndBuiltFromTheConfiguredOrigin()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");

        var url = await SubscribeAsync(dbContext, alice);

        // Absolute because it is pasted into another application entirely — a relative path is
        // useless to Google's fetcher.
        Assert.StartsWith("https://blitz.example.com/api/calendar/feed/", url);
        Assert.EndsWith(".ics", url);
    }

    [Fact]
    public async Task TheTokenSurvivesBeingPastedIntoAUrl()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");

        var token = TokenIn(await SubscribeAsync(dbContext, alice));

        // Base64Url, not Base64: `+` and `/` in a path segment are a re-encoding problem waiting
        // to happen, and this value is copied by hand.
        Assert.DoesNotContain('+', token);
        Assert.DoesNotContain('/', token);
        Assert.DoesNotContain('=', token);
        Assert.True(token.Length >= 32, $"token was only {token.Length} characters");
    }

    [Fact]
    public async Task SubscribingTwiceRotatesTheSecretRatherThanKeepingBoth()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");

        var first = await SubscribeAsync(dbContext, alice);
        var second = await SubscribeAsync(dbContext, alice);

        Assert.NotEqual(first, second);
        Assert.Equal(
            1,
            await dbContext.UserTokens.CountAsync(t => t.Type == UserTokenType.CalendarFeed)
        );

        // Rotation *is* revocation — the whole reason it is one endpoint. Anything still polling
        // the old URL has to stop getting data.
        Assert.Equal(
            StatusCodes.Status404NotFound,
            Assert.IsType<NotFound>(
                (
                    await CalendarEndpoints.GetIcsFeed(
                        TokenIn(first),
                        dbContext,
                        UrlBuilder(),
                        CancellationToken.None
                    )
                ).Result
            ).StatusCode
        );
    }

    [Fact]
    public async Task ARevokedFeedAndOneThatNeverExistedAnswerIdentically()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var token = TokenIn(await SubscribeAsync(dbContext, alice));

        await CalendarEndpoints.DeleteFeedSubscription(
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        // Telling the two apart would confirm to someone guessing that a token had once been
        // real, which is the only thing a guesser learns anything from.
        Assert.IsType<NotFound>(
            (
                await CalendarEndpoints.GetIcsFeed(
                    token,
                    dbContext,
                    UrlBuilder(),
                    CancellationToken.None
                )
            ).Result
        );
        Assert.IsType<NotFound>(
            (
                await CalendarEndpoints.GetIcsFeed(
                    "not-a-token",
                    dbContext,
                    UrlBuilder(),
                    CancellationToken.None
                )
            ).Result
        );
    }

    [Fact]
    public async Task TheFeedCarriesTheOwnersWorkAndNobodyElses()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");

        var (alphas, aliceColumn, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var (betas, bobColumn, _) = await SeedProjectAsync(dbContext, "Beta", bob.Id);

        var soon = DateTimeOffset.UtcNow.AddDays(3);
        await SeedTaskAsync(dbContext, alphas, aliceColumn, "Alice's deadline", soon);
        await SeedTaskAsync(dbContext, betas, bobColumn, "Bob's deadline", soon);

        var ics = await FetchAsync(dbContext, TokenIn(await SubscribeAsync(dbContext, alice)));

        Assert.Contains("SUMMARY:Alice's deadline", ics);
        // The token authenticates a *person*, not a bypass: a feed that leaked every project on
        // the instance would be the worst possible version of this feature.
        Assert.DoesNotContain("Bob's deadline", ics);
    }

    [Fact]
    public async Task UndatedWorkIsNotPublishedAtAll()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, column, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        await SeedTaskAsync(dbContext, project, column, "Someday");

        var ics = await FetchAsync(dbContext, TokenIn(await SubscribeAsync(dbContext, alice)));

        Assert.DoesNotContain("Someday", ics);
        Assert.DoesNotContain("BEGIN:VEVENT", ics);
    }

    [Fact]
    public async Task TheDayIsComputedInTheSubscribersTimezone()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, column, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        // Local midnight in Tokyo on the 20th, which is 15:00 UTC on the *19th*. A due date in
        // this app is exactly this: an instant written by a date picker, with no time anyone
        // chose and no timezone stored beside it.
        var tokyoMidnight = new DateTimeOffset(
            DateTime.UtcNow.Date.AddDays(20).AddHours(-9),
            TimeSpan.Zero
        );
        await SeedTaskAsync(dbContext, project, column, "Tokyo deadline", tokyoMidnight);

        var token = TokenIn(await SubscribeAsync(dbContext, alice));
        var expected = DateTime.UtcNow.Date.AddDays(20);

        var tokyo = await FetchAsync(dbContext, token, "Asia/Tokyo");
        Assert.Contains($"DTSTART;VALUE=DATE:{expected:yyyyMMdd}", tokyo);

        // Without the zone the same instant publishes a day early — which is precisely the bug
        // this parameter exists to prevent for everyone east of UTC.
        var utc = await FetchAsync(dbContext, token);
        Assert.Contains($"DTSTART;VALUE=DATE:{expected.AddDays(-1):yyyyMMdd}", utc);
    }

    [Fact]
    public async Task AnUnknownTimezoneFallsBackRatherThanFailing()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, column, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        await SeedTaskAsync(dbContext, project, column, "A deadline", DateTimeOffset.UtcNow.AddDays(2));

        // A subscription that 500s stops updating inside an application nobody is looking at.
        // Being a few hours out is recoverable; going silent is not.
        var ics = await FetchAsync(dbContext, TokenIn(await SubscribeAsync(dbContext, alice)), "Mars/Olympus");

        Assert.Contains("SUMMARY:A deadline", ics);
    }

    [Fact]
    public async Task ProjectedOccurrencesGetDistinctIdentitiesPerDate()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, column, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        var task = await SeedTaskAsync(
            dbContext,
            project,
            column,
            "Water the plants",
            DateTimeOffset.UtcNow.AddDays(1)
        );

        task.Recurrence = new TaskRecurrence
        {
            Frequency = RecurrenceFrequency.WEEKLY,
            Interval = 1,
        };
        await dbContext.SaveChangesAsync();

        var ics = await FetchAsync(dbContext, TokenIn(await SubscribeAsync(dbContext, alice)));

        var uids = ics.Split("\r\n")
            .Where(line => line.StartsWith("UID:"))
            .ToList();

        // A weekly chore is materialised one row at a time, so the rest of the year is computed.
        // Give them all one UID and every client collapses the series into a single event that
        // appears to jump around the calendar.
        Assert.True(uids.Count > 4, $"expected a series, got {uids.Count} events");
        Assert.Equal(uids.Count, uids.Distinct().Count());
    }
}
