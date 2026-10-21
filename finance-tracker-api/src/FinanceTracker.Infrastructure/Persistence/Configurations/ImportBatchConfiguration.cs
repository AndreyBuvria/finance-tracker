using FinanceTracker.Domain.Entities;
using FinanceTracker.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FinanceTracker.Infrastructure.Persistence.Configurations;

internal sealed class ImportBatchConfiguration : IEntityTypeConfiguration<ImportBatch>
{
    public void Configure(EntityTypeBuilder<ImportBatch> builder)
    {
        builder.ToTable("ImportBatches", table =>
            table.HasCheckConstraint(
                "CK_ImportBatches_RowCounts_NonNegative",
                "\"RowsTotal\" >= 0 AND \"RowsImported\" >= 0 AND \"RowsSkipped\" >= 0"));
        builder.HasKey(b => b.Id);

        builder.Property(b => b.FileKey)
            .HasMaxLength(ImportBatch.FileKeyMaxLength)
            .IsRequired();

        builder.Property(b => b.BankFormat)
            .HasConversion<string>()
            .HasMaxLength(ConfigurationConstants.EnumMaxLength);

        builder.Property(b => b.Status)
            .HasConversion<string>()
            .HasMaxLength(ConfigurationConstants.EnumMaxLength);

        builder.Property(b => b.Error).HasMaxLength(ImportBatch.ErrorMaxLength);

        builder.HasIndex(b => new { b.UserId, b.CreatedAt });
        builder.HasIndex(b => b.AccountId);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(b => b.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(b => b.Account)
            .WithMany()
            .HasForeignKey(b => b.AccountId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}
