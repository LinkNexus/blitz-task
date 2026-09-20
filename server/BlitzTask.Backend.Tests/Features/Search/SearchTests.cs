using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Search;
using BlitzTask.Backend.Features.TaskComments;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using static BlitzTask.Backend.Tests.Features.ProjectTasks.UserTasksTestData;

namespace BlitzTask.Backend.Tests.Features.Search;

/// <summary>
/// Global search. Against SQLite rather than the in-memory provider for the usual reason and one
/// extra: the tag predicate queries a JSON column, which the in-memory provider would evaluate
/// client-side and so could never fail the way the real one would.
/// </summary>
public class SearchTests
{
    private static DefaultHttpContext ContextFor(User user)
    {
        var context = new DefaultHttpContext();
        context.Items["CurrentUser"] = user;
        return context;
    }

    private static async Task<SearchResults> SearchAsync(
        ApplicationDbContext dbContext,
        User user,
        string? q,
        int limit = SearchLimits.DefaultPerGroup
    ) =>
        (
            await SearchEndpoints.Search(
                dbContext,
                ContextFor(user),
                CancellationToken.None,
                q,
                limit
            )
        ).Value!;

    [Fact]
    public async Task FindsTasksByNameDescriptionAndTag()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        var byName = await SeedTaskAsync(dbContext, project, todo, "Deploy the widget");
        var byDescription = await SeedTaskAsync(dbContext, project, todo, "Unrelated");
        byDescription.Description = "mentions a widget in passing";
        var byTag = await SeedTaskAsync(dbContext, project, todo, "Also unrelated");
        byTag.Tags = ["widget"];
        await dbContext.SaveChangesAsync();

        var found = (await SearchAsync(dbContext, alice, "widget")).Tasks.Select(t => t.Id);

        // The tag half is the one worth pinning: Tags is a JSON column, so this is a real
        // translation question rather than an obvious one.
        Assert.Contains(byName.Id, found);
        Assert.Contains(byDescription.Id, found);
        Assert.Contains(byTag.Id, found);
    }

    [Fact]
    public async Task FindsProjectsAndComments()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Widget rollout", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        await TaskCommentsEndpoints.CreateComment(
            project.Id,
            task.Id,
            new CreateTaskCommentRequest("the widget needs a second look"),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        var results = await SearchAsync(dbContext, alice, "widget");

        Assert.Equal(project.Id, Assert.Single(results.Projects).Id);
        var comment = Assert.Single(results.Comments);
        Assert.Equal("Ship it", comment.TaskName);
        Assert.Equal(alice.Name, comment.AuthorName);
    }

    [Fact]
    public async Task OnlySearchesWhatTheCallerCanAlreadySee()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        var (mine, mineTodo, _) = await SeedProjectAsync(dbContext, "Mine widget", alice.Id);
        var (theirs, theirsTodo, _) = await SeedProjectAsync(dbContext, "Their widget", bob.Id);

        await SeedTaskAsync(dbContext, mine, mineTodo, "my widget task");
        var hidden = await SeedTaskAsync(dbContext, theirs, theirsTodo, "their widget task");

        await TaskCommentsEndpoints.CreateComment(
            theirs.Id,
            hidden.Id,
            new CreateTaskCommentRequest("a widget remark"),
            dbContext,
            ContextFor(bob),
            CancellationToken.None
        );

        var results = await SearchAsync(dbContext, alice, "widget");

        // Membership is the authorization, so a project Alice is not in contributes nothing —
        // and search is the one endpoint where a leak would hand over other people's text
        // rather than merely an id.
        Assert.Equal("my widget task", Assert.Single(results.Tasks).Name);
        Assert.Equal("Mine widget", Assert.Single(results.Projects).Name);
        Assert.Empty(results.Comments);
    }

    [Fact]
    public async Task TrashedWorkIsNotFound()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "widget to delete");

        await ProjectTasksEndpoints.DeleteTask(
            project.Id,
            task.Id,
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );
        dbContext.ChangeTracker.Clear();

        // Nothing in the search code mentions DeletedAt — L29's global query filter is what
        // makes this true, and this is the test that says so for a read path written after it.
        Assert.Empty((await SearchAsync(dbContext, alice, "widget")).Tasks);
    }

    [Fact]
    public async Task TheInboxIsNotOfferedAsAProjectButItsCapturesAreStillFound()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (inbox, captured, _) = await SeedProjectAsync(dbContext, "Inbox widget", alice.Id);
        inbox.IsInbox = true;
        await dbContext.SaveChangesAsync();

        await SeedTaskAsync(dbContext, inbox, captured, "widget I jotted down");

        var results = await SearchAsync(dbContext, alice, "widget");

        // A hidden project is a dead end as a result; the thing captured in it is not.
        Assert.Empty(results.Projects);
        var task = Assert.Single(results.Tasks);
        Assert.True(task.IsInbox);
    }

    [Fact]
    public async Task WildcardsInTheQueryAreTextRatherThanPatterns()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        await SeedTaskAsync(dbContext, project, todo, "Reach 50% coverage");
        await SeedTaskAsync(dbContext, project, todo, "Nothing to do with it");

        // Unescaped, "%" matches everything and the feature reads as broken rather than as a
        // wildcard being honoured.
        var results = await SearchAsync(dbContext, alice, "50%");

        Assert.Equal("Reach 50% coverage", Assert.Single(results.Tasks).Name);

        // "_" is LIKE's any-character, so an underscore must not match a letter either.
        await SeedTaskAsync(dbContext, project, todo, "snake_case name");
        await SeedTaskAsync(dbContext, project, todo, "snakeXcase name");

        var underscore = await SearchAsync(dbContext, alice, "snake_case");
        Assert.Equal("snake_case name", Assert.Single(underscore.Tasks).Name);
    }

    [Fact]
    public async Task AQueryTooShortToMeanAnythingFindsNothing()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        await SeedTaskAsync(dbContext, project, todo, "Something");

        // A single letter matches most of a database and answers nothing; blank is what the box
        // holds before anyone types.
        Assert.Equal(0, (await SearchAsync(dbContext, alice, "S")).Total);
        Assert.Equal(0, (await SearchAsync(dbContext, alice, "   ")).Total);
        Assert.Equal(0, (await SearchAsync(dbContext, alice, null)).Total);
    }

    [Fact]
    public async Task MatchingIsCaseInsensitiveAndBoundedPerGroup()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        for (var i = 0; i < 5; i++)
            await SeedTaskAsync(dbContext, project, todo, $"Widget {i}");

        Assert.Equal(5, (await SearchAsync(dbContext, alice, "WIDGET")).Tasks.Count);

        // The cap is per group so a flood of task hits cannot hide the project being looked for.
        Assert.Equal(2, (await SearchAsync(dbContext, alice, "widget", limit: 2)).Tasks.Count);
    }

    [Fact]
    public async Task ACommentExcerptIsTakenAroundTheMatch()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        var padding = new string('x', 300);
        await TaskCommentsEndpoints.CreateComment(
            project.Id,
            task.Id,
            new CreateTaskCommentRequest($"{padding} widget {padding}"),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        var excerpt = Assert.Single((await SearchAsync(dbContext, alice, "widget")).Comments).Excerpt;

        // A match five paragraphs in would otherwise be a result with no visible reason for
        // being one.
        Assert.Contains("widget", excerpt);
        Assert.True(excerpt.Length < 200, $"excerpt was {excerpt.Length} chars");
        Assert.StartsWith("…", excerpt);
        Assert.EndsWith("…", excerpt);
    }
}
