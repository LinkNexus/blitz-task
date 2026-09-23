using System.Text.Json;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Export;
using BlitzTask.Backend.Features.ProjectMembers;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using static BlitzTask.Backend.Tests.Features.ProjectTasks.UserTasksTestData;

namespace BlitzTask.Backend.Tests.Features.Export;

/// <summary>
/// Getting the data out (L39). What these pin is mostly what an export must <i>not</i> contain —
/// it is a file that leaves the instance, so the projection is a security boundary as much as a
/// shape.
/// </summary>
public class ExportTests
{
    private static DefaultHttpContext ContextFor(User user)
    {
        var context = new DefaultHttpContext();
        context.Items["CurrentUser"] = user;
        return context;
    }

    /// <summary>
    /// The endpoints return a file, so the assertions read the bytes it would send.
    /// <para>
    /// The context needs <c>RequestServices</c> with logging in it: ASP.NET's file result
    /// resolves a logger while executing, and a bare <see cref="DefaultHttpContext"/> throws
    /// before writing a byte.
    /// </para>
    /// </summary>
    private static async Task<string> BodyOf(IResult result)
    {
        var services = new ServiceCollection();
        services.AddLogging();

        var context = new DefaultHttpContext { RequestServices = services.BuildServiceProvider() };
        using var body = new MemoryStream();
        context.Response.Body = body;

        await result.ExecuteAsync(context);

        body.Position = 0;
        return await new StreamReader(body).ReadToEndAsync();
    }

    private static Task<string> ExportProjectAsync(
        ApplicationDbContext dbContext,
        User user,
        int projectId,
        string? format = null
    ) =>
        ExportEndpoints
            .ExportProject(projectId, format, dbContext, ContextFor(user), CancellationToken.None)
            .ContinueWith(t => BodyOf(t.Result))
            .Unwrap();

    private static Task<string> ExportEverythingAsync(
        ApplicationDbContext dbContext,
        User user,
        string? format = null
    ) =>
        ExportEndpoints
            .ExportEverything(format, dbContext, ContextFor(user), CancellationToken.None)
            .ContinueWith(t => BodyOf(t.Result))
            .Unwrap();

    [Fact]
    public async Task JsonCarriesTheStructureAndNamesPeopleByEmail()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        await SeedTaskAsync(dbContext, project, todo, "Write it up", null, ProjectTaskPriority.HIGH, alice);

        var json = await ExportProjectAsync(dbContext, alice, project.Id);
        var envelope = JsonSerializer.Deserialize<ExportEnvelope>(
            json,
            new JsonSerializerOptions(JsonSerializerDefaults.Web)
        )!;

        Assert.Equal(ExportEnvelope.CurrentVersion, envelope.FormatVersion);
        var exported = Assert.Single(envelope.Projects);
        Assert.Equal("Alpha", exported.Name);

        var task = exported.Columns.SelectMany(c => c.Tasks).Single(t => t.Name == "Write it up");
        // An id would identify nobody on the far side of an import.
        Assert.Equal("alice@example.com", Assert.Single(task.Assignees));
    }

    [Fact]
    public async Task ExportNeverCarriesAPendingInvitationToken()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, _, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        var invitation = new ProjectInvitation
        {
            GuestEmail = "guest@example.com",
            Role = ProjectRole.Contributor,
            ProjectId = project.Id,
        };
        dbContext.ProjectInvitations.Add(invitation);
        await dbContext.SaveChangesAsync();

        var json = await ExportProjectAsync(dbContext, alice, project.Id);

        // The token admits whoever holds it to the project. ProjectDetails ships it to members,
        // which is why the export has its own projection rather than reusing it — a download
        // gets stored, synced and forwarded.
        Assert.DoesNotContain(invitation.Token.ToString(), json);
        Assert.DoesNotContain("guest@example.com", json);
    }

    [Fact]
    public async Task ExportLeavesTrashedTasksOut()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        await SeedTaskAsync(dbContext, project, todo, "Kept");
        var trashed = await SeedTaskAsync(dbContext, project, todo, "Thrown away");

        trashed.DeletedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();

        var json = await ExportProjectAsync(dbContext, alice, project.Id);

        Assert.Contains("Kept", json);
        // An export is what the board shows, not what the table holds. Restore it first.
        Assert.DoesNotContain("Thrown away", json);
    }

    [Fact]
    public async Task ExportingEverythingSkipsProjectsTheCallerIsNotIn()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        var (mine, mineTodo, _) = await SeedProjectAsync(dbContext, "Mine", alice.Id);
        var (theirs, theirsTodo, _) = await SeedProjectAsync(dbContext, "Theirs", bob.Id);
        await SeedTaskAsync(dbContext, mine, mineTodo, "My task");
        await SeedTaskAsync(dbContext, theirs, theirsTodo, "Their task");

        var json = await ExportEverythingAsync(dbContext, alice);

        Assert.Contains("My task", json);
        // No permission filter can run here — there is no single projectId — so membership lives
        // in the query, exactly as it does for GET /api/tasks.
        Assert.DoesNotContain("Their task", json);
    }

    [Fact]
    public async Task ExportingAProjectTheCallerIsNotInYieldsNothing()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var bob = await TestsUtils.SeedUserAsync(dbContext, "bob@example.com");
        var (theirs, theirsTodo, _) = await SeedProjectAsync(dbContext, "Theirs", bob.Id);
        await SeedTaskAsync(dbContext, theirs, theirsTodo, "Their task");

        // The endpoint filter would already have 404'd, but the query is belt-and-braces: the
        // handler must not be the thing that leaks if it is ever mounted somewhere else.
        var json = await ExportProjectAsync(dbContext, alice, theirs.Id);

        Assert.DoesNotContain("Their task", json);
    }

    [Fact]
    public async Task CsvIsOneRowPerTaskWithTheProjectAndColumnOnIt()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, done) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        await SeedTaskAsync(dbContext, project, todo, "First");
        await SeedTaskAsync(dbContext, project, done, "Second");

        var csv = await ExportProjectAsync(dbContext, alice, project.Id, "csv");
        var lines = csv.Split("\r\n", StringSplitOptions.RemoveEmptyEntries);

        Assert.Equal(3, lines.Length);
        Assert.StartsWith($"{CsvWriter.Bom}Project,Column,Task", lines[0]);
        Assert.Contains("Alpha,Todo,First", csv);
        Assert.Contains("Alpha,Done,Second", csv);
    }

    [Fact]
    public async Task CsvNeutralisesATaskNameThatWouldRunAsAFormula()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, todo, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);
        await SeedTaskAsync(dbContext, project, todo, "=HYPERLINK(\"http://evil\")");

        var csv = await ExportProjectAsync(dbContext, alice, project.Id, "csv");

        // End to end, not just in CsvWriter: a task title is text another member typed.
        Assert.Contains("'=HYPERLINK", csv);
        Assert.DoesNotContain(",=HYPERLINK", csv);
    }

    [Fact]
    public async Task AnUnknownFormatFallsBackToJsonRatherThanFailing()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (project, _, _) = await SeedProjectAsync(dbContext, "Alpha", alice.Id);

        // The parameter exists to opt *into* the lossy format, so defaulting to the complete one
        // is the safe way to be wrong.
        var body = await ExportProjectAsync(dbContext, alice, project.Id, "xlsx");

        Assert.Contains("\"formatVersion\"", body);
    }

    [Fact]
    public async Task TheInboxIsExportedAndFlagged()
    {
        using var dbContext = TestsUtils.CreateSqliteDbContext();
        var alice = await TestsUtils.SeedUserAsync(dbContext, "alice@example.com");
        var (inbox, captured, _) = await SeedProjectAsync(dbContext, "Inbox", alice.Id);
        inbox.IsInbox = true;
        await dbContext.SaveChangesAsync();
        await SeedTaskAsync(dbContext, inbox, captured, "Buy milk");

        var json = await ExportEverythingAsync(dbContext, alice);
        var envelope = JsonSerializer.Deserialize<ExportEnvelope>(
            json,
            new JsonSerializerOptions(JsonSerializerDefaults.Web)
        )!;

        // It holds real captures so it belongs in a backup, but an importer needs to know it is
        // not a board its owner ever made.
        var exported = Assert.Single(envelope.Projects);
        Assert.True(exported.IsInbox);
        Assert.Contains("Buy milk", json);
    }
}
