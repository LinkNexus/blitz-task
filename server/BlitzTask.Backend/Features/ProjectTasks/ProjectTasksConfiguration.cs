using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlitzTask.Backend.Features.ProjectTasks
{
    public class ProjectTaskConfiguration : IEntityTypeConfiguration<ProjectTask>
    {
        public void Configure(EntityTypeBuilder<ProjectTask> builder)
        {
            builder.Property(pt => pt.Name).IsRequired().HasMaxLength(100);
            builder.Property(pt => pt.Description).IsRequired().HasMaxLength(1000);
            builder.Property(pt => pt.Score).IsRequired();

            builder.HasMany(pt => pt.Assignees).WithMany();

            builder
                .HasOne(pt => pt.RelatedColumn)
                .WithMany(pc => pc.Tasks)
                .HasForeignKey(pt => pt.RelatedColumnId)
                .OnDelete(DeleteBehavior.Cascade);

            builder
                .HasOne(pt => pt.RelatedProject)
                .WithMany(p => p.Tasks)
                .HasForeignKey(pt => pt.RelatedProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            builder
                .HasMany(pt => pt.Attachments)
                .WithMany()
                .UsingEntity<ProjectTaskAttachment>(
                    r => r.HasOne<Attachment>().WithMany().HasForeignKey(pa => pa.AttachmentId),
                    l => l.HasOne<ProjectTask>().WithMany().HasForeignKey(pa => pa.ProjectTaskId)
                );
            ;

            builder.ConfigureAuditable();
        }
    }
}
