using System.Text.Json.Nodes;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace FinanceTracker.Api.OpenApi;

/// <summary>
/// Documents enums as the strings the API exchanges (see <c>EnumNameConverterFactory</c>), including
/// nullable enums (<c>TEnum?</c>), which are the enum names or <c>null</c>.
/// </summary>
internal sealed class EnumNamesSchemaTransformer : IOpenApiSchemaTransformer
{
    public Task TransformAsync(
        OpenApiSchema schema,
        OpenApiSchemaTransformerContext context,
        CancellationToken cancellationToken)
    {
        var type = context.JsonTypeInfo.Type;
        var underlyingType = Nullable.GetUnderlyingType(type);
        var enumType = underlyingType ?? type;
        if (!enumType.IsEnum)
        {
            return Task.CompletedTask;
        }

        // A nullable enum property is usually emitted as oneOf [null, $ref TEnum]; the referenced schema is
        // transformed on its own, so only an inline schema (e.g. a query parameter) needs rewriting here.
        if (underlyingType is not null && (schema.OneOf is { Count: > 0 } || schema.AnyOf is { Count: > 0 }))
        {
            return Task.CompletedTask;
        }

        schema.Type = underlyingType is null ? JsonSchemaType.String : JsonSchemaType.String | JsonSchemaType.Null;
        schema.Format = null;
        schema.Enum = [.. Enum.GetNames(enumType).Select(name => (JsonNode)JsonValue.Create(name))];
        if (underlyingType is not null)
        {
            schema.Enum.Add(null!);
        }

        return Task.CompletedTask;
    }
}
