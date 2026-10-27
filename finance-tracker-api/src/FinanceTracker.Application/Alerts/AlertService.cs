using FinanceTracker.Application.Abstractions;
using FinanceTracker.Application.Common;
using FluentValidation;

namespace FinanceTracker.Application.Alerts;

/// <summary>
/// The alerts bell (FEATURES.md F8, PLAN.md §7 Alerts contract): list alerts with the unread count, mark one or all
/// read. Alerts themselves are created by <see cref="BudgetAlertDetector"/> during expense writes.
/// </summary>
public sealed class AlertService(
    IAlertRepository alerts,
    IUnitOfWork unitOfWork,
    TimeProvider timeProvider,
    IValidator<AlertListQuery> listQueryValidator)
{
    /// <summary>Missing or another user's alert; both look the same to the caller.</summary>
    public static readonly Error NotFound = Error.NotFound("Alert not found", "This alert doesn't exist.");

    /// <summary>The user's alerts, newest first, and how many are unread.</summary>
    public async Task<Result<AlertListResponse>> ListAsync(
        Guid userId,
        AlertListQuery query,
        CancellationToken cancellationToken)
    {
        var validation = await listQueryValidator.ValidateAsync(query, cancellationToken);
        if (!validation.IsValid)
        {
            return validation.ToError();
        }

        var rows = await alerts.ListAsync(
            userId,
            query.UnreadOnly,
            query.Limit ?? AlertRules.DefaultLimit,
            cancellationToken);
        var unreadCount = await alerts.CountUnreadAsync(userId, cancellationToken);

        return new AlertListResponse([.. rows.Select(ToResponse)], unreadCount);
    }

    /// <summary>Marks one alert read. Idempotent: an alert that is already read keeps its first read time.</summary>
    public async Task<Result> MarkReadAsync(Guid userId, Guid alertId, CancellationToken cancellationToken)
    {
        var alert = await alerts.FindAsync(userId, alertId, cancellationToken);
        if (alert is null)
        {
            return NotFound;
        }

        if (alert.ReadAt is null)
        {
            alert.ReadAt = timeProvider.GetUtcNow();
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return Result.Success();
    }

    /// <summary>Marks every unread alert of the user read; already read ones keep their first read time.</summary>
    public Task MarkAllReadAsync(Guid userId, CancellationToken cancellationToken) =>
        alerts.MarkAllReadAsync(userId, timeProvider.GetUtcNow(), cancellationToken);

    /// <summary>The API shape of a stored alert; also used by the dashboard's latest alert.</summary>
    public static AlertResponse ToResponse(AlertRow row) =>
        new(
            row.Id,
            row.Level,
            CalendarMonth.ToText(row.Month),
            row.Category,
            row.Percent,
            row.Amount,
            row.DaysLeft,
            row.CreatedAt,
            row.ReadAt);
}
