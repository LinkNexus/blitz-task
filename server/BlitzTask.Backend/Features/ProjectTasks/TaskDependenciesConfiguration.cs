using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlitzTask.Backend.Features.ProjectTasks
{
    public class ProjectTaskDependencyConfiguration
        : IEntityTypeConfiguration<ProjectTaskDependency>
    {
        public void Configure(EntityTypeBuilder<ProjectTaskDependency> builder)
        {
            // The pair *is* the identity, which is also what makes a duplicate edge impossible to
            // store rather than merely refused by the handler.
            builder.HasKey(d => new { d.DependentTaskId, d.DependsOnTaskId });

            builder
                .HasOne(d => d.DependentTask)
                .WithMany(t => t.BlockedBy)
                .HasForeignKey(d => d.DependentTaskId)
                .OnDelete(DeleteBehavior.Cascade);

            // Deleting *either* end removes the edge — an edge to a task that no longer exists is
            // not a dependency, it is a dangling row. This only fires on a hard delete: a task in
            // the trash keeps its edges, so restoring one gives its graph back.
            builder
                .HasOne(d => d.DependsOnTask)
                .WithMany(t => t.Blocks)
                .HasForeignKey(d => d.DependsOnTaskId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(d => d.DependsOnTaskId);
        }
    }
}
