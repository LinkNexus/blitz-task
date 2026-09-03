using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using static BlitzTask.Backend.Tests.Features.ProjectTasks.UserTasksTestData;

namespace BlitzTask.Backend.Tests.Features.ProjectTasks;

/// <summary>
/// Covers the query-parameter handling of GET /api/tasks. The projection itself is
/// <see cref="UserTaskSummariesTests"/>; what is under test here is how the filters compose and
/// where each one runs — the due-date ones cannot live in SQL, so a regression that pushed them
/// back into the query would throw rather than quietly return the wrong rows.
/// </summary>
public class ListUserTasksTests
{
    private static DefaultHttpContext ContextFor(User user)
    {
        var context = new DefaultHttpContext();
        context.Items["CurrentUser"] = user;
        return context;
    }

    private static async Task<List<UserTaskSummary>> ListAsync(
        ApplicationDbContext dbContext,
        User user,
        bool assignedToMe = false,
        bool includeCompleted = false,
        DateTimeOffset? dueBefore = null,
        int? projectId = null,
        int limit = 50
    )
    {
        var result = await ProjectTasksEndpoints.ListUserTasks(
            dbContext,
            ContextFor(user),
            CancellationToken.None,
            assignedToMe,
            includeCompleted,
            dueBefore,
            projectId,
            limit
        );

        return result.Value!;
    }

    [Fact]
    public async Task HidesCompletedTasksByDefault_AndIncludesThemOnRequest()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, done) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        await SeedTaskAsync(dbContext, project, todo, "Open");
        await SeedTaskAsync(dbContext, project, done, "Shipped");

        var byDefault = await ListAsync(dbContext, alice);
        var withCompleted = await ListAsync(dbContext, alice, includeCompleted: true);

        Assert.Equal(["Open"], byDefault.Select(t => t.Name));
        Assert.Equal(["Open", "Shipped"], withCompleted.Select(t => t.Name).OrderBy(n => n));
    }

    [Fact]
    public async Task AssignedToMe_RestrictsToTheCallersOwnTasks()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        var (project, todo, _) = await SeedProjectAsync(
            dbContext,
            "Alpha",
            alice.Id,
            (bob.Id, ProjectRole.Contributor)
        );

        await SeedTaskAsync(dbContext, project, todo, "Mine", null, ProjectTaskPriority.MEDIUM, alice);
        await SeedTaskAsync(dbContext, project, todo, "Bob's", null, ProjectTaskPriority.MEDIUM, bob);
        await SeedTaskAsync(dbContext, project, todo, "Unassigned");

        var mine = await ListAsync(dbContext, alice, assignedToMe: true);

        Assert.Equal(["Mine"], mine.Select(t => t.Name));
    }

    [Fact]
    public async Task AssignedToMe_False_IncludesUnassignedWork()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        await SeedTaskAsync(dbContext, project, todo, "Unassigned");

        // The dashboard defaults to this: in a solo project almost nothing is ever assigned, so
        // filtering by assignee out of the box would show an empty page to the main use case.
        Assert.Equal(["Unassigned"], (await ListAsync(dbContext, alice)).Select(t => t.Name));
    }

    [Fact]
    public async Task DueBefore_KeepsDatedTasksUpToTheCutoffAndDropsUndatedOnes()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        var now = DateTimeOffset.UtcNow;
        await SeedTaskAsync(dbContext, project, todo, "Soon", now.AddDays(1));
        await SeedTaskAsync(dbContext, project, todo, "Far", now.AddDays(30));
        await SeedTaskAsync(dbContext, project, todo, "Undated");

        var soon = await ListAsync(dbContext, alice, dueBefore: now.AddDays(7));

        // An undated task has no due date to fall before the cutoff, so it is not "due soon".
        Assert.Equal(["Soon"], soon.Select(t => t.Name));
    }

    [Fact]
    public async Task DueBefore_ComparesInstants_NotStoredText()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        // 23:00 on the 1st in +02:00 is 21:00 UTC — earlier than the 22:00 UTC cutoff, even
        // though its stored text sorts after it. This is why the filter runs in memory.
        await SeedTaskAsync(
            dbContext,
            project,
            todo,
            "Offset",
            new DateTimeOffset(2026, 7, 1, 23, 0, 0, TimeSpan.FromHours(2))
        );

        var cutoff = new DateTimeOffset(2026, 7, 1, 22, 0, 0, TimeSpan.Zero);

        Assert.Equal(["Offset"], (await ListAsync(dbContext, alice, dueBefore: cutoff)).Select(t => t.Name));
    }

    [Fact]
    public async Task ProjectId_RestrictsToOneProject()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (alpha, alphaTodo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var (beta, betaTodo, _) = await SeedProjectAsync(dbContext, "Beta", alice.Id);
        await SeedTaskAsync(dbContext, alpha, alphaTodo, "Alpha task");
        await SeedTaskAsync(dbContext, beta, betaTodo, "Beta task");

        var onlyAlpha = await ListAsync(dbContext, alice, projectId: alpha.Id);

        Assert.Equal(["Alpha task"], onlyAlpha.Select(t => t.Name));
    }

    [Fact]
    public async Task ExcludesTasksFromProjectsTheCallerIsNotIn()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        var (bobProject, bobTodo, _) = await SeedProjectAsync(dbContext, "Bob", bob.Id);
        await SeedTaskAsync(dbContext, bobProject, bobTodo, "Bob task");

        // Even asked for by id: membership is the authorization, and there is no permission
        // filter on this route to fall back on.
        Assert.Empty(await ListAsync(dbContext, alice, projectId: bobProject.Id));
        Assert.Empty(await ListAsync(dbContext, alice));
    }

    [Fact]
    public async Task Limit_TruncatesAfterOrdering_KeepingTheMostUrgent()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        var now = DateTimeOffset.UtcNow;
        // Inserted least-urgent first, so a limit applied before the sort would keep "Undated".
        await SeedTaskAsync(dbContext, project, todo, "Undated");
        await SeedTaskAsync(dbContext, project, todo, "Later", now.AddDays(9));
        await SeedTaskAsync(dbContext, project, todo, "Soon", now.AddDays(1));

        Assert.Equal(["Soon"], (await ListAsync(dbContext, alice, limit: 1)).Select(t => t.Name));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    public async Task Limit_BelowOne_IsClampedRatherThanReturningNothing(int limit)
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        await SeedTaskAsync(dbContext, project, todo, "Open");

        Assert.Single(await ListAsync(dbContext, alice, limit: limit));
    }

    [Fact]
    public async Task Limit_AboveTheCeiling_IsClampedToIt()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        for (var i = 0; i < 205; i++)
            await SeedTaskAsync(dbContext, project, todo, $"Task {i}");

        Assert.Equal(200, (await ListAsync(dbContext, alice, limit: 10_000)).Count);
    }

    [Fact]
    public async Task ReturnsEmpty_ForAUserInNoProjects()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var loner = await TestsUtils.SeedUserAsync(dbContext, "loner@example.com");

        Assert.Empty(await ListAsync(dbContext, loner));
    }
}
