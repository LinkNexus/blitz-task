using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Calendar;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using static BlitzTask.Backend.Tests.Features.ProjectTasks.UserTasksTestData;

namespace BlitzTask.Backend.Tests.Features.Calendar;

/// <summary>
/// The calendar's read model. It differs from <c>GET /api/tasks</c> in two ways that matter:
/// it is bounded by a <b>window</b> rather than a row count, because a month view that silently
/// truncates is wrong rather than short; and it returns things that are <b>not rows</b> —
/// occurrences computed from a recurrence rule, which L25 never materialised.
/// <para>
/// Run against SQLite rather than the in-memory provider: the overlap filter is the kind of
/// predicate that only fails once it has to become SQL.
/// </para>
/// </summary>
public class CalendarTests
{
    private static readonly DateTimeOffset MonthStart = new(2026, 6, 1, 0, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset MonthEnd = new(2026, 7, 1, 0, 0, 0, TimeSpan.Zero);

    private static DefaultHttpContext ContextFor(User user)
    {
        var context = new DefaultHttpContext();
        context.Items["CurrentUser"] = user;
        return context;
    }

    private static async Task<List<CalendarItem>> GetAsync(
        ApplicationDbContext dbContext,
        User user,
        DateTimeOffset? from = null,
        DateTimeOffset? to = null
    )
    {
        var result = await CalendarEndpoints.GetCalendar(
            from ?? MonthStart,
            to ?? MonthEnd,
            dbContext,
            ContextFor(user),
            CancellationToken.None
        );

        return Assert.IsType<Ok<List<CalendarItem>>>(result.Result).Value!;
    }

    [Fact]
    public async Task ReturnsOnlyDatedWorkInsideTheWindow()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        await SeedTaskAsync(dbContext, project, todo, "In the window", MonthStart.AddDays(10));
        await SeedTaskAsync(dbContext, project, todo, "Next month", MonthEnd.AddDays(5));
        // Undated work has no place on a grid at all.
        await SeedTaskAsync(dbContext, project, todo, "Someday");

        var items = await GetAsync(dbContext, alice);

        var item = Assert.Single(items);
        Assert.Equal("In the window", item.Name);
        Assert.False(item.IsProjected);
        Assert.Equal(item.TaskId, item.SourceTaskId);
    }

    [Fact]
    public async Task ASpanCrossingTheWindowIsIncludedEvenThoughNeitherEndIsInside()
    {
        // The case containment gets wrong: a task that started in May and is due in July covers
        // every day of June, and dropping it hides precisely the long-running work a calendar is
        // for. This is why the filter tests overlap.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        var task = await SeedTaskAsync(
            dbContext,
            project,
            todo,
            "Long haul",
            MonthEnd.AddDays(14)
        );
        task.StartDate = MonthStart.AddDays(-20);
        await dbContext.SaveChangesAsync();

        var items = await GetAsync(dbContext, alice);

        Assert.Equal("Long haul", Assert.Single(items).Name);
    }

    [Fact]
    public async Task ProjectsTheRestOfASeriesWithoutCreatingRows()
    {
        // L25 materialises only the next occurrence, so a weekly task is one row. A month view
        // showing one entry would look broken; these are drawn, but they are not tasks.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        var task = await SeedTaskAsync(
            dbContext,
            project,
            todo,
            "Pay rent",
            MonthStart.AddDays(1)
        );
        task.Recurrence = new TaskRecurrence
        {
            Frequency = RecurrenceFrequency.WEEKLY,
            Interval = 1,
        };
        await dbContext.SaveChangesAsync();

        var items = await GetAsync(dbContext, alice);

        // June 2nd, then the 9th, 16th, 23rd and 30th — one real row and four computed.
        Assert.Equal(5, items.Count);
        Assert.Single(items.Where(i => !i.IsProjected));

        var ghosts = items.Where(i => i.IsProjected).ToList();
        Assert.Equal(4, ghosts.Count);
        // No row behind them, but they know where they came from, so the UI can still say what
        // series a faded chip belongs to.
        Assert.All(ghosts, g => Assert.Null(g.TaskId));
        Assert.All(ghosts, g => Assert.Equal(task.Id, g.SourceTaskId));
        Assert.Equal(MonthStart.AddDays(8), ghosts[0].DueDate);

        Assert.Equal(0, dbContext.ProjectTasks.Count() - 1);
    }

    [Fact]
    public async Task ACompletedOccurrenceProjectsNothing()
    {
        // Completing an instance is what writes the next one, so a finished occurrence has
        // already handed its future to a real row. Projecting from it as well draws every date
        // twice.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, _, done) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        var task = await SeedTaskAsync(
            dbContext,
            project,
            done,
            "Pay rent",
            MonthStart.AddDays(1)
        );
        task.Recurrence = new TaskRecurrence
        {
            Frequency = RecurrenceFrequency.WEEKLY,
            Interval = 1,
        };
        await dbContext.SaveChangesAsync();

        var items = await GetAsync(dbContext, alice);

        var item = Assert.Single(items);
        Assert.True(item.IsCompleted);
        Assert.False(item.IsProjected);
    }

    [Fact]
    public async Task ProjectedOccurrencesKeepTheSpanTheyRepeat()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        var task = await SeedTaskAsync(
            dbContext,
            project,
            todo,
            "Two-day review",
            MonthStart.AddDays(1)
        );
        task.StartDate = MonthStart.AddDays(-1);
        task.Recurrence = new TaskRecurrence
        {
            Frequency = RecurrenceFrequency.WEEKLY,
            Interval = 1,
        };
        await dbContext.SaveChangesAsync();

        var ghost = (await GetAsync(dbContext, alice)).First(i => i.IsProjected);

        Assert.Equal(TimeSpan.FromDays(2), ghost.DueDate - ghost.StartDate!.Value);
    }

    [Fact]
    public async Task AnotherMembersProjectIsInvisibleAndAnAbsurdWindowIsRefused()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var stranger = await TestsUtils.SeedUserAsync(dbContext, "stranger@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        await SeedTaskAsync(dbContext, project, todo, "Private", MonthStart.AddDays(3));

        // Membership is the authorization — there is no filter to run on a cross-project query,
        // so a project you are not in simply contributes no rows.
        Assert.Empty(await GetAsync(dbContext, stranger));

        // The window is the only bound on this endpoint's work, so it needs a ceiling of its own.
        var tooWide = await CalendarEndpoints.GetCalendar(
            MonthStart,
            MonthStart.AddYears(5),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );
        Assert.IsType<BadRequest<ApiMessageResponse>>(tooWide.Result);

        var backwards = await CalendarEndpoints.GetCalendar(
            MonthEnd,
            MonthStart,
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );
        Assert.IsType<BadRequest<ApiMessageResponse>>(backwards.Result);
    }

    [Fact]
    public async Task TrashedWorkDoesNotAppearOnTheCalendar()
    {
        // Nothing here asks about DeletedAt: L29's global query filter is what makes that true,
        // and this is the test that says so for a read path written after it.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Deleted", MonthStart.AddDays(4));

        await ProjectTasksEndpoints.DeleteTask(
            project.Id,
            task.Id,
            dbContext,
            CancellationToken.None
        );
        dbContext.ChangeTracker.Clear();

        Assert.Empty(await GetAsync(dbContext, alice));
    }
}
