namespace FinanceTracker.Infrastructure.Persistence.Configurations;

internal static class ConfigurationConstants
{
    /// <summary>Money columns map to <c>numeric(18,2)</c>.</summary>
    public const int MoneyPrecision = 18;
    public const int MoneyScale = 2;

    /// <summary>Enums are stored as their names.</summary>
    public const int EnumMaxLength = 20;

    /// <summary>
    /// Shadow property holding <c>lower("Name")</c> as a stored generated column. It backs the
    /// case-insensitive unique indexes on account and category names and can be queried with
    /// <c>EF.Property&lt;string&gt;(entity, NormalizedName)</c>.
    /// </summary>
    public const string NormalizedName = "NormalizedName";

    public const string NormalizedNameSql = "lower(\"Name\")";
}
