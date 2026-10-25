using System.Net.Mime;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace FinanceTracker.Api.Controllers;

/// <summary>
/// <c>[Produces("application/json")]</c> for successful responses only. A plain <see cref="ProducesAttribute"/>
/// would also force <see cref="ProblemDetails"/> error bodies to <c>application/json</c>; this one writes them
/// as <c>application/problem+json</c> (RFC 7807) instead.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class ProducesJsonAttribute() : ProducesAttribute(MediaTypeNames.Application.Json)
{
    public override void OnResultExecuting(ResultExecutingContext context)
    {
        if (context.Result is ObjectResult { Value: ProblemDetails } problemResult)
        {
            problemResult.ContentTypes.Clear();
            problemResult.ContentTypes.Add(MediaTypeNames.Application.ProblemJson);
            return;
        }

        base.OnResultExecuting(context);
    }
}
