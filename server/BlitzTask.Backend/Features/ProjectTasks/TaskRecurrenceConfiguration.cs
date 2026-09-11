using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlitzTask.Backend.Features.ProjectTasks
{
    public class TaskRecurrenceConfiguration : IEntityTypeConfiguration<TaskRecurrence>
    {
        public void Configure(EntityTypeBuilder<TaskRecurrence> builder)
        {
            builder
                .HasOne(r => r.ProjectTask)
                .WithOne(t => t.Recurrence)
                .HasForeignKey<TaskRecurrence>(r => r.ProjectTaskId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
