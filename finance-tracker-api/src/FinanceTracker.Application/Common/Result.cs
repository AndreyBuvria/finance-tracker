using System.Diagnostics.CodeAnalysis;
using FluentValidation.Results;

namespace FinanceTracker.Application.Common;

/// <summary>Outcome of a use case without a return value.</summary>
public sealed class Result
{
    private Result(Error? error) => Error = error;

    public Error? Error { get; }

    [MemberNotNullWhen(false, nameof(Error))]
    public bool IsSuccess => Error is null;

    public static Result Success() => new(null);

    public static Result Failure(Error error) => new(error);

    public static implicit operator Result(Error error) => Failure(error);
}

/// <summary>Outcome of a use case: either a value or an expected <see cref="Common.Error"/>.</summary>
public sealed class Result<T>
{
    private Result(T? value, Error? error)
    {
        Value = value;
        Error = error;
    }

    public T? Value { get; }

    public Error? Error { get; }

    [MemberNotNullWhen(true, nameof(Value))]
    [MemberNotNullWhen(false, nameof(Error))]
    public bool IsSuccess => Error is null;

    public static Result<T> Success(T value) => new(value, null);

    public static Result<T> Failure(Error error) => new(default, error);

    public static implicit operator Result<T>(T value) => Success(value);

    public static implicit operator Result<T>(Error error) => Failure(error);
}

public static class ValidationResultExtensions
{
    /// <summary>Converts FluentValidation failures to a validation <see cref="Error"/> keyed by property name.</summary>
    public static Error ToError(this ValidationResult validationResult) =>
        Error.Validation(validationResult.ToDictionary().AsReadOnly());
}
