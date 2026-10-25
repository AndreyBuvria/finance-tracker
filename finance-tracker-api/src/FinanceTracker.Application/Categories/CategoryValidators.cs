using FinanceTracker.Domain.Constants;
using FinanceTracker.Domain.Entities;
using FluentValidation;

namespace FinanceTracker.Application.Categories;

/// <summary>User-facing messages for category forms (FEATURES.md F5).</summary>
public static class CategoryRules
{
    public const string NameRequired = "Enter a category name.";
    public const string NameTooLong = "Name can be at most 30 characters.";
    public const string TypeRequired = "Choose a category type.";
    public const string IconRequired = "Choose an icon.";
    public const string ColorRequired = "Choose a color.";
    public const string MergeTargetRequired = "Choose a category to merge into.";
    public const string MergeTargetSame = "Choose a different category.";
    public const string MergeTargetArchived = "Choose an active category.";
    public const string MergeTargetOtherType = "Choose a category of the same type.";
    public const string TopLimitOutOfRange = "Limit must be between 1 and 50.";

    public const int TopDefaultLimit = 8;
    public const int TopMaxLimit = 50;

    /// <summary>"Most used" counts transactions dated within the last 90 days, today included.</summary>
    public const int TopWindowDays = 90;

    /// <summary>Palette colors are stored lowercase; input may use either case.</summary>
    public static string? NormalizeColor(string? color) => color?.Trim().ToLowerInvariant();
}

public sealed class CategoryRequestValidator : AbstractValidator<CategoryRequest>
{
    public CategoryRequestValidator()
    {
        RuleFor(r => r.Name)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage(CategoryRules.NameRequired)
            .Must(name => name.Trim().Length <= Category.NameMaxLength).WithMessage(CategoryRules.NameTooLong);

        RuleFor(r => r.Type)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage(CategoryRules.TypeRequired)
            .IsInEnum().WithMessage(CategoryRules.TypeRequired);

        RuleFor(r => r.Icon)
            .Must(CategoryIcons.Contains).WithMessage(CategoryRules.IconRequired);

        RuleFor(r => r.Color)
            .Must(color => CategoryPalette.Contains(CategoryRules.NormalizeColor(color)))
            .WithMessage(CategoryRules.ColorRequired);
    }
}

public sealed class MergeCategoryRequestValidator : AbstractValidator<MergeCategoryRequest>
{
    public MergeCategoryRequestValidator()
    {
        RuleFor(r => r.TargetCategoryId)
            .Must(id => id is not null && id != Guid.Empty)
            .WithMessage(CategoryRules.MergeTargetRequired);
    }
}

public sealed class CategoryListQueryValidator : AbstractValidator<CategoryListQuery>
{
    public CategoryListQueryValidator()
    {
        RuleFor(q => q.Type).IsInEnum().WithMessage(CategoryRules.TypeRequired);
    }
}

public sealed class TopCategoriesQueryValidator : AbstractValidator<TopCategoriesQuery>
{
    public TopCategoriesQueryValidator()
    {
        RuleFor(q => q.Limit)
            .InclusiveBetween(1, CategoryRules.TopMaxLimit)
            .WithMessage(CategoryRules.TopLimitOutOfRange);

        RuleFor(q => q.Type).IsInEnum().WithMessage(CategoryRules.TypeRequired);
    }
}
