using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlitzTask.Backend.Features.Notifications
{
    public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
    {
        public void Configure(EntityTypeBuilder<Notification> builder)
        {
            builder.Property(n => n.ActorName).IsRequired().HasMaxLength(255);
            builder.Property(n => n.TaskName).HasMaxLength(255);

            builder
                .HasOne(n => n.User)
                .WithMany()
                .HasForeignKey(n => n.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // Two foreign keys to Users on one table, so this side must not cascade as well —
            // SQLite would be describing two delete paths to the same row.
            builder
                .HasOne(n => n.Actor)
                .WithMany()
                .HasForeignKey(n => n.ActorId)
                .OnDelete(DeleteBehavior.NoAction);

            builder
                .HasOne(n => n.Project)
                .WithMany()
                .HasForeignKey(n => n.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            builder
                .HasOne(n => n.Task)
                .WithMany()
                .HasForeignKey(n => n.TaskId)
                .OnDelete(DeleteBehavior.SetNull);

            // Every read is one person's, newest first, and the bell asks for the unread count
            // far more often than for the list.
            builder.HasIndex(n => new { n.UserId, n.CreatedAt });
            builder.HasIndex(n => new { n.UserId, n.ReadAt });
        }
    }
}
