using System.Net.Mime;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace FinanceTracker.Api.OpenApi;

/// <summary>
/// Aligns the OpenAPI document with what the API actually sends: error responses are documented only as
/// <c>application/problem+json</c> (the controller-level <c>application/json</c> applies to successful
/// bodies), and <c>204 No Content</c> responses have no body.
/// </summary>
internal sealed class ResponseContentTypesTransformer : IOpenApiOperationTransformer
{
    public Task TransformAsync(
        OpenApiOperation operation,
        OpenApiOperationTransformerContext context,
        CancellationToken cancellationToken)
    {
        foreach (var (statusCode, response) in operation.Responses ?? [])
        {
            if (response.Content is not { } content)
            {
                continue;
            }

            if (statusCode == "204")
            {
                content.Clear();
            }
            else if (statusCode.StartsWith('4') || statusCode.StartsWith('5'))
            {
                if (content.ContainsKey(MediaTypeNames.Application.ProblemJson))
                {
                    content.Remove(MediaTypeNames.Application.Json);
                }
            }
        }

        return Task.CompletedTask;
    }
}
