using FinanceTracker.Domain.Entities;
using FinanceTracker.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FinanceTracker.Infrastructure.Persistence.Configurations;

internal sealed class TransactionConfiguration : IEntityTypeConfiguration<Transaction>
{
    public void Configure(EntityTypeBuilder<Transaction> builder)
    {
        builder.ToTable("Transactions", table =>
        {
            table.HasCheckConstraint("CK_Transactions_Amount_Positive", "\"Amount\" > 0");
            table.HasCheckConstraint(
                "CK_Transactions_TransferDirection",
                "(\"Type\" = 'Transfer') = (\"TransferDirection\" IS NOT NULL)");
            table.HasCheckConstraint(
                "CK_Transactions_TransferPairId",
                "(\"Type\" = 'Transfer') = (\"TransferPairId\" IS NOT NULL)");
            // Expense and income always have a category; transfers never do.
            table.HasCheckConstraint(
                "CK_Transactions_CategoryId",
                "(\"Type\" = 'Transfer') = (\"CategoryId\" IS NULL)");
        });
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Type)
            .HasConversion<string>()
            .HasMaxLength(ConfigurationConstants.EnumMaxLength);

        builder.Property(t => t.TransferDirection)
            .HasConversion<string>()
            .HasMaxLength(ConfigurationConstants.EnumMaxLength);

        builder.Property(t => t.Source)
            .HasConversion<string>()
            .HasMaxLength(ConfigurationConstants.EnumMaxLength);

        builder.Property(t => t.Amount)
            .HasPrecision(ConfigurationConstants.MoneyPrecision, ConfigurationConstants.MoneyScale);

        builder.Property(t => t.Merchant).HasMaxLength(Transaction.MerchantMaxLength);
        builder.Property(t => t.Note).HasMaxLength(Transaction.NoteMaxLength);

        builder.Property(t => t.ExternalHash)
            .HasMaxLength(Transaction.ExternalHashLength)
            .IsFixedLength();

        builder.HasIndex(t => new { t.UserId, t.Date });
        builder.HasIndex(t => new { t.AccountId, t.ExternalHash }).IsUnique();
        builder.HasIndex(t => t.CategoryId);
        builder.HasIndex(t => t.ImportBatchId);

        // A transfer pair has exactly one Out row and one In row.
        builder.HasIndex(t => new { t.TransferPairId, t.TransferDirection })
            .IsUnique()
            .HasFilter("\"TransferPairId\" IS NOT NULL");

        // Trigram indexes on f_unaccent(Merchant) / f_unaccent(Note) are expression indexes,
        // created with raw SQL in the InitialCreate migration.

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(t => t.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Accounts and categories are archived, not deleted, while they have history.
        // NO ACTION (checked at statement end) still lets a user-delete cascade remove everything.
        builder.HasOne(t => t.Account)
            .WithMany()
            .HasForeignKey(t => t.AccountId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(t => t.Category)
            .WithMany()
            .HasForeignKey(t => t.CategoryId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(t => t.ImportBatch)
            .WithMany()
            .HasForeignKey(t => t.ImportBatchId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}
