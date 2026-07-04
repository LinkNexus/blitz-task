using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.ProjectColumns;
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
                p.Invitations.ToList(),
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
                                t.RelatedColumnId
                            ))
                            .ToList()
                    ))
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
                [.. project.Invitations],
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
                                        t.RelatedColumnId
                                    )),
                            ]
                        )),
                ]
            );
        }
    }
}
