using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlitzTask.Backend.Features.Projects.ProjectsConfiguration
{
    public class ProjectParticipantConfiguration : IEntityTypeConfiguration<ProjectParticipant>
    {
        public void Configure(EntityTypeBuilder<ProjectParticipant> builder)
        {
            builder
                .HasOne(pp => pp.Project)
                .WithMany(p => p.Participants)
                .HasForeignKey(pp => pp.ProjectId);

            builder
                .HasOne(pp => pp.User)
                .WithMany(u => u.ProjectParticipations)
                .HasForeignKey(pp => pp.UserId);
        }
    }
}
