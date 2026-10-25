using FinanceTracker.Application.Abstractions;
using FinanceTracker.Application.Common;
using FinanceTracker.Domain.Constants;
using FinanceTracker.Domain.Entities;
using FluentValidation;
using Microsoft.Extensions.Logging;

namespace FinanceTracker.Application.Accounts;

/// <summary>Accounts with computed balances; archive instead of delete (FEATURES.md F2).</summary>
public sealed partial class AccountService(
    IAccountRepository accounts,
    IUnitOfWork unitOfWork,
    TimeProvider timeProvider,
    IValidator<AccountRequest> validator,
    ILogger<AccountService> logger)
{
    /// <summary>Missing or another user's account; both look the same to the caller.</summary>
    public static readonly Error NotFound = Error.NotFound("Account not found", "This account doesn't exist.");

    public static readonly Error DuplicateName = Error.Conflict(
        "Account name taken",
        "An account with this name already exists.");

    public static readonly Error RestoreNameTaken = Error.Conflict(
        "Account name taken",
        "An account with this name already exists. Rename it first.");

    public static readonly Error LastActiveAccount = Error.Conflict(
        "Last active account",
        "You need at least one active account.");

    /// <summary>The user's accounts with balances, plus net worth over the active ones.</summary>
    public async Task<AccountListResponse> ListAsync(Guid userId, bool includeArchived, CancellationToken cancellationToken)
    {
        var items = await accounts.ListWithBalancesAsync(userId, includeArchived, cancellationToken);

        // MVP accounts are all PLN; the currency filter keeps net worth single-currency if that ever changes.
        var netWorth = items
            .Where(a => !a.IsArchived && a.Currency == Money.Pln)
            .Sum(a => a.Balance);

        return new AccountListResponse(items, netWorth);
    }

    public async Task<Result<AccountResponse>> CreateAsync(
        Guid userId,
        AccountRequest request,
        CancellationToken cancellationToken)
    {
        var validation = await validator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
        {
            return validation.ToError();
        }

        var name = request.Name.Trim();
        if (await accounts.ActiveNameExistsAsync(userId, name, null, cancellationToken))
        {
            return DuplicateName;
        }

        var account = new Account
        {
            Id = Guid.CreateVersion7(timeProvider.GetUtcNow()),
            UserId = userId,
            Name = name,
            Type = request.Type!.Value,
            Currency = Money.Pln,
            InitialBalance = request.InitialBalance ?? 0m,
        };
        accounts.Add(account);

        if (!await accounts.TrySaveChangesAsync(cancellationToken))
        {
            return DuplicateName;
        }

        LogCreated(userId, account.Id);

        // A new account has no transactions yet, so its balance is the starting balance.
        return ToResponse(account, account.InitialBalance);
    }

    /// <summary>
    /// Renames or changes an account, including an archived one (so a name clash on restore can be fixed).
    /// A new starting balance changes every computed balance.
    /// </summary>
    public async Task<Result<AccountResponse>> UpdateAsync(
        Guid userId,
        Guid accountId,
        AccountRequest request,
        CancellationToken cancellationToken)
    {
        var account = await accounts.FindAsync(userId, accountId, cancellationToken);
        if (account is null)
        {
            return NotFound;
        }

        var validation = await validator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
        {
            return validation.ToError();
        }

        var name = request.Name.Trim();

        // Names only need to be unique among active accounts.
        if (!account.IsArchived && await accounts.ActiveNameExistsAsync(userId, name, accountId, cancellationToken))
        {
            return DuplicateName;
        }

        account.Name = name;
        account.Type = request.Type!.Value;
        account.Currency = Money.Pln;
        account.InitialBalance = request.InitialBalance ?? 0m;

        if (!await accounts.TrySaveChangesAsync(cancellationToken))
        {
            return DuplicateName;
        }

        var updated = await accounts.GetWithBalanceAsync(userId, accountId, cancellationToken);
        return updated is null ? NotFound : updated;
    }

    /// <summary>
    /// Archives the account (<c>DELETE /accounts/{id}</c>); its transactions stay in history. Idempotent.
    /// Runs under a per-user lock so two concurrent requests can't archive the last two active accounts.
    /// </summary>
    public async Task<Result> ArchiveAsync(Guid userId, Guid accountId, CancellationToken cancellationToken)
    {
        await using var transaction = await unitOfWork.BeginTransactionAsync(cancellationToken);
        await accounts.LockUserAccountsAsync(userId, cancellationToken);

        var account = await accounts.FindAsync(userId, accountId, cancellationToken);
        if (account is null)
        {
            return NotFound;
        }

        if (account.IsArchived)
        {
            return Result.Success();
        }

        if (await accounts.CountActiveAsync(userId, cancellationToken) <= 1)
        {
            return LastActiveAccount;
        }

        account.IsArchived = true;
        await unitOfWork.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        LogArchived(userId, accountId);
        return Result.Success();
    }

    /// <summary>Restores an archived account. Idempotent. Fails when an active account already uses its name.</summary>
    public async Task<Result> RestoreAsync(Guid userId, Guid accountId, CancellationToken cancellationToken)
    {
        var account = await accounts.FindAsync(userId, accountId, cancellationToken);
        if (account is null)
        {
            return NotFound;
        }

        if (!account.IsArchived)
        {
            return Result.Success();
        }

        if (await accounts.ActiveNameExistsAsync(userId, account.Name, accountId, cancellationToken))
        {
            return RestoreNameTaken;
        }

        account.IsArchived = false;
        if (!await accounts.TrySaveChangesAsync(cancellationToken))
        {
            return RestoreNameTaken;
        }

        LogRestored(userId, accountId);
        return Result.Success();
    }

    private static AccountResponse ToResponse(Account account, decimal balance) =>
        new(
            account.Id,
            account.Name,
            account.Type,
            account.Currency,
            account.InitialBalance,
            balance,
            account.IsArchived);

    [LoggerMessage(Level = LogLevel.Information, Message = "User {UserId} created account {AccountId}")]
    private partial void LogCreated(Guid userId, Guid accountId);

    [LoggerMessage(Level = LogLevel.Information, Message = "User {UserId} archived account {AccountId}")]
    private partial void LogArchived(Guid userId, Guid accountId);

    [LoggerMessage(Level = LogLevel.Information, Message = "User {UserId} restored account {AccountId}")]
    private partial void LogRestored(Guid userId, Guid accountId);
}
