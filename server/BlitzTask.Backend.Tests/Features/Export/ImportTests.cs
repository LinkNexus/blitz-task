using System.Text.Json;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Export;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.TaskComments;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using static BlitzTask.Backend.Tests.Features.ProjectTasks.UserTasksTestData;

namespace BlitzTask.Backend.Tests.Features.Export;

/// <summary>
/// Reading an export back in (L39). The test that matters is the round trip — export a project,
/// import it, and compare — because that is the property the backup story actually rests on.
/// The rest pin what an import deliberately refuses to carry across.
/// </summary>
public class ImportTests
{
    private static DefaultHttpContext ContextFor(User user)
    {
        var context = new DefaultHttpContext();
        context.Items["CurrentUser"] = user;
        return context;
    }

    private static async Task<ExportEnvelope> ExportAsync(
        ApplicationDbContext dbContext,
        User user,
        int projectId
    )
    {
        var result = await ExportEndpoints.ExportProject(
            projectId,
            null,
            dbContext,
            ContextFor(user),
            CancellationToken.None
        );

        var services = new ServiceCollection();
        services.AddLogging();
        var context = new DefaultHttpContext { RequestServices = services.BuildServiceProvider() };
        using var body = new MemoryStream();
        context.Response.Body = body;
        await result.ExecuteAsync(context);
        body.Position = 0;

        return JsonSerializer.Deserialize<ExportEnvelope>(
            await new StreamReader(body).ReadToEndAsync(),
            new JsonSerializerOptions(JsonSerializerDefaults.Web)
        )!;
    }

    private static Task<Microsoft.AspNetCore.Http.HttpResults.Ok<ImportResult>> ImportAsync(
        ApplicationDbContext dbContext,
        User user,
        ExportEnvelope envelope
    ) =>
        ImportEndpoints.Import(envelope, dbContext, ContextFor(user), CancellationToken.None);

    private static ExportEnvelope Envelope(params ProjectExport[] projects) =>
        new(ExportEnvelope.CurrentVersion, DateTime.UtcNow, "someone@example.com", [.. projects]);

    private static ProjectExport Project(
        string name,
        List<ColumnExport>? columns = null,
        List<ProjectMemberExport>? members = null,
        bool isInbox = false,
        List<SectionExport>? sections = null
    ) =>
        new(
            name,
            "",
            null,
            null,
            [],
            isInbox,
            DateTime.UtcNow,
            members ?? [],
            sections ?? [],
            columns ?? []
        );

    private static TaskExport Task(
        string name,
        List<string>? assignees = null,
        List<CommentExport>? comments = null,
        List<string>? attachments = null,
        string? section = null
    ) =>
        new(
            name,
            "",
            ProjectTaskPriority.MEDIUM,
            1000,
            [],
            section,
            null,
            null,
            DateTime.UtcNow,
            DateTime.UtcNow,
            assignees ?? [],
            [],
            comments ?? [],
            attachments ?? [],
            null
        );

    [Fact]
    public async Task ExportingAProjectAndImportingItBackReproducesIt()
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

        var task = await SeedTaskAsync(
            dbContext,
            project,
            todo,
            "Ship it",
            new DateTimeOffset(2026, 7, 1, 9, 0, 0, TimeSpan.Zero),
            ProjectTaskPriority.URGENT,
            bob
        );
        task.ChecklistItems.Add(new TaskChecklistItem { Text = "Tag the commit", Position = 0 });
        task.ChecklistItems.Add(
            new TaskChecklistItem { Text = "Write the notes", IsDone = true, Position = 1 }
        );
        task.Recurrence = new TaskRecurrence
        {
            Frequency = RecurrenceFrequency.WEEKLY,
            Interval = 2,
            Weekdays = [(int)DayOfWeek.Monday],
        };
        task.Comments.Add(
            new TaskComment { Author = bob, Body = "Nearly there" }
        );
        await dbContext.SaveChangesAsync();

        var envelope = await ExportAsync(dbContext, alice, project.Id);
        var result = await ImportAsync(dbContext, alice, envelope);

        Assert.Equal(1, result.Value!.ProjectsCreated);
        Assert.Equal(1, result.Value.TasksImported);

        var imported = await dbContext
            .Projects.Where(p => p.Name == "Alpha" && p.Id != project.Id)
            .Include(p => p.Participants)
            .Include(p => p.Columns)
            .ThenInclude(c => c.Tasks)
            .ThenInclude(t => t.ChecklistItems)
            .Include(p => p.Columns)
            .ThenInclude(c => c.Tasks)
            .ThenInclude(t => t.Assignees)
            .Include(p => p.Columns)
            .ThenInclude(c => c.Tasks)
            .ThenInclude(t => t.Comments)
            .Include(p => p.Columns)
            .ThenInclude(c => c.Tasks)
            .ThenInclude(t => t.Recurrence)
            .SingleAsync();

        string[] columns = ["Todo", "Done"];
        Assert.Equal(columns, imported.Columns.OrderBy(c => c.Score).Select(c => c.Name));

        var copy = imported.Columns.SelectMany(c => c.Tasks).Single();
        Assert.Equal("Ship it", copy.Name);
        Assert.Equal(ProjectTaskPriority.URGENT, copy.Priority);
        // The dates the app reasons about survive, unlike CreatedAt — see ImportEndpoints.
        Assert.Equal(task.DueDate, copy.DueDate);
        Assert.Equal("bob@example.com", Assert.Single(copy.Assignees).Email);
        Assert.Equal(2, copy.ChecklistItems.Count);
        Assert.True(copy.ChecklistItems.Single(i => i.Text == "Write the notes").IsDone);
        Assert.Equal("Nearly there", Assert.Single(copy.Comments).Body);
        Assert.Equal(2, copy.Recurrence!.Interval);
        Assert.Equal(RecurrenceFrequency.WEEKLY, copy.Recurrence.Frequency);
    }

    [Fact]
    public async Task TheImporterOwnsWhatTheyImportWhateverTheFileClaims()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");

        var envelope = Envelope(
            Project(
                "Handed over",
                members:
                [
                    new ProjectMemberExport("Bob", "bob@example.com", ProjectRole.Owner, DateTime.UtcNow),
                ]
            )
        );

        await ImportAsync(dbContext, alice, envelope);

        var imported = await dbContext
            .Projects.Include(p => p.Participants)
            .SingleAsync(p => p.Name == "Handed over");

        Assert.Equal(alice.Id, imported.CreatedById);
        Assert.Equal(ProjectRole.Owner, imported.Participants.Single(p => p.UserId == alice.Id).Role);
        // A file is not evidence that Bob agreed to own anything — honouring it would let anyone
        // hand a project to anyone by crafting one.
        Assert.Equal(
            ProjectRole.Collaborator,
            imported.Participants.Single(p => p.UserId == bob.Id).Role
        );
    }

    [Fact]
    public async Task PeopleWithNoAccountHereAreCountedRatherThanInvited()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");

        var envelope = Envelope(
            Project(
                "Alpha",
                columns:
                [
                    new ColumnExport(
                        "Todo",
                        "#FF0000",
                        0,
                        [
                            Task(
                                "Work",
                                assignees: ["ghost@example.com"],
                                comments:
                                [
                                    new CommentExport("ghost@example.com", "Hello", DateTime.UtcNow),
                                ]
                            ),
                        ]
                    ),
                ],
                members:
                [
                    new ProjectMemberExport(
                        "Ghost",
                        "ghost@example.com",
                        ProjectRole.Contributor,
                        DateTime.UtcNow
                    ),
                ]
            )
        );

        var result = await ImportAsync(dbContext, alice, envelope);

        // An import is a restore. Quietly emailing someone because a file mentioned them is not.
        Assert.Equal(1, result.Value!.MembersSkipped);
        // Attributing their comment to the importer would forge authorship in the thread.
        Assert.Equal(1, result.Value.CommentsSkipped);

        var imported = await dbContext
            .Projects.Include(p => p.Columns)
            .ThenInclude(c => c.Tasks)
            .ThenInclude(t => t.Assignees)
            .SingleAsync(p => p.Name == "Alpha");

        var task = imported.Columns.SelectMany(c => c.Tasks).Single();
        Assert.Empty(task.Assignees);
        Assert.False(await dbContext.Users.AnyAsync(u => u.Email == "ghost@example.com"));
    }

    [Fact]
    public async Task AttachmentsAreReportedMissingRatherThanLookingRestored()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");

        var envelope = Envelope(
            Project(
                "Alpha",
                columns:
                [
                    new ColumnExport(
                        "Todo",
                        "#FF0000",
                        0,
                        [Task("Work", attachments: ["spec.pdf", "diagram.png"])]
                    ),
                ]
            )
        );

        var result = await ImportAsync(dbContext, alice, envelope);

        // The export carries filenames, never bytes. Saying so beats a restore that looks whole.
        Assert.Equal(2, result.Value!.AttachmentsSkipped);
    }

    [Fact]
    public async Task AnInboxInTheFileLandsInTheCallersOwnInbox()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");

        var envelope = Envelope(
            Project(
                "Inbox",
                columns: [new ColumnExport("Captured", "#6366F1", 0, [Task("Buy milk")])],
                isInbox: true
            )
        );

        var result = await ImportAsync(dbContext, alice, envelope);

        Assert.Equal(0, result.Value!.ProjectsCreated);
        Assert.Equal(1, result.Value.TasksIntoInbox);

        // A second Inbox would both leave a stray board and trip IX_Projects_InboxPerUser.
        var inbox = await dbContext
            .Projects.Include(p => p.Columns)
            .ThenInclude(c => c.Tasks)
            .SingleAsync(p => p.IsInbox);

        Assert.Equal("Buy milk", inbox.Columns.SelectMany(c => c.Tasks).Single().Name);
    }

    [Fact]
    public async Task ImportingTwiceMakesTwoProjectsRatherThanMerging()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var envelope = Envelope(Project("Alpha"));

        await ImportAsync(dbContext, alice, envelope);
        await ImportAsync(dbContext, alice, envelope);

        // Import only ever creates. Merging needs a rule for which side wins on every field, and
        // getting that wrong destroys the data the feature exists to protect.
        Assert.Equal(2, await dbContext.Projects.CountAsync(p => p.Name == "Alpha"));
    }

    [Fact]
    public async Task SectionsComeAcrossByNameAndAnUnknownOneIsDropped()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");

        var envelope = Envelope(
            Project(
                "Alpha",
                columns:
                [
                    new ColumnExport(
                        "Todo",
                        "#FF0000",
                        0,
                        [
                            Task("Style the header", section: "frontend"),
                            Task("Ghost", section: "a section the file never defined"),
                        ]
                    ),
                ],
                sections: [new SectionExport("frontend", "#6366F1", 0)]
            )
        );

        await ImportAsync(dbContext, alice, envelope);

        var imported = await dbContext
            .Projects.Include(p => p.Sections)
            .Include(p => p.Columns)
            .ThenInclude(c => c.Tasks)
            .SingleAsync(p => p.Name == "Alpha");

        var frontend = Assert.Single(imported.Sections);
        Assert.Equal("frontend", frontend.Name);

        var tasks = imported.Columns.SelectMany(c => c.Tasks).ToDictionary(t => t.Name);
        // Matched by name, because an id identifies nothing across instances.
        Assert.Equal(frontend.Id, tasks["Style the header"].SectionId);
        // A section is an extra axis, not a coordinate a task needs — losing it is not worth
        // failing an import over.
        Assert.Null(tasks["Ghost"].SectionId);
    }

    [Theory]
    [InlineData(0, false)]
    [InlineData(2, false)]
    [InlineData(ExportEnvelope.CurrentVersion, true)]
    public void AFileFromAnotherVersionIsRefusedOutright(int version, bool valid)
    {
        // The whole reason the exporter writes a version: an import creates rows, and there is no
        // undo beyond deleting what it made, so half-applying a shape that changed meaning is
        // worse than refusing it.
        var result = new ExportEnvelopeValidator().Validate(
            new ExportEnvelope(version, DateTime.UtcNow, "a@b.c", [Project("Alpha")])
        );

        Assert.Equal(valid, result.IsValid);
    }
}
