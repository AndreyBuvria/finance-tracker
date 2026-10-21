using FinanceTracker.Domain.Entities;
using FinanceTracker.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FinanceTracker.Infrastructure.Persistence.Configurations;

internal sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.ToTable("Categories", table =>
        {
            table.HasCheckConstraint("CK_Categories_Color_Hex", "\"Color\" ~ '^#[0-9a-f]{6}$'");
            table.HasCheckConstraint("CK_Categories_SystemKey_SnakeCase", "\"SystemKey\" ~ '^[a-z]+(_[a-z]+)*$'");
        });
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Name)
            .HasMaxLength(Category.NameMaxLength)
            .IsRequired();

        builder.Property(c => c.Type)
            .HasConversion<string>()
            .HasMaxLength(ConfigurationConstants.EnumMaxLength);

        builder.Property(c => c.Icon)
            .HasMaxLength(Category.IconMaxLength)
            .IsRequired();

        builder.Property(c => c.Color)
            .HasMaxLength(Category.ColorLength)
            .IsFixedLength()
            .IsRequired();

        builder.Property(c => c.SystemKey)
            .HasMaxLength(Category.SystemKeyMaxLength);

        builder.Property<string>(ConfigurationConstants.NormalizedName)
            .HasMaxLength(Category.NameMaxLength)
            .HasComputedColumnSql(ConfigurationConstants.NormalizedNameSql, stored: true)
            .IsRequired();

        // Name is unique per user and type among active categories, ignoring case; archived
        // (hidden or merged) ones may reuse a name.
        builder.HasIndex(nameof(Category.UserId), nameof(Category.Type), ConfigurationConstants.NormalizedName)
            .IsUnique()
            .HasFilter("\"IsArchived\" = false");

        // Each default category exists once per user.
        builder.HasIndex(c => new { c.UserId, c.SystemKey })
            .IsUnique()
            .HasFilter("\"SystemKey\" IS NOT NULL");

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(c => c.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
