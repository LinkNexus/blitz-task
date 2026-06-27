using BlitzTask.Backend.Features.Attachments;
using BlitzTask.Backend.Features.Auth;
using BlitzTask.Backend.Features.ProjectColumns;
using BlitzTask.Backend.Features.ProjectMembers;
using BlitzTask.Backend.Features.Projects;
using BlitzTask.Backend.Features.ProjectTasks;
using BlitzTask.Backend.Features.Shared.Models;
using Microsoft.EntityFrameworkCore;

namespace BlitzTask.Backend.Infrastructure.Data;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
    : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<UserToken> UserTokens => Set<UserToken>();
    public DbSet<Attachment> Attachments => Set<Attachment>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectParticipant> ProjectParticipants => Set<ProjectParticipant>();
    public DbSet<ProjectInvitation> ProjectInvitations => Set<ProjectInvitation>();
    public DbSet<ProjectColumn> ProjectColumns => Set<ProjectColumn>();
    public DbSet<ProjectTask> ProjectTasks => Set<ProjectTask>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        UpdateTimeStamps();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void UpdateTimeStamps()
    {
        var now = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries<ICreateable>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                {
                    entry.Entity.CreatedAt = now;
                    if (entry.Entity is IAuditable auditable)
                        auditable.UpdatedAt = now;
                    break;
                }
                case EntityState.Modified:
                {
                    if (entry.Entity is IAuditable auditable)
                        auditable.UpdatedAt = now;
                    break;
                }
            }
        }
    }
}
