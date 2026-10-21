using FinanceTracker.Domain.Entities;

namespace FinanceTracker.Application.Abstractions;

public interface ICategoryRepository
{
    /// <summary>Stages new categories; they are written by <see cref="IUnitOfWork.SaveChangesAsync"/>.</summary>
    void AddRange(IEnumerable<Category> categories);
}
