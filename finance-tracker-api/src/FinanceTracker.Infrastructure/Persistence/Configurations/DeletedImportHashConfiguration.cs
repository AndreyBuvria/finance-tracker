using FinanceTracker.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FinanceTracker.Infrastructure.Persistence.Configurations;

internal sealed class DeletedImportHashConfiguration : IEntityTypeConfiguration<DeletedImportHash>
{
    public void Configure(EntityTypeBuilder<DeletedImportHash> builder)
    {
        builder.ToTable("DeletedImportHashes");
        builder.HasKey(h => new { h.AccountId, h.ExternalHash });

        builder.Property(h => h.ExternalHash)
            .HasMaxLength(Transaction.ExternalHashLength)
            .IsFixedLength();

        builder.HasOne(h => h.Account)
            .WithMany()
            .HasForeignKey(h => h.AccountId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
