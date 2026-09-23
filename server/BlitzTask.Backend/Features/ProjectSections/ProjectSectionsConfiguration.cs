using BlitzTask.Backend.Features.ProjectTasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlitzTask.Backend.Features.ProjectSections
{
    public class ProjectSectionConfiguration : IEntityTypeConfiguration<ProjectSection>
    {
        public void Configure(EntityTypeBuilder<ProjectSection> builder)
        {
            builder.Property(s => s.Name).IsRequired().HasMaxLength(ProjectSection.MaxNameLength);
            builder.Property(s => s.Color).IsRequired().HasMaxLength(9);

            builder
                .HasOne(s => s.Project)
                .WithMany(p => p.Sections)
                .HasForeignKey(s => s.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            // Declared rather than left to EF's default for an optional FK, which is
            // `NO ACTION` in the database: deleting a section must leave its tasks standing with
            // no section, never fail because something still points at it. The handler nulls
            // them first regardless — this is the guarantee underneath that, for every other
            // path that could ever delete a section.
            builder
                .HasMany<ProjectTask>()
                .WithOne(t => t.Section)
                .HasForeignKey(t => t.SectionId)
                .OnDelete(DeleteBehavior.SetNull);

            // Every read is the same question: this project's sections, in render order.
            builder.HasIndex(s => new { s.ProjectId, s.Score });
        }
    }
}
