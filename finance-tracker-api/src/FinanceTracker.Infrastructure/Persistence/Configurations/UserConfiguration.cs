using FinanceTracker.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FinanceTracker.Infrastructure.Persistence.Configurations;

internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.Property(u => u.DisplayName)
            .HasMaxLength(User.DisplayNameMaxLength)
            .IsRequired();

        builder.Property(u => u.DefaultCurrency)
            .HasMaxLength(User.DefaultCurrencyLength)
            .IsFixedLength()
            .HasDefaultValue(User.DefaultCurrencyCode)
            .IsRequired();
    }
}
