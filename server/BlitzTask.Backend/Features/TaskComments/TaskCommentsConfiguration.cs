using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlitzTask.Backend.Features.TaskComments
{
    public class TaskCommentConfiguration : IEntityTypeConfiguration<TaskComment>
    {
        public void Configure(EntityTypeBuilder<TaskComment> builder)
        {
            builder.Property(c => c.Body).IsRequired().HasMaxLength(TaskComment.MaxBodyLength);

            builder
                .HasOne(c => c.ProjectTask)
                .WithMany(t => t.Comments)
                .HasForeignKey(c => c.ProjectTaskId)
                .OnDelete(DeleteBehavior.Cascade);

            builder
                .HasOne(c => c.Author)
                .WithMany()
                .HasForeignKey(c => c.AuthorId)
                .OnDelete(DeleteBehavior.Cascade);

            // Every read is the same question — this task's comments, oldest first — and a thread
            // is the one list in the app that only ever grows.
            builder.HasIndex(c => new { c.ProjectTaskId, c.CreatedAt });
        }
    }
}
