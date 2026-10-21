using FinanceTracker.Domain.Entities;
using FinanceTracker.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FinanceTracker.Infrastructure.Persistence.Configurations;

internal sealed class BudgetConfiguration : IEntityTypeConfiguration<Budget>
{
    public void Configure(EntityTypeBuilder<Budget> builder)
    {
        builder.ToTable("Budgets", table =>
        {
            table.HasCheckConstraint("CK_Budgets_LimitAmount_Positive", "\"LimitAmount\" > 0");
            table.HasCheckConstraint("CK_Budgets_Month_FirstDay", "EXTRACT(DAY FROM \"Month\") = 1");
        });
        builder.HasKey(b => b.Id);

        builder.Property(b => b.LimitAmount)
            .HasPrecision(ConfigurationConstants.MoneyPrecision, ConfigurationConstants.MoneyScale);

        builder.HasIndex(b => new { b.UserId, b.CategoryId, b.Month }).IsUnique();
        builder.HasIndex(b => b.CategoryId);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(b => b.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(b => b.Category)
            .WithMany()
            .HasForeignKey(b => b.CategoryId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
