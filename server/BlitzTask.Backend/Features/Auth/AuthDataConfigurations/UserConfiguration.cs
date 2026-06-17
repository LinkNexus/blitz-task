using BlitzTask.Backend.Infrastructure.Data.Configurations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlitzTask.Backend.Features.Auth.AuthDataConfigurations
{
    public class UserConfiguration : IEntityTypeConfiguration<User>
    {
        public void Configure(EntityTypeBuilder<User> builder)
        {
            builder.HasIndex(u => u.Email).IsUnique();
            builder.Property(u => u.Name).IsRequired().HasMaxLength(255);
            builder.Property(u => u.Email).IsRequired();
            builder.Property(u => u.Password).IsRequired();

            builder.ConfigureAuditable();
        }
    }
}
