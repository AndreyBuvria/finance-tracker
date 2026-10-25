using System.Collections.Frozen;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace FinanceTracker.Api.Json;

/// <summary>
/// Serializes every enum as its name (e.g. <c>"Card"</c>). On input, names match case-insensitively; anything else
/// (an unknown name, a number, another JSON type) does not fail deserialization but becomes an undefined enum value.
/// The request validator's <c>IsInEnum()</c> rule then rejects it with the field's own message, keyed by the field
/// name (e.g. <c>type</c>: "Choose an account type."), instead of a generic <c>$.type</c> JSON error.
/// <para>
/// Consequence: every enum property of a request DTO must be validated with <c>IsInEnum()</c>.
/// </para>
/// </summary>
public sealed class EnumNameConverterFactory : JsonConverterFactory
{
    public override bool CanConvert(Type typeToConvert) => typeToConvert.IsEnum;

    public override JsonConverter CreateConverter(Type typeToConvert, JsonSerializerOptions options) =>
        (JsonConverter)Activator.CreateInstance(typeof(EnumNameConverter<>).MakeGenericType(typeToConvert))!;

    private sealed class EnumNameConverter<TEnum> : JsonConverter<TEnum>
        where TEnum : struct, Enum
    {
        private static readonly FrozenDictionary<string, TEnum> _valuesByName = Enum.GetValues<TEnum>()
            .ToFrozenDictionary(value => value.ToString(), StringComparer.OrdinalIgnoreCase);

        /// <summary>A value outside the enum's defined members, so <c>IsInEnum()</c> fails for it.</summary>
        private static readonly TEnum _undefined = FindUndefinedValue();

        public override TEnum Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.String
                && reader.GetString() is { } name
                && _valuesByName.TryGetValue(name, out var value))
            {
                return value;
            }

            // Moves past an object/array value. Skip() would throw on a streamed (non-final) buffer; System.Text.Json
            // buffers the whole value before calling a custom converter, so TrySkip always succeeds here.
            _ = reader.TrySkip();
            return _undefined;
        }

        public override void Write(Utf8JsonWriter writer, TEnum value, JsonSerializerOptions options) =>
            writer.WriteStringValue(value.ToString());

        private static TEnum FindUndefinedValue()
        {
            for (long candidate = -1; ; candidate--)
            {
                var value = (TEnum)Enum.ToObject(typeof(TEnum), candidate);
                if (!Enum.IsDefined(value))
                {
                    return value;
                }
            }
        }
    }
}
