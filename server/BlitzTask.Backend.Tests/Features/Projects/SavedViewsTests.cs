using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using static BlitzTask.Backend.Tests.Features.ProjectTasks.UserTasksTestData;

namespace BlitzTask.Backend.Tests.Features.Projects;

/// <summary>
/// Saved views (L37). The board's filters, named and kept — private to whoever saved them, which
/// is what most of these tests are about: the endpoints sit behind a membership-only filter, so
/// the *only* thing separating two members of one project is the <c>UserId</c> clause in each
/// query. A view someone else saved has to read as absent, not as forbidden.
/// </summary>
public class SavedViewsTests
{
    private static DefaultHttpContext ContextFor(User user)
    {
        var context = new DefaultHttpContext();
        context.Items["CurrentUser"] = user;
        return context;
    }

    private static async Task<SavedView> SeedViewAsync(
        ApplicationDbContext dbContext,
        Project project,
        User user,
        string name,
        string search = "view=board"
    )
    {
        var view = new SavedView
        {
            ProjectId = project.Id,
            UserId = user.Id,
            Name = name,
            Search = search,
        };
        dbContext.SavedViews.Add(view);
        await dbContext.SaveChangesAsync();
        return view;
    }

    [Fact]
    public async Task ListReturnsOnlyTheCallersViewsOrderedByName()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        var (project, _, _) = await SeedProjectAsync(
            dbContext,
            "Alpha",
            alice.Id,
            (bob.Id, ProjectRole.Viewer)
        );

        await SeedViewAsync(dbContext, project, alice, "Urgent");
        await SeedViewAsync(dbContext, project, alice, "Mine");
        await SeedViewAsync(dbContext, project, bob, "Bob's own");

        var result = await SavedViewsEndpoints.ListSavedViews(
            project.Id,
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        string[] expected = ["Mine", "Urgent"];
        Assert.Equal(expected, result.Value!.Select(v => v.Name));
    }

    [Fact]
    public async Task ListDoesNotLeakViewsSavedOnAnotherProject()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (alpha, _, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var (beta, _, _) = await SeedProjectAsync(dbContext, "Beta", alice.Id);

        await SeedViewAsync(dbContext, alpha, alice, "Alpha view");
        await SeedViewAsync(dbContext, beta, alice, "Beta view");

        var result = await SavedViewsEndpoints.ListSavedViews(
            alpha.Id,
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        string[] expected = ["Alpha view"];
        Assert.Equal(expected, result.Value!.Select(v => v.Name));
    }

    [Fact]
    public async Task CreateStoresTheSearchStringUntouchedAndTrimsTheName()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, _, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        // The server never reads inside this string, so it must come back out byte for byte —
        // the route's schema on the other side is the only thing that interprets it.
        const string search = "view=table&priority=URGENT&priority=HIGH&group=assignee&q=api";

        var result = await SavedViewsEndpoints.CreateSavedView(
            project.Id,
            new CreateSavedViewRequest("  My urgent work  ", search),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        var created = Assert.IsType<JsonHttpResult<SavedViewDetails>>(result.Result);
        Assert.Equal(StatusCodes.Status201Created, created.StatusCode);
        Assert.Equal("My urgent work", created.Value!.Name);
        Assert.Equal(search, created.Value.Search);

        var stored = await dbContext.SavedViews.SingleAsync();
        Assert.Equal("My urgent work", stored.Name);
        Assert.Equal(search, stored.Search);
    }

    [Fact]
    public async Task CreateRejectsANameTheCallerAlreadyUsedOnThisProject()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, _, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        await SeedViewAsync(dbContext, project, alice, "Mine");

        var result = await SavedViewsEndpoints.CreateSavedView(
            project.Id,
            new CreateSavedViewRequest("Mine", "view=table"),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        Assert.IsType<Conflict<ApiMessageResponse>>(result.Result);
        Assert.Equal(1, await dbContext.SavedViews.CountAsync());
    }

    [Fact]
    public async Task CreateAllowsTheNameAnotherMemberAlreadyUses()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        var (project, _, _) = await SeedProjectAsync(
            dbContext,
            "Alpha",
            alice.Id,
            (bob.Id, ProjectRole.Viewer)
        );
        await SeedViewAsync(dbContext, project, alice, "Mine");

        // Uniqueness is per person, not per board. "Mine" is exactly the name two people would
        // both pick, and one of them getting a conflict would expose that the other's view exists.
        var result = await SavedViewsEndpoints.CreateSavedView(
            project.Id,
            new CreateSavedViewRequest("Mine", "view=board"),
            dbContext,
            ContextFor(bob),
            CancellationToken.None
        );

        Assert.IsType<JsonHttpResult<SavedViewDetails>>(result.Result);
        Assert.Equal(2, await dbContext.SavedViews.CountAsync());
    }

    [Fact]
    public async Task UpdateRenamesAndOverwritesTheFilters()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, _, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var view = await SeedViewAsync(dbContext, project, alice, "Mine", "view=board");

        var result = await SavedViewsEndpoints.UpdateSavedView(
            project.Id,
            view.Id,
            new UpdateSavedViewRequest("Mine, urgently", "view=table&priority=URGENT"),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        var ok = Assert.IsType<Ok<SavedViewDetails>>(result.Result);
        Assert.Equal("Mine, urgently", ok.Value!.Name);
        Assert.Equal("view=table&priority=URGENT", ok.Value.Search);
    }

    [Fact]
    public async Task UpdateKeepingTheSameNameIsNotAConflictWithItself()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, _, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var view = await SeedViewAsync(dbContext, project, alice, "Mine", "view=board");

        // Overwriting a view's filters resends its existing name, so the duplicate check has to
        // exclude the row being written or a view could never be updated in place at all.
        var result = await SavedViewsEndpoints.UpdateSavedView(
            project.Id,
            view.Id,
            new UpdateSavedViewRequest("Mine", "view=table"),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        var ok = Assert.IsType<Ok<SavedViewDetails>>(result.Result);
        Assert.Equal("view=table", ok.Value!.Search);
    }

    [Fact]
    public async Task UpdateRejectsRenamingOntoAnotherOfTheCallersViews()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, _, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        await SeedViewAsync(dbContext, project, alice, "Urgent");
        var mine = await SeedViewAsync(dbContext, project, alice, "Mine");

        var result = await SavedViewsEndpoints.UpdateSavedView(
            project.Id,
            mine.Id,
            new UpdateSavedViewRequest("Urgent", "view=board"),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        Assert.IsType<Conflict<ApiMessageResponse>>(result.Result);
    }

    [Fact]
    public async Task UpdateCannotReachAnotherMembersView()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        var (project, _, _) = await SeedProjectAsync(
            dbContext,
            "Alpha",
            alice.Id,
            (bob.Id, ProjectRole.Viewer)
        );
        var aliceView = await SeedViewAsync(dbContext, project, alice, "Mine", "view=board");

        var result = await SavedViewsEndpoints.UpdateSavedView(
            project.Id,
            aliceView.Id,
            new UpdateSavedViewRequest("Bob was here", "view=table"),
            dbContext,
            ContextFor(bob),
            CancellationToken.None
        );

        Assert.IsType<NotFound<ApiMessageResponse>>(result.Result);
        var unchanged = await dbContext.SavedViews.SingleAsync();
        Assert.Equal("Mine", unchanged.Name);
        Assert.Equal("view=board", unchanged.Search);
    }

    [Fact]
    public async Task DeleteRemovesTheCallersOwnView()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, _, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var view = await SeedViewAsync(dbContext, project, alice, "Mine");

        var result = await SavedViewsEndpoints.DeleteSavedView(
            project.Id,
            view.Id,
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        Assert.IsType<NoContent>(result.Result);
        Assert.False(await dbContext.SavedViews.AnyAsync());
    }

    [Fact]
    public async Task DeleteCannotReachAnotherMembersView()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        var (project, _, _) = await SeedProjectAsync(
            dbContext,
            "Alpha",
            alice.Id,
            (bob.Id, ProjectRole.Viewer)
        );
        var aliceView = await SeedViewAsync(dbContext, project, alice, "Mine");

        var result = await SavedViewsEndpoints.DeleteSavedView(
            project.Id,
            aliceView.Id,
            dbContext,
            ContextFor(bob),
            CancellationToken.None
        );

        Assert.IsType<NotFound<ApiMessageResponse>>(result.Result);
        Assert.True(await dbContext.SavedViews.AnyAsync());
    }
}
