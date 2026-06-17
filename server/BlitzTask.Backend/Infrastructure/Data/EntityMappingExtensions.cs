using BlitzTask.Backend.Features.Shared.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlitzTask.Backend.Infrastructure.Data.Configurations
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
