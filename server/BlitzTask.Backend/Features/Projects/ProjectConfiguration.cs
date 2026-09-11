using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.ProjectMembers;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlitzTask.Backend.Features.Projects
{
    public class ProjectConfiguration : IEntityTypeConfiguration<Project>
    {
        public void Configure(EntityTypeBuilder<Project> builder)
        {
            builder.Property(p => p.Name).IsRequired().HasMaxLength(100);
            builder.Property(p => p.Description).IsRequired().HasMaxLength(1000);

            builder
                .HasMany(p => p.Participants)
                .WithOne(pp => pp.Project)
                .HasForeignKey(pp => pp.ProjectId);

            builder
                .HasOne(p => p.CreatedBy)
                .WithMany()
                .HasForeignKey(p => p.CreatedById)
                .OnDelete(DeleteBehavior.Restrict);

            builder
                .HasOne(p => p.Image)
                .WithMany()
                .HasForeignKey(p => p.ImageId)
                .OnDelete(DeleteBehavior.SetNull);

            // One Inbox per user, enforced by the database rather than by the get-or-create
            // handler: two capture requests racing on a first-ever click would both see no
            // Inbox and both insert one, and the loser of that race must fail loudly instead of
            // leaving the account with two Inboxes that each hold half its captures.
            // Declared explicitly only because the filtered index below would otherwise take its
            // place: EF's foreign-key convention skips creating an index when one is already
            // configured on those properties, and a *filtered* index cannot serve the ordinary
            // "projects this user created" lookup.
            builder.HasIndex(p => p.CreatedById);

            builder
                .HasIndex(p => p.CreatedById, "IX_Projects_InboxPerUser")
                .IsUnique()
                .HasFilter($"\"{nameof(Project.IsInbox)}\" = 1");

            builder.ConfigureAuditable();
            builder.ConfigureSoftDeletable();
        }
    }

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
