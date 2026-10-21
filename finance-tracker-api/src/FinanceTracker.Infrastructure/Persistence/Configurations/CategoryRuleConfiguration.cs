using FinanceTracker.Domain.Entities;
using FinanceTracker.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FinanceTracker.Infrastructure.Persistence.Configurations;

internal sealed class CategoryRuleConfiguration : IEntityTypeConfiguration<CategoryRule>
{
    public void Configure(EntityTypeBuilder<CategoryRule> builder)
    {
        builder.ToTable("CategoryRules");
        builder.HasKey(r => r.Id);

        builder.Property(r => r.Pattern)
            .HasMaxLength(CategoryRule.PatternMaxLength)
            .IsRequired();

        builder.Property(r => r.MatchType)
            .HasConversion<string>()
            .HasMaxLength(ConfigurationConstants.EnumMaxLength);

        builder.HasIndex(r => new { r.UserId, r.Priority });
        builder.HasIndex(r => r.CategoryId);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(r => r.Category)
            .WithMany()
            .HasForeignKey(r => r.CategoryId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
