using FluentValidation;

namespace FinanceTracker.Application.Alerts;

/// <summary>Limits and user-facing messages for alerts (PLAN.md §7 Alerts contract).</summary>
public static class AlertRules
{
    public const int DefaultLimit = 20;
    public const int MaxLimit = 50;
    public const string LimitOutOfRange = "Limit must be between 1 and 50.";
}

public sealed class AlertListQueryValidator : AbstractValidator<AlertListQuery>
{
    public AlertListQueryValidator() =>
        RuleFor(q => q.Limit)
            .InclusiveBetween(1, AlertRules.MaxLimit)
            .WithMessage(AlertRules.LimitOutOfRange);
}
