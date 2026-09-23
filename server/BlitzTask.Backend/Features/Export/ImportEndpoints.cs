using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectColumns;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.Shared.Models;
using BlitzTask.Backend.Features.TaskComments;
using BlitzTask.Backend.Infrastructure.Data;
using BlitzTask.Backend.Infrastructure.Extensions;
using BlitzTask.Backend.Infrastructure.Filters;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Features.Export
{
    /// <summary>
    /// Reading an export back in (L39). Lives beside the exporter because it consumes exactly
    /// what that produces — <see cref="ExportEnvelope"/> is this endpoint's request body, and a
    /// second copy of that shape is the thing most likely to drift.
    /// <para>
    /// <b>An import only ever creates.</b> It never merges into an existing project, never
    /// updates a row and never deletes one, so the worst a mistaken import can do is leave a
    /// duplicate project the caller can delete. Merging would need a rule for which side wins on
    /// every field, and getting that wrong destroys the data the feature exists to protect.
    /// </para>
    /// <para>
    /// <b>The importer is the owner, whatever the file says.</b> Roles come across otherwise, but
    /// an Owner in the file becomes a Collaborator here — a file is not evidence that somebody
    /// agreed to own a project, and honouring it would let anyone hand a project to anyone by
    /// crafting one.
    /// </para>
    /// <para>
    /// <b>Known limitation:</b> <c>CreatedAt</c> is the moment of import, not the original.
    /// <c>ApplicationDbContext.UpdateTimeStamps</c> stamps every inserted row, and weakening that
    /// invariant for one feature is a worse trade than a wrong creation date on a restore. Start
    /// and due dates — the ones the app actually reasons about — come across intact.
    /// </para>
    /// </summary>
    public static class ImportEndpoints
    {
        public static IEndpointRouteBuilder MapImportEndpoints(this IEndpointRouteBuilder app)
        {
            app.MapPost("/api/import", Import)
                .WithTags("Export")
                .WithName("import-export-file")
                .RequireAuthorization("EmailConfirmed")
                .AddEndpointFilter(ValidationFilter<ExportEnvelope>.Body())
                .Produces<ImportResult>()
                .Produces<ValidationErrors>(StatusCodes.Status422UnprocessableEntity);

            return app;
        }

        public static async Task<Ok<ImportResult>> Import(
            ExportEnvelope envelope,
            ApplicationDbContext dbContext,
            HttpContext context,
            CancellationToken cancellationToken
        )
        {
            var user = context.GetUser();
            var people = await ResolvePeopleAsync(envelope, dbContext, cancellationToken);

            var projectsCreated = 0;
            var tasksImported = 0;
            var tasksIntoInbox = 0;
            var membersSkipped = 0;
            var commentsSkipped = 0;
            var attachmentsSkipped = 0;

            foreach (var source in envelope.Projects)
            {
                if (source.IsInbox)
                {
                    var inbox = await InboxEndpoints.GetOrCreateAsync(
                        user,
                        dbContext,
                        cancellationToken
                    );

                    // Captures have no status worth preserving, and the Inbox's two columns are
                    // its own rule rather than the file's — everything lands in the first one.
                    var capture = inbox.Columns.OrderBy(c => c.Score).First();

                    foreach (var task in source.Columns.SelectMany(c => c.Tasks))
                    {
                        capture.Tasks.Add(
                            BuildTask(
                                task,
                                inbox,
                                capture,
                                people,
                                new HashSet<int> { user.Id },
                                ref commentsSkipped,
                                ref attachmentsSkipped
                            )
                        );
                        tasksIntoInbox++;
                    }

                    continue;
                }

                var project = new Project
                {
                    Name = source.Name,
                    Description = source.Description,
                    StartDate = source.StartDate,
                    DueDate = source.DueDate,
                    Tags = [.. source.Tags],
                    CreatedBy = user,
                    Participants =
                    [
                        new ProjectParticipant { User = user, Role = ProjectRole.Owner },
                    ],
                };

                var participantIds = new HashSet<int> { user.Id };

                foreach (var member in source.Members)
                {
                    if (!people.TryGetValue(Key(member.Email), out var person))
                    {
                        membersSkipped++;
                        continue;
                    }

                    if (!participantIds.Add(person.Id))
                        continue;

                    project.Participants.Add(
                        new ProjectParticipant
                        {
                            User = person,
                            Role = member.Role == ProjectRole.Owner
                                ? ProjectRole.Collaborator
                                : member.Role,
                        }
                    );
                }

                foreach (var sourceColumn in source.Columns)
                {
                    var column = new ProjectColumn
                    {
                        Name = sourceColumn.Name,
                        Color = sourceColumn.Color,
                        Score = sourceColumn.Score,
                    };

                    foreach (var task in sourceColumn.Tasks)
                    {
                        column.Tasks.Add(
                            BuildTask(
                                task,
                                project,
                                column,
                                people,
                                participantIds,
                                ref commentsSkipped,
                                ref attachmentsSkipped
                            )
                        );
                        tasksImported++;
                    }

                    project.Columns.Add(column);
                }

                dbContext.Projects.Add(project);
                projectsCreated++;
            }

            // One save for the whole file: a half-imported backup is worse than a refused one.
            // The graph is written through navigations, so EF orders the inserts and fills the
            // foreign keys itself.
            await dbContext.SaveChangesAsync(cancellationToken);

            return TypedResults.Ok(
                new ImportResult(
                    projectsCreated,
                    tasksImported,
                    tasksIntoInbox,
                    membersSkipped,
                    commentsSkipped,
                    attachmentsSkipped
                )
            );
        }

        /// <summary>
        /// Every email the file mentions, resolved against this instance in one query rather than
        /// one per task. An export names people by email precisely so this is possible.
        /// </summary>
        private static async Task<Dictionary<string, User>> ResolvePeopleAsync(
            ExportEnvelope envelope,
            ApplicationDbContext dbContext,
            CancellationToken cancellationToken
        )
        {
            var tasks = envelope.Projects.SelectMany(p => p.Columns).SelectMany(c => c.Tasks);

            var emails = envelope
                .Projects.SelectMany(p => p.Members.Select(m => m.Email))
                .Concat(tasks.SelectMany(t => t.Assignees))
                .Concat(tasks.SelectMany(t => t.Comments.Select(c => c.Author)))
                .Where(email => !string.IsNullOrWhiteSpace(email))
                .Select(Key)
                .Distinct()
                .ToList();

            if (emails.Count == 0)
                return [];

            var found = await dbContext
                .Users.Where(u => emails.Contains(u.Email.ToLower()))
                .ToListAsync(cancellationToken);

            return found.ToDictionary(u => Key(u.Email));
        }

        private static string Key(string email) => email.Trim().ToLowerInvariant();

        /// <summary>
        /// Builds a task into <paramref name="column"/>.
        /// <para>
        /// <b>Both navigations are set, and both are needed.</b> Adding to <c>column.Tasks</c> is
        /// what makes EF discover the task at all; <c>RelatedProject</c> is a second foreign key
        /// that the column relationship says nothing about, so leaving it to fixup writes a zero
        /// and SQLite rejects the insert. The <c>= 0</c> initialisers exist only because the id
        /// properties are <c>required</c> — EF overwrites both when it inserts the graph.
        /// </para>
        /// </summary>
        private static ProjectTask BuildTask(
            TaskExport source,
            Project project,
            ProjectColumn column,
            Dictionary<string, User> people,
            IReadOnlySet<int> participantIds,
            ref int commentsSkipped,
            ref int attachmentsSkipped
        )
        {
            var task = new ProjectTask
            {
                Name = source.Name,
                Description = source.Description,
                Priority = source.Priority,
                Score = source.Score,
                Tags = [.. source.Tags],
                StartDate = source.StartDate,
                DueDate = source.DueDate,
                RelatedProject = project,
                RelatedColumn = column,
                RelatedColumnId = 0,
                RelatedProjectId = 0,
            };

            foreach (var email in source.Assignees)
            {
                // Same rule as a cross-project move: someone who is not on the project would get
                // the task on an "assigned to me" list they cannot open.
                if (people.TryGetValue(Key(email), out var person) && participantIds.Contains(person.Id))
                    task.Assignees.Add(person);
            }

            foreach (var item in source.Checklist.OrderBy(i => i.Position))
            {
                task.ChecklistItems.Add(
                    new TaskChecklistItem
                    {
                        Text = item.Text,
                        IsDone = item.IsDone,
                        Position = item.Position,
                    }
                );
            }

            foreach (var comment in source.Comments)
            {
                if (!people.TryGetValue(Key(comment.Author), out var author))
                {
                    commentsSkipped++;
                    continue;
                }

                task.Comments.Add(new TaskComment { Author = author, Body = comment.Body });
            }

            // The export carries names, never bytes — there is nothing to restore from.
            attachmentsSkipped += source.Attachments.Count;

            if (source.Recurrence is not null)
            {
                task.Recurrence = new TaskRecurrence
                {
                    Frequency = source.Recurrence.Frequency,
                    Interval = source.Recurrence.Interval,
                    Weekdays = [.. source.Recurrence.Weekdays],
                };
            }

            return task;
        }
    }
}
