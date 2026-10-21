using FinanceTracker.Domain.Entities;
using FinanceTracker.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FinanceTracker.Infrastructure.Persistence.Configurations;

internal sealed class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.ToTable("RefreshTokens");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.TokenHash)
            .HasMaxLength(RefreshToken.TokenHashLength)
            .IsFixedLength()
            .IsRequired();
        builder.HasIndex(t => t.TokenHash).IsUnique();

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(t => t.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Rotation chain. NO ACTION lets a user-delete cascade remove the whole chain in one statement.
        builder.HasOne<RefreshToken>()
            .WithMany()
            .HasForeignKey(t => t.ReplacedByTokenId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}
