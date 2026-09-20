using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Extensions;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.Search
{
    public static class SearchEndpoints
    {
        public static IEndpointRouteBuilder MapSearchEndpoints(this IEndpointRouteBuilder app)
        {
            // Cross-project, so membership is the authorization — the same shape as
            // GET /api/tasks and GET /api/calendar. Every query below filters on participation,
            // and a project the caller is not in contributes nothing rather than 403ing.
            app.MapGet("/api/search", Search)
                .WithName("search")
                .WithTags("Search")
                .RequireAuthorization("EmailConfirmed")
                .Produces<SearchResults>();

            return app;
        }

        /// <summary>
        /// Finds tasks, projects and comments by substring.
        /// <para>
        /// <b>`LIKE`, not FTS5 — deliberately, and the spike is worth recording.</b> SQLite's
        /// FTS5 *is* compiled into the bundled build, and EF composes global query filters over
        /// a <c>FromSql</c>, so the trash would stay hidden through a raw MATCH query. It is
        /// genuinely available. What it costs is a virtual table per searchable kind, triggers to
        /// keep each in sync, raw SQL in migrations, and a second way of asking the database
        /// questions — for a personal tool whose largest table is in the thousands, where `LIKE`
        /// over an index-free scan is milliseconds. Revisit when a search is slow enough to
        /// notice, not before: the path is clear and nothing here forecloses it.
        /// </para>
        /// </summary>
        public static async Task<Ok<SearchResults>> Search(
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken,
            string? q = null,
            int limit = SearchLimits.DefaultPerGroup
        )
        {
            var query = (q ?? string.Empty).Trim();

            if (query.Length < SearchLimits.MinQueryLength)
                return TypedResults.Ok(SearchResults.Empty);

            var user = context.GetUser();
            var take = Math.Clamp(limit, 1, SearchLimits.MaxPerGroup);
            var pattern = $"%{Escape(query)}%";

            var tasks = await dbContext
                .ProjectTasks.Where(t =>
                    t.RelatedProject.Participants.Any(pp => pp.UserId == user.Id)
                )
                .Where(t =>
                    EF.Functions.Like(t.Name, pattern, EscapeCharacter)
                    || EF.Functions.Like(t.Description, pattern, EscapeCharacter)
                    || t.Tags.Any(tag => EF.Functions.Like(tag, pattern, EscapeCharacter))
                )
                // Most recently touched first: the thing being looked for is usually the thing
                // being worked on.
                .OrderByDescending(t => t.UpdatedAt)
                .Take(take)
                .Select(t => new TaskSearchResult(
                    t.Id,
                    t.Name,
                    t.RelatedProjectId,
                    t.RelatedProject.Name,
                    t.RelatedColumn.Name,
                    t.RelatedProject.IsInbox
                ))
                .ToListAsync(cancellationToken);

            var projects = await dbContext
                .Projects
                // The Inbox is excluded for the same reason ListProjects excludes it: it is a
                // real project the user is not meant to manage, and a search result linking to
                // its board is a dead end.
                .Where(p => !p.IsInbox && p.Participants.Any(pp => pp.UserId == user.Id))
                .Where(p =>
                    EF.Functions.Like(p.Name, pattern, EscapeCharacter)
                    || EF.Functions.Like(p.Description, pattern, EscapeCharacter)
                    || p.Tags.Any(tag => EF.Functions.Like(tag, pattern, EscapeCharacter))
                )
                .OrderByDescending(p => p.UpdatedAt)
                .Take(take)
                .Select(p => new ProjectSearchResult(p.Id, p.Name, p.Description))
                .ToListAsync(cancellationToken);

            var comments = await dbContext
                .TaskComments.Where(c =>
                    c.ProjectTask.RelatedProject.Participants.Any(pp => pp.UserId == user.Id)
                )
                .Where(c => EF.Functions.Like(c.Body, pattern, EscapeCharacter))
                .OrderByDescending(c => c.CreatedAt)
                .Take(take)
                .Select(c => new
                {
                    c.Id,
                    c.Body,
                    c.ProjectTaskId,
                    TaskName = c.ProjectTask.Name,
                    c.ProjectTask.RelatedProjectId,
                    c.ProjectTask.RelatedProject.IsInbox,
                    AuthorName = c.Author.Name,
                    c.CreatedAt,
                })
                .ToListAsync(cancellationToken);

            return TypedResults.Ok(
                new SearchResults(
                    tasks,
                    projects,
                    comments.ConvertAll(c => new CommentSearchResult(
                        c.Id,
                        c.ProjectTaskId,
                        c.TaskName,
                        c.RelatedProjectId,
                        c.IsInbox,
                        c.AuthorName,
                        Excerpt(c.Body, query),
                        c.CreatedAt
                    ))
                )
            );
        }

        private const string EscapeCharacter = "\\";

        /// <summary>
        /// Makes a user's text safe to put inside a <c>LIKE</c> pattern.
        /// <para>
        /// Without this a query containing <c>%</c> matches everything and one containing <c>_</c>
        /// matches any character — so searching for "50%" returns the whole database, which reads
        /// as the feature being broken rather than as a wildcard being honoured.
        /// </para>
        /// </summary>
        private static string Escape(string value) =>
            value
                .Replace("\\", "\\\\")
                .Replace("%", "\\%")
                .Replace("_", "\\_");

        /// <summary>
        /// The part of a comment worth showing: a window around the match rather than the first
        /// hundred characters, because a match five paragraphs in would otherwise be a result
        /// with no visible reason for being one.
        /// </summary>
        private static string Excerpt(string body, string query, int radius = 60)
        {
            var at = body.IndexOf(query, StringComparison.OrdinalIgnoreCase);
            if (at < 0)
                return Shorten(body, radius * 2);

            var start = Math.Max(0, at - radius);
            var end = Math.Min(body.Length, at + query.Length + radius);
            var slice = body[start..end].Trim();

            return (start > 0 ? "…" : "") + slice + (end < body.Length ? "…" : "");
        }

        private static string Shorten(string value, int length) =>
            value.Length <= length ? value : value[..length].TrimEnd() + "…";
    }
}
