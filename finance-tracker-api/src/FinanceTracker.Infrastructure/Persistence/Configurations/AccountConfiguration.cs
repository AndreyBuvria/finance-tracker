using FinanceTracker.Domain.Entities;
using FinanceTracker.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FinanceTracker.Infrastructure.Persistence.Configurations;

internal sealed class AccountConfiguration : IEntityTypeConfiguration<Account>
{
    public void Configure(EntityTypeBuilder<Account> builder)
    {
        builder.ToTable("Accounts");
        builder.HasKey(a => a.Id);

        builder.Property(a => a.Name)
            .HasMaxLength(Account.NameMaxLength)
            .IsRequired();

        builder.Property(a => a.Type)
            .HasConversion<string>()
            .HasMaxLength(ConfigurationConstants.EnumMaxLength);

        builder.Property(a => a.Currency)
            .HasMaxLength(Account.CurrencyLength)
            .IsFixedLength()
            .IsRequired();

        builder.Property(a => a.InitialBalance)
            .HasPrecision(ConfigurationConstants.MoneyPrecision, ConfigurationConstants.MoneyScale);

        builder.Property<string>(ConfigurationConstants.NormalizedName)
            .HasMaxLength(Account.NameMaxLength)
            .HasComputedColumnSql(ConfigurationConstants.NormalizedNameSql, stored: true)
            .IsRequired();

        // Name is unique per user among active accounts, ignoring case; archived ones may reuse a name.
        builder.HasIndex(nameof(Account.UserId), ConfigurationConstants.NormalizedName)
            .IsUnique()
            .HasFilter("\"IsArchived\" = false");

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
