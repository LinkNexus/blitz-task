using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Notifications;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.TaskComments;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using static BlitzTask.Backend.Tests.Features.ProjectTasks.UserTasksTestData;

namespace BlitzTask.Backend.Tests.Features.TaskComments;

/// <summary>
/// The parser, in isolation. A mention is matched against a *set* of names rather than a pattern,
/// so everything interesting here is about which name wins and where a match is allowed to end.
/// </summary>
public class MentionParserTests
{
    private static readonly MentionCandidate Ana = new(1, "Ana");
    private static readonly MentionCandidate AnaMaria = new(2, "Ana Maria");
    private static readonly MentionCandidate Bob = new(3, "Bob");

    [Fact]
    public void FindsAPlainMention()
    {
        Assert.Equal([3], MentionParser.FindMentionedUserIds("can @Bob look at this?", [Ana, Bob]));
    }

    [Fact]
    public void PrefersTheLongerName()
    {
        // "Ana Maria" and "Ana" both start the same way, so the order candidates are tried in is
        // the entire disambiguation. Tried shortest-first, this reads as a mention of Ana.
        Assert.Equal([2], MentionParser.FindMentionedUserIds("ping @Ana Maria", [Ana, AnaMaria]));
    }

    [Fact]
    public void DoesNotMatchAPrefixOfALongerWord()
    {
        // Anabelle is not in the project at all; Ana is. Without a boundary check this is a
        // mention of the wrong person entirely.
        Assert.Empty(MentionParser.FindMentionedUserIds("ask @Anabelle instead", [Ana]));
    }

    [Fact]
    public void IgnoresTheAtInAnEmailAddress()
    {
        // "@example" is a domain, and a participant called Example would otherwise be summoned
        // by every address anyone pastes.
        Assert.Empty(
            MentionParser.FindMentionedUserIds("mail ana@example.com", [new(9, "example.com")])
        );
    }

    [Fact]
    public void IsCaseInsensitiveAndMatchesOnceForRepeats()
    {
        Assert.Equal([3], MentionParser.FindMentionedUserIds("@bob @BOB @Bob", [Bob]));
    }

    [Fact]
    public void MatchesAtTheEndOfTheBodyAndBeforePunctuation()
    {
        Assert.Equal([3], MentionParser.FindMentionedUserIds("over to @Bob", [Bob]));
        Assert.Equal([3], MentionParser.FindMentionedUserIds("@Bob, thoughts?", [Bob]));
    }

    [Fact]
    public void SomeoneNotInTheCandidateSetIsNotMentioned()
    {
        // The security property, stated as a unit test: the set *is* the project's participants,
        // so a stranger's name is just text.
        Assert.Empty(MentionParser.FindMentionedUserIds("hey @Stranger", [Ana, Bob]));
    }
}

/// <summary>
/// Mentions as they behave through the comment endpoints — who gets told, and who gets told once.
/// </summary>
public class MentionNotificationTests
{
    private static DefaultHttpContext ContextFor(User user)
    {
        var context = new DefaultHttpContext();
        context.Items["CurrentUser"] = user;
        return context;
    }

    private static Task CommentAsync(
        ApplicationDbContext dbContext,
        User user,
        int projectId,
        int taskId,
        string body
    ) =>
        TaskCommentsEndpoints.CreateComment(
            projectId,
            taskId,
            new CreateTaskCommentRequest(body),
            dbContext,
            ContextFor(user),
            CancellationToken.None
        );

    private static Task<List<Notification>> NotificationsFor(
        ApplicationDbContext dbContext,
        User user
    ) => dbContext.Notifications.Where(n => n.UserId == user.Id).ToListAsync();

    [Fact]
    public async Task MentioningSomeoneTellsThem_EvenWithNoOtherConnectionToTheTask()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        bob.Name = "Bob";
        await dbContext.SaveChangesAsync();

        var (project, todo, _) = await SeedProjectAsync(
            dbContext,
            "Alpha",
            alice.Id,
            (bob.Id, ProjectRole.Contributor)
        );
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        await CommentAsync(dbContext, alice, project.Id, task.Id, "@Bob can you review?");

        var notification = Assert.Single(await NotificationsFor(dbContext, bob));
        Assert.Equal(NotificationKind.MENTIONED_IN_COMMENT, notification.Kind);
        Assert.Equal("Ship it", notification.TaskName);
    }

    [Fact]
    public async Task BeingAddressedOutranksBeingKeptInformed()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        bob.Name = "Bob";
        await dbContext.SaveChangesAsync();

        var (project, todo, _) = await SeedProjectAsync(
            dbContext,
            "Alpha",
            alice.Id,
            (bob.Id, ProjectRole.Contributor)
        );
        // Bob is assigned, so he would hear about this comment anyway.
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it", assignees: bob);

        await CommentAsync(dbContext, alice, project.Id, task.Id, "@Bob this one is yours");

        // One remark, one notification — and the specific one, not the vague one.
        var notification = Assert.Single(await NotificationsFor(dbContext, bob));
        Assert.Equal(NotificationKind.MENTIONED_IN_COMMENT, notification.Kind);
    }

    [Fact]
    public async Task MentioningYourselfTellsNobody()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        alice.Name = "Alice";
        await dbContext.SaveChangesAsync();

        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        await CommentAsync(dbContext, alice, project.Id, task.Id, "note for @Alice later");

        Assert.Empty(await NotificationsFor(dbContext, alice));
    }

    [Fact]
    public async Task MentioningSomeoneOutsideTheProjectReachesNobody()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var stranger = await TestsUtils.SeedUserAsync(dbContext, "stranger@example.com");
        stranger.Name = "Stranger";
        await dbContext.SaveChangesAsync();

        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        await CommentAsync(dbContext, alice, project.Id, task.Id, "@Stranger take a look");

        // Not merely unhelpful — a notification here would carry the task's name to someone who
        // cannot open the board it is on.
        Assert.Empty(await NotificationsFor(dbContext, stranger));
    }

    [Fact]
    public async Task EditingToFixAMisspelledNameReachesThem_AndOnlyOnce()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        bob.Name = "Bob";
        await dbContext.SaveChangesAsync();

        var (project, todo, _) = await SeedProjectAsync(
            dbContext,
            "Alpha",
            alice.Id,
            (bob.Id, ProjectRole.Contributor)
        );
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        await CommentAsync(dbContext, alice, project.Id, task.Id, "@Bobb can you review?");
        Assert.Empty(await NotificationsFor(dbContext, bob));

        var comment = await dbContext.TaskComments.SingleAsync();

        await TaskCommentsEndpoints.UpdateComment(
            project.Id,
            task.Id,
            comment.Id,
            new UpdateTaskCommentRequest("@Bob can you review?"),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        Assert.Single(await NotificationsFor(dbContext, bob));

        // A second edit that changes something else must not interrupt him again.
        await TaskCommentsEndpoints.UpdateComment(
            project.Id,
            task.Id,
            comment.Id,
            new UpdateTaskCommentRequest("@Bob can you review this today?"),
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        Assert.Single(await NotificationsFor(dbContext, bob));
    }
}
