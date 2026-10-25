namespace FinanceTracker.Infrastructure.Persistence;

/// <summary>
/// CLR stubs for PostgreSQL functions mapped in <see cref="AppDbContext"/>. Use them only inside
/// LINQ queries translated by EF Core.
/// </summary>
public static class PostgresFunctions
{
    /// <summary>Name of the immutable <c>unaccent</c> wrapper created by the initial migration.</summary>
    public const string UnaccentFunctionName = "f_unaccent";

    /// <summary>
    /// Removes diacritics (e.g. "Żabka" becomes "Zabka"). Translates to <c>f_unaccent(text)</c>,
    /// which is immutable so the trigram indexes on transaction text can use it.
    /// </summary>
    public static string? Unaccent(string? input) =>
        throw new NotSupportedException($"{nameof(Unaccent)} can only be used in EF Core LINQ queries.");

    /// <summary>
    /// PostgreSQL <c>lower(text)</c>. Unlike <c>string.ToLower()</c> on a C# value, which EF Core evaluates in
    /// .NET before sending it, this always runs in the database, so it lowercases a parameter exactly like
    /// the generated <c>NormalizedName</c> column (<c>lower("Name")</c>) regardless of collation.
    /// </summary>
    public static string Lower(string input) =>
        throw new NotSupportedException($"{nameof(Lower)} can only be used in EF Core LINQ queries.");
}
