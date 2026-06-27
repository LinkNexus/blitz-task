using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlitzTask.Backend.Features.ProjectMembers
{
    public class ProjectInvitationConfiguration : IEntityTypeConfiguration<ProjectInvitation>
    {
        public void Configure(EntityTypeBuilder<ProjectInvitation> builder)
        {
            builder
                .HasOne(pi => pi.Project)
                .WithMany(p => p.Invitations)
                .HasForeignKey(pi => pi.ProjectId);
        }
    }
}
