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
        {
            table.HasCheckConstraint("CK_Alerts_Month_FirstDay", "EXTRACT(DAY FROM \"Month\") = 1");
            table.HasCheckConstraint("CK_Alerts_Percent_NonNegative", "\"Percent\" >= 0");
            table.HasCheckConstraint("CK_Alerts_Amount_NonNegative", "\"Amount\" >= 0");
            table.HasCheckConstraint("CK_Alerts_DaysLeft_Range", "\"DaysLeft\" BETWEEN 1 AND 31");
        });
        builder.HasKey(a => a.Id);

        builder.Property(a => a.Amount)
            .HasPrecision(ConfigurationConstants.MoneyPrecision, ConfigurationConstants.MoneyScale);

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
