using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace FinanceTracker.Infrastructure.Persistence;

internal static class PostgresErrors
{
    /// <summary>Whether the save failed because it violated the named unique index or constraint.</summary>
    public static bool IsUniqueViolation(DbUpdateException exception, string constraintName) =>
        IsViolation(exception, PostgresErrorCodes.UniqueViolation, constraintName);

    /// <summary>Whether the save failed because a row still references the deleted one through the named foreign key.</summary>
    public static bool IsForeignKeyViolation(DbUpdateException exception, string constraintName) =>
        IsViolation(exception, PostgresErrorCodes.ForeignKeyViolation, constraintName);

    private static bool IsViolation(DbUpdateException exception, string sqlState, string constraintName) =>
        exception.InnerException is PostgresException postgresException
        && postgresException.SqlState == sqlState
        && postgresException.ConstraintName == constraintName;
}
