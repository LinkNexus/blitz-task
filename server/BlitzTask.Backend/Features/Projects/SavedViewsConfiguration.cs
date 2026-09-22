using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlitzTask.Backend.Features.Projects
{
    public class SavedViewConfiguration : IEntityTypeConfiguration<SavedView>
    {
        public void Configure(EntityTypeBuilder<SavedView> builder)
        {
            builder.Property(v => v.Name).IsRequired().HasMaxLength(SavedView.MaxNameLength);
            builder.Property(v => v.Search).IsRequired().HasMaxLength(SavedView.MaxSearchLength);

            builder
                .HasOne(v => v.Project)
                .WithMany()
                .HasForeignKey(v => v.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            builder
                .HasOne(v => v.User)
                .WithMany()
                .HasForeignKey(v => v.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // Every read is the same question: my views on this board. Also the shape the
            // uniqueness below needs, so one index serves both.
            builder.HasIndex(v => new { v.ProjectId, v.UserId, v.Name }).IsUnique();
        }
    }
}
