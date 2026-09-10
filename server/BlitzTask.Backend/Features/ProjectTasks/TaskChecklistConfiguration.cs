using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlitzTask.Backend.Features.ProjectTasks
{
    public class TaskChecklistItemConfiguration : IEntityTypeConfiguration<TaskChecklistItem>
    {
        public void Configure(EntityTypeBuilder<TaskChecklistItem> builder)
        {
            builder.Property(c => c.Text).IsRequired().HasMaxLength(ProjectTask.MaxChecklistItemLength);

            builder
                .HasOne(c => c.ProjectTask)
                .WithMany(t => t.ChecklistItems)
                .HasForeignKey(c => c.ProjectTaskId)
                .OnDelete(DeleteBehavior.Cascade);

            // Every read of a checklist is "this task's items, in order" — the board loads one
            // per task on every project fetch.
            builder.HasIndex(c => new { c.ProjectTaskId, c.Position });
        }
    }
}
