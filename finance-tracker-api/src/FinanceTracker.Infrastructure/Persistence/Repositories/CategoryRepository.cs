using FinanceTracker.Application.Abstractions;
using FinanceTracker.Domain.Entities;

namespace FinanceTracker.Infrastructure.Persistence.Repositories;

internal sealed class CategoryRepository(AppDbContext dbContext) : ICategoryRepository
{
    public void AddRange(IEnumerable<Category> categories) => dbContext.Categories.AddRange(categories);
}
