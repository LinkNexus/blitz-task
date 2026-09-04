using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlitzTask.Backend.Features.ProjectTasks
{
    public class TaskReminderConfiguration : IEntityTypeConfiguration<TaskReminder>
    {
        public void Configure(EntityTypeBuilder<TaskReminder> builder)
        {
            builder
                .HasOne(r => r.ProjectTask)
                .WithMany(t => t.Reminders)
                .HasForeignKey(r => r.ProjectTaskId)
                .OnDelete(DeleteBehavior.Cascade);

            builder
                .HasOne(r => r.User)
                .WithMany()
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // The sweep runs every minute and asks the same question every time: which reminders
            // are due. Without this it is a full scan of the table on each tick, forever.
            builder.HasIndex(r => r.RemindAt);

            // One reminder per offset per user per task — "remind me a day before" twice is a
            // double email, not a stronger reminder.
            builder.HasIndex(r => new { r.ProjectTaskId, r.UserId, r.MinutesBeforeDue }).IsUnique();
        }
    }
}
