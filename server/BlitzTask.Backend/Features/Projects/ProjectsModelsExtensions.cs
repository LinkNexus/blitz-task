using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.ProjectColumns;
using BlitzTask.Backend.Features.ProjectSections;
using BlitzTask.Backend.Features.ProjectTasks;

namespace BlitzTask.Backend.Features.Projects
{
    public static class ProjectsModelsExtensions
    {
        public static ProjectDetails WithPermissionsFor(this ProjectDetails details, int userId)
        {
            var role = details.Participants.FirstOrDefault(p => p.UserId == userId)?.Role;
            return details with
            {
                UserPermissions = role.HasValue ? role.Value.GetPermissions() : [],
            };
        }

        /// <summary>
        /// Projects the given user participates in, as list rows. Membership is the filter —
        /// there is no separate permission check because a project you do not participate in
        /// simply is not in the result.
        /// </summary>
        public static IQueryable<ProjectSummary> SelectProjectSummariesFor(
            this IQueryable<Project> projects,
            int userId
        )
        {
            return projects
                .Where(p => p.Participants.Any(pp => pp.UserId == userId))
                .Select(p => new ProjectSummary(
                    p.Id,
                    p.Name,
                    p.Description,
                    p.StartDate,
                    p.DueDate,
                    p.Tags,
                    p.ImageId,
                    p.Participants.First(pp => pp.UserId == userId).Role,
                    p.Participants.Count,
                    p.Tasks.Count,
                    p.CreatedAt,
                    p.UpdatedAt
                ));
        }

        public static IQueryable<ProjectDetails> SelectProjectDetails(
            this IQueryable<Project> projects
        )
        {
            return projects.Select(p => new ProjectDetails(
                p.Id,
                p.Name,
                p.Description,
                p.StartDate,
                p.DueDate,
                p.Tags,
                p.CreatedById,
                p.Participants.Select(pp => new ProjectParticipantInfo(
                        pp.Id,
                        pp.UserId,
                        pp.User.Name,
                        pp.Role,
                        pp.CreatedAt
                    ))
                    .ToList(),
                p.ImageId,
                p.Invitations.Select(i => new ProjectInvitationInfo(
                        i.Id,
                        i.GuestEmail,
                        i.Role,
                        i.CreatedAt
                    ))
                    .ToList(),
                p.Columns.OrderBy(c => c.Score)
                    .Select(c => new ProjectColumnDetails(
                        c.Id,
                        c.Name,
                        c.Score,
                        c.Color,
                        c.CreatedAt,
                        c.UpdatedAt,
                        c.Tasks.OrderByDescending(t => t.Score)
                            .Select(t => new ProjectTaskDetails(
                                t.Id,
                                t.Name,
                                t.Description,
                                t.Priority,
                                t.Score,
                                t.Tags,
                                t.StartDate,
                                t.DueDate,
                                t.CreatedAt,
                                t.UpdatedAt,
                                t.Assignees.Select(a => a.Id).ToList(),
                                t.Attachments.Select(a => new AttachmentMetadata(a.Id, a.OriginalFilename, a.ContentType, a.SizeInBytes, a.CreatedAt)).ToList(),
                                t.RelatedColumnId,
                                t.SectionId,
                                t.ChecklistItems.OrderBy(c => c.Position)
                                    .Select(c => new ChecklistItemDetails(c.Id, c.Text, c.IsDone, c.Position))
                                    .ToList(),
                                // A trashed blocker drops out for free: ProjectTask carries the
                                // soft-delete query filter, so it is simply not there to join to.
                                t.BlockedBy.Select(d => new TaskDependencyLink(
                                        d.DependsOnTask.Id,
                                        d.DependsOnTask.Name,
                                        d.DependsOnTask.RelatedColumnId
                                    ))
                                    .ToList(),
                                t.Blocks.Select(d => new TaskDependencyLink(
                                        d.DependentTask.Id,
                                        d.DependentTask.Name,
                                        d.DependentTask.RelatedColumnId
                                    ))
                                    .ToList(),
                                t.Recurrence == null
                                    ? null
                                    : new RecurrenceDetails(
                                        t.Recurrence.Frequency,
                                        t.Recurrence.Interval,
                                        t.Recurrence.Weekdays
                                    )
                            ))
                            .ToList()
                    ))
                    .ToList(),
                p.Sections.OrderBy(s => s.Score)
                    .Select(s => new ProjectSectionDetails(s.Id, s.Name, s.Color, s.Score))
                    .ToList()
            ));
        }

        public static ProjectDetails ToProjectDetails(this Project project)
        {
            return new ProjectDetails(
                project.Id,
                project.Name,
                project.Description,
                project.StartDate,
                project.DueDate,
                project.Tags,
                project.CreatedById,
                [
                    .. project.Participants.Select(pp => new ProjectParticipantInfo(
                        pp.Id,
                        pp.UserId,
                        pp.User.Name,
                        pp.Role,
                        pp.CreatedAt
                    )),
                ],
                project.ImageId,
                [
                    .. project.Invitations.Select(i => new ProjectInvitationInfo(
                        i.Id,
                        i.GuestEmail,
                        i.Role,
                        i.CreatedAt
                    )),
                ],
                [
                    .. project
                        .Columns.OrderBy(c => c.Score)
                        .Select(c => new ProjectColumnDetails(
                            c.Id,
                            c.Name,
                            c.Score,
                            c.Color,
                            c.CreatedAt,
                            c.UpdatedAt,
                            [
                                .. c
                                    .Tasks.OrderByDescending(t => t.Score)
                                    .Select(t => new ProjectTaskDetails(
                                        t.Id,
                                        t.Name,
                                        t.Description,
                                        t.Priority,
                                        t.Score,
                                        t.Tags,
                                        t.StartDate,
                                        t.DueDate,
                                        t.CreatedAt,
                                        t.UpdatedAt,
                                        [.. t.Assignees.Select(a => a.Id)],
                                        [.. t.Attachments.Select(a => new AttachmentMetadata(a.Id, a.OriginalFilename, a.ContentType, a.SizeInBytes, a.CreatedAt))],
                                        t.RelatedColumnId,
                                        t.SectionId,
                                        [.. t.ChecklistItems.OrderBy(c => c.Position)
                                            .Select(c => new ChecklistItemDetails(c.Id, c.Text, c.IsDone, c.Position))],
                                        [.. t.BlockedBy.Select(d => new TaskDependencyLink(
                                            d.DependsOnTask.Id,
                                            d.DependsOnTask.Name,
                                            d.DependsOnTask.RelatedColumnId
                                        ))],
                                        [.. t.Blocks.Select(d => new TaskDependencyLink(
                                            d.DependentTask.Id,
                                            d.DependentTask.Name,
                                            d.DependentTask.RelatedColumnId
                                        ))],
                                        t.Recurrence == null
                                            ? null
                                            : new RecurrenceDetails(
                                                t.Recurrence.Frequency,
                                                t.Recurrence.Interval,
                                                t.Recurrence.Weekdays
                                            )
                                    )),
                            ]
                        )),
                ],
                [
                    .. project
                        .Sections.OrderBy(s => s.Score)
                        .Select(s => new ProjectSectionDetails(s.Id, s.Name, s.Color, s.Score)),
                ]
            );
        }
    }
}
