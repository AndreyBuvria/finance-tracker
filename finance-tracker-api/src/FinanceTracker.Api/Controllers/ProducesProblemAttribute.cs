using System.Net.Mime;
using Microsoft.AspNetCore.Mvc;

namespace FinanceTracker.Api.Controllers;

/// <summary>Documents an RFC 7807 <see cref="ProblemDetails"/> error response as <c>application/problem+json</c>.</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class ProducesProblemAttribute(int statusCode)
    : ProducesResponseTypeAttribute(typeof(ProblemDetails), statusCode, MediaTypeNames.Application.ProblemJson);

/// <summary>Documents a <c>400</c> <see cref="ValidationProblemDetails"/> response as <c>application/problem+json</c>.</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class ProducesValidationProblemAttribute()
    : ProducesResponseTypeAttribute(
        typeof(ValidationProblemDetails),
        StatusCodes.Status400BadRequest,
        MediaTypeNames.Application.ProblemJson);
