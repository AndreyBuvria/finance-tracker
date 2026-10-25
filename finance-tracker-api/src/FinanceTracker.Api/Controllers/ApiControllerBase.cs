using System.Text.Json;
using FinanceTracker.Api.Authentication;
using FinanceTracker.Application.Common;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace FinanceTracker.Api.Controllers;

[ApiController]
[ProducesJson]
public abstract class ApiControllerBase : ControllerBase
{
    /// <summary>The signed-in user's ID, taken from the access token (never from the request).</summary>
    protected Guid CurrentUserId => User.GetUserId();

    /// <summary>Maps an application <see cref="Error"/> to an RFC 7807 response.</summary>
    protected ActionResult ErrorResult(Error error)
    {
        if (error.Type == ErrorType.Validation)
        {
            var modelState = new ModelStateDictionary();
            foreach (var (field, messages) in error.ValidationErrors ?? new Dictionary<string, string[]>())
            {
                foreach (var message in messages)
                {
                    modelState.AddModelError(JsonNamingPolicy.CamelCase.ConvertName(field), message);
                }
            }

            return ValidationProblem(detail: error.Detail, modelStateDictionary: modelState);
        }

        var statusCode = error.Type switch
        {
            ErrorType.Unauthorized => StatusCodes.Status401Unauthorized,
            ErrorType.NotFound => StatusCodes.Status404NotFound,
            ErrorType.Conflict => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status400BadRequest,
        };

        return Problem(statusCode: statusCode, title: error.Title, detail: error.Detail);
    }
}
