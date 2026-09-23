using System.Text;
using System.Text.Json;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.Export
{
    /// <summary>
    /// Getting the data back out (L39).
    /// <para>
    /// <b>Membership is the whole check.</b> An export reads exactly what the caller can already
    /// see on the board, so a Viewer may take one — refusing would only mean they screenshot it
    /// instead. What that does mean is that the projection has to be trustworthy on its own; see
    /// <see cref="ExportEnvelope"/> for what it leaves out and why.
    /// </para>
    /// <para>
    /// Two formats for two different jobs, and they are not interchangeable. JSON is the backup:
    /// it round-trips the structure, and carries a version so the import half can read it. CSV is
    /// for a spreadsheet, and is <b>lossy by construction</b> — it is one row per task, so
    /// comments, checklists and the column ordering flatten or disappear. Offering only CSV
    /// would be offering a backup that cannot restore.
    /// </para>
    /// </summary>
    public static class ExportEndpoints
    {
        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true,
        };

        public static IEndpointRouteBuilder MapExportEndpoints(this IEndpointRouteBuilder app)
        {
            app.MapGet("/api/{projectId:int}/export", ExportProject)
                .WithTags("Export")
                .WithName("export-project")
                .RequireAuthorization("EmailConfirmed")
                .AddEndpointFilter(new RequireProjectPermissionFilter())
                .Produces<ExportEnvelope>()
                .Produces<ApiMessageResponse>(StatusCodes.Status400BadRequest);

            // Outside the project group for the same reason GET /api/tasks is: there is no single
            // projectId to authorise against, so membership is applied inside the query.
            app.MapGet("/api/export", ExportEverything)
                .WithTags("Export")
                .WithName("export-everything")
                .RequireAuthorization("EmailConfirmed")
                .Produces<ExportEnvelope>()
                .Produces<ApiMessageResponse>(StatusCodes.Status400BadRequest);

            return app;
        }

        public static async Task<IResult> ExportProject(
            int projectId,
            string? format,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();
            var projects = await LoadAsync(dbContext, user.Id, projectId, cancellationToken);

            return Respond(projects, user, Slug(projects.FirstOrDefault()?.Name ?? "project"), format);
        }

        public static async Task<IResult> ExportEverything(
            string? format,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();
            var projects = await LoadAsync(dbContext, user.Id, null, cancellationToken);

            return Respond(projects, user, "blitz-task-export", format);
        }

        /// <summary>
        /// One query shape for both endpoints — the only difference is whether a project id
        /// narrows it. Membership is in the <c>Where</c> either way, which is what makes the
        /// everything-export safe without a permission filter it could not use.
        /// </summary>
        private static async Task<List<ProjectExport>> LoadAsync(
            ApplicationDbContext dbContext,
            int userId,
            int? projectId,
            CancellationToken cancellationToken
        )
        {
            var query = dbContext
                .Projects.Where(p => p.Participants.Any(pp => pp.UserId == userId))
                .AsQueryable();

            if (projectId is not null)
                query = query.Where(p => p.Id == projectId);

            // Ordering before projecting, not after: EF cannot sort by a member of a record it
            // is about to construct. The same trap as L13's project summaries.
            return await query
                .OrderBy(p => p.Name)
                .Select(p => new ProjectExport(
                    p.Name,
                    p.Description,
                    p.StartDate,
                    p.DueDate,
                    p.Tags,
                    p.IsInbox,
                    p.CreatedAt,
                    p.Participants.OrderBy(pp => pp.CreatedAt)
                        .Select(pp => new ProjectMemberExport(
                            pp.User.Name,
                            pp.User.Email,
                            pp.Role,
                            pp.CreatedAt
                        ))
                        .ToList(),
                    // Trashed rows are excluded for free: Project, ProjectColumn and ProjectTask
                    // all carry the soft-delete query filter, so an export is what the board
                    // shows rather than what the table holds. Restoring from the trash and
                    // exporting again is how you get one back.
                    p.Columns.OrderBy(c => c.Score)
                        .Select(c => new ColumnExport(
                            c.Name,
                            c.Color,
                            c.Score,
                            c.Tasks.OrderByDescending(t => t.Score)
                                .Select(t => new TaskExport(
                                    t.Name,
                                    t.Description,
                                    t.Priority,
                                    t.Score,
                                    t.Tags,
                                    t.StartDate,
                                    t.DueDate,
                                    t.CreatedAt,
                                    t.UpdatedAt,
                                    t.Assignees.Select(a => a.Email).ToList(),
                                    t.ChecklistItems.OrderBy(i => i.Position)
                                        .Select(i => new ChecklistItemExport(
                                            i.Text,
                                            i.IsDone,
                                            i.Position
                                        ))
                                        .ToList(),
                                    t.Comments.OrderBy(cm => cm.CreatedAt)
                                        .Select(cm => new CommentExport(
                                            cm.Author.Email,
                                            cm.Body,
                                            cm.CreatedAt
                                        ))
                                        .ToList(),
                                    t.Attachments.Select(a => a.OriginalFilename).ToList(),
                                    t.Recurrence == null
                                        ? null
                                        : new RecurrenceExport(
                                            t.Recurrence.Frequency,
                                            t.Recurrence.Interval,
                                            t.Recurrence.Weekdays
                                        )
                                ))
                                .ToList()
                        ))
                        .ToList()
                ))
                .ToListAsync(cancellationToken);
        }

        private static IResult Respond(
            List<ProjectExport> projects,
            User user,
            string filename,
            string? format
        )
        {
            var stamp = DateTime.UtcNow.ToString("yyyy-MM-dd");

            if (string.Equals(format, "csv", StringComparison.OrdinalIgnoreCase))
            {
                return File(
                    CsvWriter.Write(CsvHeaders, projects.SelectMany(CsvRows)),
                    "text/csv",
                    $"{filename}-{stamp}.csv"
                );
            }

            // Unknown formats fall through to JSON rather than 400ing. The parameter exists to
            // pick the *lossy* option, so defaulting to the complete one is the safe way to be
            // wrong — and it keeps a bare `/api/export` meaningful.
            var envelope = new ExportEnvelope(
                ExportEnvelope.CurrentVersion,
                DateTime.UtcNow,
                user.Email,
                projects
            );

            return File(
                JsonSerializer.Serialize(envelope, JsonOptions),
                "application/json",
                $"{filename}-{stamp}.json"
            );
        }

        private static IResult File(string content, string contentType, string filename) =>
            Results.File(Encoding.UTF8.GetBytes(content), contentType, filename);

        private static readonly string[] CsvHeaders =
        [
            "Project",
            "Column",
            "Task",
            "Description",
            "Priority",
            "Tags",
            "Assignees",
            "Start date",
            "Due date",
            "Checklist done",
            "Checklist total",
            "Comments",
            "Created at",
            "Updated at",
        ];

        private static IEnumerable<IEnumerable<string?>> CsvRows(ProjectExport project) =>
            project.Columns.SelectMany(column =>
                column.Tasks.Select(task => new string?[]
                {
                    project.Name,
                    column.Name,
                    task.Name,
                    task.Description,
                    task.Priority.ToString(),
                    string.Join(", ", task.Tags),
                    string.Join(", ", task.Assignees),
                    task.StartDate?.ToString("O"),
                    task.DueDate?.ToString("O"),
                    task.Checklist.Count(i => i.IsDone).ToString(),
                    task.Checklist.Count.ToString(),
                    task.Comments.Count.ToString(),
                    task.CreatedAt.ToString("O"),
                    task.UpdatedAt.ToString("O"),
                })
            );

        /// <summary>A filename fragment that survives every filesystem and the header it sits in.</summary>
        private static string Slug(string name)
        {
            var slug = new string(
                [.. name.ToLowerInvariant().Select(c => char.IsLetterOrDigit(c) ? c : '-')]
            ).Trim('-');

            while (slug.Contains("--"))
                slug = slug.Replace("--", "-");

            return string.IsNullOrEmpty(slug) ? "project" : slug;
        }
    }
}
