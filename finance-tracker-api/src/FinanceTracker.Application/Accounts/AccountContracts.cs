using FinanceTracker.Domain.Enums;

namespace FinanceTracker.Application.Accounts;

/// <summary>Body of <c>POST /accounts</c> and <c>PUT /accounts/{id}</c>.</summary>
/// <param name="Name">Required, at most 50 characters (trimmed), unique among the user's active accounts.</param>
/// <param name="Type">Card, Savings or Cash.</param>
/// <param name="Currency">Optional; only <c>PLN</c> is accepted, and an omitted value means PLN.</param>
/// <param name="InitialBalance">Starting balance; optional (0 when omitted), may be negative, at most 2 decimals.</param>
public sealed record AccountRequest(string Name, AccountType? Type, string? Currency, decimal? InitialBalance);

/// <summary>An account with its balance computed from the starting balance and all its transactions.</summary>
public sealed record AccountResponse(
    Guid Id,
    string Name,
    AccountType Type,
    string Currency,
    decimal InitialBalance,
    decimal Balance,
    bool IsArchived);

/// <summary>Result of <c>GET /accounts</c>.</summary>
/// <param name="Items">Active accounts first, then archived ones (only when requested), each sorted by name.</param>
/// <param name="NetWorth">Sum of the active accounts' balances (PLN), whether or not archived ones are listed.</param>
public sealed record AccountListResponse(IReadOnlyList<AccountResponse> Items, decimal NetWorth);
