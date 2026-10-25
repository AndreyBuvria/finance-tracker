using FinanceTracker.Application.Abstractions;
using FinanceTracker.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FinanceTracker.Infrastructure.Persistence.Repositories;

internal sealed class BudgetRepository(AppDbContext dbContext) : IBudgetRepository
{
    public Task<Budget?> FindAsync(Guid userId, Guid categoryId, DateOnly month, CancellationToken cancellationToken) =>
        dbContext.Budgets.SingleOrDefaultAsync(
            b => b.UserId == userId && b.CategoryId == categoryId && b.Month == month,
            cancellationToken);

    public void Add(Budget budget) => dbContext.Budgets.Add(budget);

    public void Remove(Budget budget) => dbContext.Budgets.Remove(budget);
}
