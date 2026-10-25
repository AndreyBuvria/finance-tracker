using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace FinanceTracker.Api.ModelBinding;

/// <summary>Shapes the automatic <c>400</c> for values that model binding couldn't read.</summary>
public static class QueryBinding
{
    public const string InvalidValue = "Enter a valid value.";

    /// <summary>
    /// Whether a custom binder may handle a value from this source: the query string or route (including properties
    /// of a <c>[FromQuery]</c> model, whose source is unset or generic model binding), never the body, headers or
    /// services.
    /// </summary>
    public static bool IsQueryOrRouteSource(BindingSource? source) =>
        source is null || source == BindingSource.Query || source == BindingSource.Path
        || source == BindingSource.ModelBinding;

    /// <summary>
    /// The default validation problem, with field keys converted to camelCase (<c>From</c> → <c>from</c>) so they
    /// match the keys of FluentValidation errors. JSON paths such as <c>$.amount</c> are kept as they are.
    /// </summary>
    public static IActionResult CamelCaseValidationProblem(ActionContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        var modelState = new ModelStateDictionary();
        foreach (var (key, entry) in context.ModelState)
        {
            foreach (var error in entry.Errors)
            {
                modelState.AddModelError(JsonNamingPolicy.CamelCase.ConvertName(key), error.ErrorMessage);
            }
        }

        var factory = context.HttpContext.RequestServices.GetRequiredService<ProblemDetailsFactory>();
        var problem = factory.CreateValidationProblemDetails(context.HttpContext, modelState);
        return new BadRequestObjectResult(problem) { ContentTypes = { "application/problem+json" } };
    }
}
