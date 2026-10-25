using System.Text.Json;
using System.Text.Json.Serialization;

namespace FinanceTracker.IntegrationTests.Infrastructure;

/// <summary>JSON settings matching the API: camelCase properties and enums as their names.</summary>
public static class ApiJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };
}
