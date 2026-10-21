using FinanceTracker.Domain.Entities;
using FinanceTracker.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FinanceTracker.Infrastructure.Persistence.Configurations;

internal sealed class AlertConfiguration : IEntityTypeConfiguration<Alert>
{
    public void Configure(EntityTypeBuilder<Alert> builder)
    {
        builder.ToTable("Alerts", table =>
            table.HasCheckConstraint("CK_Alerts_Month_FirstDay", "EXTRACT(DAY FROM \"Month\") = 1"));
        builder.HasKey(a => a.Id);

        builder.Property(a => a.Level)
            .HasConversion<string>()
            .HasMaxLength(ConfigurationConstants.EnumMaxLength);

        builder.HasIndex(a => new { a.UserId, a.CategoryId, a.Month, a.Level }).IsUnique();
        builder.HasIndex(a => a.CategoryId);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.Category)
            .WithMany()
            .HasForeignKey(a => a.CategoryId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
