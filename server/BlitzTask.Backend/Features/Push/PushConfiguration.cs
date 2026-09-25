using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlitzTask.Backend.Features.Push
{
    public class PushSubscriptionConfiguration : IEntityTypeConfiguration<PushSubscription>
    {
        public void Configure(EntityTypeBuilder<PushSubscription> builder)
        {
            // Endpoints are long — some push services emit several hundred characters.
            builder.Property(s => s.Endpoint).IsRequired().HasMaxLength(1024);
            builder.Property(s => s.P256dh).IsRequired().HasMaxLength(256);
            builder.Property(s => s.Auth).IsRequired().HasMaxLength(256);

            builder
                .HasOne(s => s.User)
                .WithMany()
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // The endpoint identifies the device, so re-subscribing must update the row it
            // already has rather than adding a second one that buzzes alongside it.
            builder.HasIndex(s => s.Endpoint).IsUnique();

            // Every send asks the same question: which devices does this person have.
            builder.HasIndex(s => s.UserId);
        }
    }
}
