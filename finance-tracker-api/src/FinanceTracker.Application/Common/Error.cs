namespace FinanceTracker.Application.Common;

public enum ErrorType
{
    Validation,
    Unauthorized,
    NotFound,
    Conflict,
}

/// <summary>
/// An expected, user-facing failure of a use case. The API maps it to an RFC 7807 response;
/// <see cref="Detail"/> is safe to show to the user.
/// </summary>
public sealed record Error(
    ErrorType Type,
    string Title,
    string Detail,
    IReadOnlyDictionary<string, string[]>? ValidationErrors = null)
{
    public static Error Validation(IReadOnlyDictionary<string, string[]> errors) =>
        new(ErrorType.Validation, "Validation failed", "One or more fields are invalid.", errors);

    public static Error Validation(string field, string message) =>
        Validation(new Dictionary<string, string[]> { [field] = [message] });

    public static Error Unauthorized(string title, string detail) => new(ErrorType.Unauthorized, title, detail);

    public static Error NotFound(string title, string detail) => new(ErrorType.NotFound, title, detail);

    public static Error Conflict(string title, string detail) => new(ErrorType.Conflict, title, detail);
}
