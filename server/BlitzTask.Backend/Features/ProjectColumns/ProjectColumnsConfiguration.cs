using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlitzTask.Backend.Features.ProjectColumns
{
    public class ProjectColumnsConfiguration : IEntityTypeConfiguration<ProjectColumn>
    {
        public void Configure(EntityTypeBuilder<ProjectColumn> builder)
        {
            builder.Property(pc => pc.Name).IsRequired().HasMaxLength(100);
            builder.Property(pc => pc.Score).IsRequired();

            builder
                .HasOne(pc => pc.Project)
                .WithMany(p => p.Columns)
                .HasForeignKey(pc => pc.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.ConfigureAuditable();
        }
    }
}
