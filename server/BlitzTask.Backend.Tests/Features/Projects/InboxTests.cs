using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectColumns;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace BlitzTask.Backend.Tests.Features.Projects;

/// <summary>
/// The Inbox is a real project carrying a flag, so most of what needs pinning is the handful of
/// places it must *not* behave like one: it is created on demand, only ever once, it stays out
/// of the project list, and it cannot be deleted out from under the captures it holds.
/// </summary>
public class InboxTests
{
    private static DefaultHttpContext ContextFor(User user)
    {
        var context = new DefaultHttpContext();
        context.Items["CurrentUser"] = user;
        return context;
    }

    private static async Task<InboxSummary> GetInboxAsync(
        ApplicationDbContext dbContext,
        User user
    )
    {
        var result = await InboxEndpoints.GetInbox(
            dbContext,
            ContextFor(user),
            CancellationToken.None
        );

        return result.Value!;
    }

    [Fact]
    public async Task CreatesTheInboxOnFirstUse_AndReturnsTheSameOneAfterwards()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");

        var first = await GetInboxAsync(dbContext, alice);
        var second = await GetInboxAsync(dbContext, alice);

        Assert.Equal(first.ProjectId, second.ProjectId);
        Assert.Equal(1, await dbContext.Projects.CountAsync(p => p.IsInbox));
    }

    [Fact]
    public async Task GivesTheInboxAnOwnerAndACaptureColumnBeforeAnyDoneColumn()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");

        var inbox = await GetInboxAsync(dbContext, alice);

        var participant = await dbContext.ProjectParticipants.SingleAsync(pp =>
            pp.ProjectId == inbox.ProjectId
        );
        Assert.Equal(alice.Id, participant.UserId);
        Assert.Equal(ProjectRole.Owner, participant.Role);

        // Two columns, and captures land in the lower-scored one: "done" is a position in this
        // app, so a single-column Inbox would hold tasks that can never be completed.
        var columns = await dbContext
            .ProjectColumns.Where(c => c.ProjectId == inbox.ProjectId)
            .OrderBy(c => c.Score)
            .ToListAsync();

        Assert.Equal(2, columns.Count);
        Assert.Equal(columns[0].Id, inbox.CaptureColumnId);
    }

    [Fact]
    public async Task EachUserGetsTheirOwnInbox()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");

        var aliceInbox = await GetInboxAsync(dbContext, alice);
        var bobInbox = await GetInboxAsync(dbContext, bob);

        Assert.NotEqual(aliceInbox.ProjectId, bobInbox.ProjectId);
    }

    [Fact]
    public async Task TheDatabaseRefusesASecondInboxForTheSameUser()
    {
        // The get-or-create handler is check-then-insert, so two first-ever captures racing each
        // other would both find nothing. The unique filtered index is what stops that ending as
        // two Inboxes holding half the captures each.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        await GetInboxAsync(dbContext, alice);

        dbContext.Projects.Add(
            new Project
            {
                Name = "Inbox",
                Description = "",
                IsInbox = true,
                CreatedById = alice.Id,
                Columns = [new ProjectColumn { Name = "Captured", Score = 0, Color = "#000000" }],
            }
        );

        await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());
    }

    [Fact]
    public async Task TheInboxIsNotInTheProjectList()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        await GetInboxAsync(dbContext, alice);

        var listed = await ProjectsEndpoints.ListProjects(
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        Assert.Empty(listed.Value!);
    }

    [Fact]
    public async Task TheInboxCannotBeDeleted()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var inbox = await GetInboxAsync(dbContext, alice);

        var result = await ProjectsEndpoints.DeleteProject(
            inbox.ProjectId,
            dbContext,
            Mock.Of<IFileService>(),
            CancellationToken.None
        );

        Assert.IsType<BadRequest<ApiMessageResponse>>(result.Result);
        Assert.True(await dbContext.Projects.AnyAsync(p => p.Id == inbox.ProjectId));
    }
}
