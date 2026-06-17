using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Infrastructure.Data.Configurations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlitzTask.Backend.Features.Projects.ProjectsConfiguration
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

            builder.ConfigureAuditable();
        }
    }
}
