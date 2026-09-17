using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Features.TaskComments;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using static BlitzTask.Backend.Tests.Features.ProjectTasks.UserTasksTestData;

namespace BlitzTask.Backend.Tests.Features.TaskComments;

/// <summary>
/// Task comments — the first thing in the app that is attributed speech rather than a property
/// of the work. What is worth pinning is the asymmetry between editing and deleting: a comment
/// is only ever the author's to rewrite, while someone who runs the project may take one down.
/// <para>
/// Against SQLite rather than the in-memory provider, like every other handler test here.
/// </para>
/// </summary>
public class TaskCommentsTests
{
    private static DefaultHttpContext ContextFor(User user)
    {
        var context = new DefaultHttpContext();
        context.Items["CurrentUser"] = user;
        return context;
    }

    private static async Task<TaskCommentDetails> PostAsync(
        ApplicationDbContext dbContext,
        User user,
        int projectId,
        int taskId,
        string body
    )
    {
        var result = await TaskCommentsEndpoints.CreateComment(
            projectId,
            taskId,
            new CreateTaskCommentRequest(body),
            dbContext,
            ContextFor(user),
            CancellationToken.None
        );

        return Assert.IsType<Created<TaskCommentDetails>>(result.Result).Value!;
    }

    private static async Task<List<TaskCommentDetails>> ListAsync(
        ApplicationDbContext dbContext,
        User user,
        int projectId,
        int taskId
    )
    {
        var result = await TaskCommentsEndpoints.ListComments(
            projectId,
            taskId,
            dbContext,
            ContextFor(user),
            CancellationToken.None
        );

        return Assert.IsType<Ok<List<TaskCommentDetails>>>(result.Result).Value!;
    }

    [Fact]
    public async Task ReadsBackOldestFirst_WhichIsTheOppositeOfEveryOtherListHere()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        await PostAsync(dbContext, alice, project.Id, task.Id, "First");
        await PostAsync(dbContext, alice, project.Id, task.Id, "Second");
        await PostAsync(dbContext, alice, project.Id, task.Id, "Third");

        var comments = await ListAsync(dbContext, alice, project.Id, task.Id);

        // A conversation is read in the order it was had. Ties break on Id because three
        // comments posted inside one test share a timestamp to the millisecond.
        Assert.Equal(["First", "Second", "Third"], comments.Select(c => c.Body));
        Assert.All(comments, c => Assert.Equal(alice.Name, c.AuthorName));
    }

    [Fact]
    public async Task ABodyIsTrimmed_AndAFreshCommentIsNotMarkedEdited()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        var comment = await PostAsync(dbContext, alice, project.Id, task.Id, "  padded  ");

        Assert.Equal("padded", comment.Body);
        // IAuditable stamps CreatedAt and UpdatedAt to the same instant on insert, so "edited"
        // has to be a strict comparison or every comment would claim to have been edited.
        Assert.False(comment.IsEdited);
    }

    [Fact]
    public async Task OnlyTheAuthorMayRewriteTheirOwnWords()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        var (project, todo, _) = await SeedProjectAsync(
            dbContext,
            "Alpha",
            alice.Id,
            (bob.Id, ProjectRole.Collaborator)
        );
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");
        var comment = await PostAsync(dbContext, bob, project.Id, task.Id, "Bob's remark");

        // Alice owns the project, which is as much authority as this app has — and it still does
        // not extend to putting different words in Bob's mouth.
        var byOwner = await TaskCommentsEndpoints.UpdateComment(
            project.Id,
            task.Id,
            comment.Id,
            new UpdateTaskCommentRequest("Alice's version"),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        Assert.Equal(
            StatusCodes.Status403Forbidden,
            Assert.IsType<JsonHttpResult<ApiMessageResponse>>(byOwner).StatusCode
        );

        var unchanged = await dbContext.TaskComments.SingleAsync(c => c.Id == comment.Id);
        Assert.Equal("Bob's remark", unchanged.Body);
    }

    [Fact]
    public async Task AnEditByTheAuthorMarksTheCommentEdited()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");
        var comment = await PostAsync(dbContext, alice, project.Id, task.Id, "First thought");

        // The audit override stamps UpdatedAt on save; without a real gap the strict comparison
        // that keeps fresh comments unmarked would also keep edited ones unmarked.
        await Task.Delay(5);

        var result = await TaskCommentsEndpoints.UpdateComment(
            project.Id,
            task.Id,
            comment.Id,
            new UpdateTaskCommentRequest("Second thought"),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        var updated = Assert.IsType<Ok<TaskCommentDetails>>(result).Value!;
        Assert.Equal("Second thought", updated.Body);
        Assert.True(updated.IsEdited);
    }

    [Fact]
    public async Task SomeoneWhoRunsTheProjectMayTakeDownARemarkTheyCannotRewrite()
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
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");
        var comment = await PostAsync(dbContext, bob, project.Id, task.Id, "Bob's remark");

        var result = await TaskCommentsEndpoints.DeleteComment(
            project.Id,
            task.Id,
            comment.Id,
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        Assert.IsType<NoContent>(result);
        Assert.Empty(await dbContext.TaskComments.ToListAsync());
    }

    [Fact]
    public async Task AContributorCannotTakeDownSomeoneElsesRemark()
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
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");
        var comment = await PostAsync(dbContext, alice, project.Id, task.Id, "Alice's remark");

        // Moderation rides on ManageParticipants — the people who decide who is in a project are
        // the ones who answer for what is said in it. A Contributor is not one of them.
        var result = await TaskCommentsEndpoints.DeleteComment(
            project.Id,
            task.Id,
            comment.Id,
            dbContext,
            ContextFor(bob),
            CancellationToken.None
        );

        Assert.Equal(
            StatusCodes.Status403Forbidden,
            Assert.IsType<JsonHttpResult<ApiMessageResponse>>(result).StatusCode
        );
        Assert.Single(await dbContext.TaskComments.ToListAsync());
    }

    [Fact]
    public async Task CanEditAndCanDeleteDescribeTheCallerRatherThanTheComment()
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
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");
        await PostAsync(dbContext, bob, project.Id, task.Id, "Bob's remark");

        var asOwner = Assert.Single(await ListAsync(dbContext, alice, project.Id, task.Id));
        var asAuthor = Assert.Single(await ListAsync(dbContext, bob, project.Id, task.Id));

        // The same row, read by two people, answers differently — which is the whole point of
        // sending the flags rather than letting the client work them out.
        Assert.False(asOwner.CanEdit);
        Assert.True(asOwner.CanDelete);
        Assert.True(asAuthor.CanEdit);
        Assert.True(asAuthor.CanDelete);
    }

    [Fact]
    public async Task ATaskReachedUnderTheWrongProjectDoesNotResolve()
    {
        // The permission filter authorised the route's {projectId}; if the task were trusted
        // from the route too, a member of any project could read any task's discussion.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (mine, _, _) = await SeedProjectAsync(dbContext, "Mine", alice.Id);
        var (other, otherTodo, _) = await SeedProjectAsync(dbContext, "Other", alice.Id);
        var task = await SeedTaskAsync(dbContext, other, otherTodo, "Elsewhere");

        var listed = await TaskCommentsEndpoints.ListComments(
            mine.Id,
            task.Id,
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        Assert.IsType<NotFound<ApiMessageResponse>>(listed.Result);

        var created = await TaskCommentsEndpoints.CreateComment(
            mine.Id,
            task.Id,
            new CreateTaskCommentRequest("Sneaking in"),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        Assert.IsType<NotFound<ApiMessageResponse>>(created.Result);
        Assert.Empty(await dbContext.TaskComments.ToListAsync());
    }

    [Fact]
    public async Task CommentsOnATrashedTaskAreOutOfReachWithoutSayingSo()
    {
        // L29's global query filter, inherited for free: the task stops resolving, so the thread
        // hanging off it stops being addressable. Nothing here mentions DeletedAt.
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");
        var comment = await PostAsync(dbContext, alice, project.Id, task.Id, "Still here");

        await BlitzTask.Backend.Features.ProjectTasks.ProjectTasksEndpoints.DeleteTask(
            project.Id,
            task.Id,
            dbContext,
            CancellationToken.None
        );
        dbContext.ChangeTracker.Clear();

        var listed = await TaskCommentsEndpoints.ListComments(
            project.Id,
            task.Id,
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        Assert.IsType<NotFound<ApiMessageResponse>>(listed.Result);

        // The row itself survives, because restoring the task has to give back its discussion.
        Assert.Single(await dbContext.TaskComments.ToListAsync());
        Assert.Equal("Still here", (await dbContext.TaskComments.SingleAsync()).Body);
        Assert.Equal(comment.Id, (await dbContext.TaskComments.SingleAsync()).Id);
    }
}

/// <summary>
/// The body rule, which create and update share. Worth its own tests because the whitespace case
/// is the one a NotEmpty() alone lets through.
/// </summary>
public class TaskCommentValidatorTests
{
    private static readonly CreateTaskCommentRequestValidator Validator = new();

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\n\t ")]
    public void RejectsACommentThatSaysNothing(string body)
    {
        var result = Validator.Validate(new CreateTaskCommentRequest(body));

        Assert.False(result.IsValid);
        // Reported against the property, not the request, so the SPA can show it under the box.
        Assert.All(result.Errors, e => Assert.Equal(nameof(CreateTaskCommentRequest.Body), e.PropertyName));
    }

    [Fact]
    public void RejectsACommentLongerThanTheColumn()
    {
        var result = Validator.Validate(
            new CreateTaskCommentRequest(new string('a', TaskComment.MaxBodyLength + 1))
        );

        Assert.False(result.IsValid);
    }

    [Fact]
    public void AcceptsAnOrdinaryRemark()
    {
        Assert.True(Validator.Validate(new CreateTaskCommentRequest("Looks good to me")).IsValid);
    }
}
