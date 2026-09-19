using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlitzTask.Backend.Features.Activity
{
    public class ActivityEventConfiguration : IEntityTypeConfiguration<ActivityEvent>
    {
        public void Configure(EntityTypeBuilder<ActivityEvent> builder)
        {
            builder.Property(e => e.ActorName).IsRequired().HasMaxLength(255);
            builder.Property(e => e.Subject).HasMaxLength(255);
            builder.Property(e => e.FromLabel).HasMaxLength(255);
            builder.Property(e => e.ToLabel).HasMaxLength(255);

            // The project owns its history: purge the project and the trail goes with it.
            builder
                .HasOne(e => e.Project)
                .WithMany()
                .HasForeignKey(e => e.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            // The task does not. "Who deleted this" is a question asked *after* the thing is
            // gone, so the entry outlives it — every label it needs was denormalised on write.
            builder
                .HasOne(e => e.Task)
                .WithMany()
                .HasForeignKey(e => e.TaskId)
                .OnDelete(DeleteBehavior.SetNull);

            builder
                .HasOne(e => e.Actor)
                .WithMany()
                .HasForeignKey(e => e.ActorId)
                .OnDelete(DeleteBehavior.Cascade);

            // The only read there is: this project's history, newest first.
            builder.HasIndex(e => new { e.ProjectId, e.CreatedAt });
        }
    }
}
