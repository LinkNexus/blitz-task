using BlitzTask.Backend.Features.Shared.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlitzTask.Backend.Infrastructure.Data
{
    public static class EntityMappingExtensions
    {
        public static void ConfigureCreateable<T>(this EntityTypeBuilder<T> builder)
            where T : class, ICreateable
        {
            builder
                .Property(e => e.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .ValueGeneratedOnAdd();
        }

        /// <summary>
        /// Hides trashed rows from every query in the app at once. A global filter rather than a
        /// <c>Where</c> per call site: there are dozens of the latter, and the one that gets
        /// forgotten is the one that shows a user something they deleted.
        /// <para>
        /// Reaching a trashed row — the trash screen, a restore, the purge — means asking for it
        /// deliberately with <c>IgnoreQueryFilters()</c>.
        /// </para>
        /// </summary>
        public static void ConfigureSoftDeletable<T>(this EntityTypeBuilder<T> builder)
            where T : class, ISoftDeletable
        {
            builder.HasQueryFilter(e => e.DeletedAt == null);

            // The purge sweeps on this column and the trash screen sorts by it.
            builder.HasIndex(e => e.DeletedAt);
        }

        public static void ConfigureAuditable<T>(this EntityTypeBuilder<T> builder)
            where T : class, IAuditable
        {
            builder.ConfigureCreateable();
            builder
                .Property(e => e.UpdatedAt)
                .IsRequired()
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .ValueGeneratedOnAddOrUpdate();
        }
    }
}
