using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Notifications;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.TaskComments;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Moq;
using static BlitzTask.Backend.Tests.Features.ProjectTasks.UserTasksTestData;

namespace BlitzTask.Backend.Tests.Features.Notifications;

/// <summary>
/// In-app notifications. Almost everything worth pinning here is about what does <b>not</b>
/// produce one: a bell that fires on your own actions, or re-announces an assignment every time
/// the form is saved, is one a user learns to ignore.
/// </summary>
public class NotificationsTests
{
    private static DefaultHttpContext ContextFor(User user)
    {
        var context = new DefaultHttpContext();
        context.Items["CurrentUser"] = user;
        return context;
    }

    private static async Task<NotificationsResponse> FeedAsync(
        ApplicationDbContext dbContext,
        User user,
        bool unreadOnly = false
    ) =>
        (
            await NotificationsEndpoints.ListNotifications(
                dbContext,
                ContextFor(user),
                CancellationToken.None,
                unreadOnly
            )
        ).Value!;

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

    private static Task UpdateAsync(
        ApplicationDbContext dbContext,
        User user,
        int projectId,
        ProjectTask task,
        List<int>? assigneeIds
    ) =>
        ProjectTasksEndpoints.UpdateTask(
            projectId,
            task.Id,
            new UpdateProjectTaskRequest
            {
                Name = task.Name,
                Description = task.Description,
                Priority = task.Priority,
                AssigneeIds = assigneeIds,
            },
            dbContext,
            ContextFor(user),
            Mock.Of<IFileService>(),
            CancellationToken.None
        );

    [Fact]
    public async Task AssigningSomeoneTellsThem()
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

        await UpdateAsync(dbContext, alice, project.Id, task, [bob.Id]);

        var feed = await FeedAsync(dbContext, bob);
        var item = Assert.Single(feed.Items);

        Assert.Equal(1, feed.UnreadCount);
        Assert.Equal(NotificationKind.TASK_ASSIGNED, item.Kind);
        Assert.Equal(alice.Name, item.ActorName);
        Assert.Equal("Ship it", item.TaskName);
        Assert.False(item.IsRead);
    }

    [Fact]
    public async Task AssigningYourselfTellsNobody()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it");

        await UpdateAsync(dbContext, alice, project.Id, task, [alice.Id]);

        // The rule that decides whether the bell is worth looking at at all.
        Assert.Empty((await FeedAsync(dbContext, alice)).Items);
    }

    [Fact]
    public async Task SavingTheFormAgainDoesNotReAnnounceAnExistingAssignment()
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

        await UpdateAsync(dbContext, alice, project.Id, task, [bob.Id]);
        dbContext.ChangeTracker.Clear();

        var reloaded = await dbContext
            .ProjectTasks.Include(t => t.Assignees)
            .SingleAsync(t => t.Id == task.Id);

        // The request carries the whole list every time, so the handler has to diff it. Reading
        // it as "these people are assigned" would notify Bob again on every unrelated edit.
        await UpdateAsync(dbContext, alice, project.Id, reloaded, [bob.Id]);

        Assert.Single((await FeedAsync(dbContext, bob)).Items);
    }

    [Fact]
    public async Task ACommentReachesTheAssigneesAndTheOtherPeopleInTheThread()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        var carol = await TestsUtils.SeedUserAsync(dbContext, "carol@example.com");
        var dave = await TestsUtils.SeedUserAsync(dbContext, "dave@example.com");
        var (project, todo, _) = await SeedProjectAsync(
            dbContext,
            "Alpha",
            alice.Id,
            (bob.Id, ProjectRole.Contributor),
            (carol.Id, ProjectRole.Contributor),
            (dave.Id, ProjectRole.Contributor)
        );
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it", assignees: bob);

        // Carol joins the conversation, then Alice replies.
        await CommentAsync(dbContext, carol, project.Id, task.Id, "Any progress?");
        await CommentAsync(dbContext, alice, project.Id, task.Id, "Nearly there");

        // Bob is on the task; Carol is in the thread.
        Assert.Contains(
            (await FeedAsync(dbContext, bob)).Items,
            n => n.Kind == NotificationKind.TASK_COMMENTED
        );
        Assert.Contains(
            (await FeedAsync(dbContext, carol)).Items,
            n => n.Kind == NotificationKind.TASK_COMMENTED
        );

        // Dave can see the project and has nothing to do with this task. Notifying everyone with
        // access is what turns a bell into a mailing list.
        Assert.Empty((await FeedAsync(dbContext, dave)).Items);
    }

    [Fact]
    public async Task SomeoneWhoIsBothAssignedAndInTheThreadIsToldOnce()
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
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it", assignees: bob);

        await CommentAsync(dbContext, bob, project.Id, task.Id, "On it");
        await CommentAsync(dbContext, alice, project.Id, task.Id, "Thanks");

        // One person, two reasons to hear about it, one notification.
        Assert.Single((await FeedAsync(dbContext, bob)).Items);
    }

    [Fact]
    public async Task CommentingOnYourOwnTaskTellsNobody()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it", assignees: alice);

        await CommentAsync(dbContext, alice, project.Id, task.Id, "Note to self");

        Assert.Empty((await FeedAsync(dbContext, alice)).Items);
    }

    [Fact]
    public async Task MarkingAllReadClearsTheBadgeAndReturnsTheSameMomentsFeed()
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
        var first = await SeedTaskAsync(dbContext, project, todo, "First", assignees: bob);
        var second = await SeedTaskAsync(dbContext, project, todo, "Second", assignees: bob);

        await CommentAsync(dbContext, alice, project.Id, first.Id, "One");
        await CommentAsync(dbContext, alice, project.Id, second.Id, "Two");

        Assert.Equal(2, (await FeedAsync(dbContext, bob)).UnreadCount);

        var after = (
            await NotificationsEndpoints.MarkAllRead(
                dbContext,
                ContextFor(bob),
                CancellationToken.None
            )
        ).Value!;

        // The count and the list come back together so they cannot disagree for a frame.
        Assert.Equal(0, after.UnreadCount);
        Assert.Equal(2, after.Items.Count);
        Assert.All(after.Items, n => Assert.True(n.IsRead));
        Assert.Empty((await FeedAsync(dbContext, bob, unreadOnly: true)).Items);
    }

    [Fact]
    public async Task OneNotificationIsNotAnothersToRead()
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
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it", assignees: bob);
        await CommentAsync(dbContext, alice, project.Id, task.Id, "Hello");

        var bobs = Assert.Single((await FeedAsync(dbContext, bob)).Items);

        var result = await NotificationsEndpoints.MarkRead(
            bobs.Id,
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );

        // Someone else's row reads as missing rather than forbidden — otherwise the endpoint
        // answers "how many notifications exist" to anyone who counts 404s.
        Assert.IsType<NotFound<BlitzTask.Backend.Features.Shared.Models.ApiMessageResponse>>(
            result.Result
        );
        Assert.Equal(1, (await FeedAsync(dbContext, bob)).UnreadCount);
    }

    [Fact]
    public async Task ANotificationOutlivesTheTaskItPointsAt()
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
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it", assignees: bob);
        await CommentAsync(dbContext, alice, project.Id, task.Id, "Hello");

        dbContext.ProjectTasks.Remove(
            await dbContext.ProjectTasks.IgnoreQueryFilters().SingleAsync(t => t.Id == task.Id)
        );
        await dbContext.SaveChangesAsync();
        dbContext.ChangeTracker.Clear();

        var item = Assert.Single((await FeedAsync(dbContext, bob)).Items);

        // "You were told about something that has since been deleted" is still true, and the
        // name was copied at write time so it is still readable.
        Assert.Null(item.TaskId);
        Assert.Equal("Ship it", item.TaskName);
    }
}

/// <summary>
/// The anchor a notification points at. Without it "X mentioned you on Y" lands on the task and
/// leaves the reader scrolling for the sentence that named them.
/// </summary>
public class NotificationCommentAnchorTests
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

    [Fact]
    public async Task ACommentNotificationPointsAtTheComment()
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
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it", assignees: bob);

        await CommentAsync(dbContext, alice, project.Id, task.Id, "Have a look");

        var comment = await dbContext.TaskComments.SingleAsync();
        var notification = await dbContext.Notifications.SingleAsync(n => n.UserId == bob.Id);

        // The id is set in the same save that inserts the comment, through the navigation —
        // there is no id to copy until then.
        Assert.Equal(comment.Id, notification.CommentId);
    }

    [Fact]
    public async Task AnAssignmentHasNoCommentToPointAt()
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

        await ProjectTasksEndpoints.UpdateTask(
            project.Id,
            task.Id,
            new UpdateProjectTaskRequest
            {
                Name = task.Name,
                Description = task.Description,
                Priority = task.Priority,
                AssigneeIds = [bob.Id],
            },
            dbContext,
            ContextFor(alice),
            Mock.Of<IFileService>(),
            CancellationToken.None
        );

        var notification = await dbContext.Notifications.SingleAsync(n => n.UserId == bob.Id);

        Assert.Equal(NotificationKind.TASK_ASSIGNED, notification.Kind);
        Assert.Null(notification.CommentId);
    }

    [Fact]
    public async Task DeletingTheCommentLeavesTheNotificationStandingWithNothingToScrollTo()
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
        var task = await SeedTaskAsync(dbContext, project, todo, "Ship it", assignees: bob);

        await CommentAsync(dbContext, alice, project.Id, task.Id, "Have a look");
        var comment = await dbContext.TaskComments.SingleAsync();

        await TaskCommentsEndpoints.DeleteComment(
            project.Id,
            task.Id,
            comment.Id,
            dbContext,
            ContextFor(alice),
            CancellationToken.None
        );
        dbContext.ChangeTracker.Clear();

        var notification = await dbContext.Notifications.SingleAsync(n => n.UserId == bob.Id);

        // Retracting a remark does not un-tell anyone it was made; it only takes away the thing
        // the notification could scroll to. SetNull rather than cascade.
        Assert.Null(notification.CommentId);
        Assert.Equal("Ship it", notification.TaskName);
    }
}
