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
                p.CreatedBy.Id,
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
                p.Columns.ToList()
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
                project.CreatedBy.Id,
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
                [.. project.Columns]
            );
        }
    }
}
