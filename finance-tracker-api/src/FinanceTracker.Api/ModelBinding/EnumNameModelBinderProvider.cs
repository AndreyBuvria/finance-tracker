using System.Collections.Frozen;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace FinanceTracker.Api.ModelBinding;

/// <summary>
/// Binds enums from the query string or route the same way <c>EnumNameConverterFactory</c> reads them from JSON:
/// names match case-insensitively; anything else (an unknown name or a number) binds to an undefined enum value
/// instead of failing model binding. The query validator's <c>IsInEnum()</c> rule then reports it on the field
/// itself with a friendly message (e.g. <c>type</c>: "Choose a transaction type.").
/// <para>
/// Consequence: every enum property of a query model must be validated with <c>IsInEnum()</c>.
/// </para>
/// </summary>
public sealed class EnumNameModelBinderProvider : IModelBinderProvider
{
    public IModelBinder? GetBinder(ModelBinderProviderContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        if (!QueryBinding.IsQueryOrRouteSource(context.BindingInfo.BindingSource))
        {
            return null;
        }

        var modelType = context.Metadata.ModelType;
        var enumType = Nullable.GetUnderlyingType(modelType) ?? modelType;
        return enumType.IsEnum ? new EnumNameModelBinder(enumType, modelType != enumType) : null;
    }

    private sealed class EnumNameModelBinder(Type enumType, bool isNullable) : IModelBinder
    {
        private readonly FrozenDictionary<string, object> _valuesByName = Enum.GetValues(enumType)
            .Cast<object>()
            .ToFrozenDictionary(value => value.ToString()!, StringComparer.OrdinalIgnoreCase);

        /// <summary>A value outside the enum's defined members, so <c>IsInEnum()</c> fails for it.</summary>
        private readonly object _undefined = FindUndefinedValue(enumType);

        public Task BindModelAsync(ModelBindingContext bindingContext)
        {
            var result = bindingContext.ValueProvider.GetValue(bindingContext.ModelName);
            if (result == ValueProviderResult.None)
            {
                return Task.CompletedTask;
            }

            bindingContext.ModelState.SetModelValue(bindingContext.ModelName, result);

            var text = result.FirstValue?.Trim();
            if (string.IsNullOrEmpty(text))
            {
                // "?type=" means "no filter" for an optional enum.
                bindingContext.Result = isNullable
                    ? ModelBindingResult.Success(null)
                    : ModelBindingResult.Success(_undefined);
                return Task.CompletedTask;
            }

            bindingContext.Result = ModelBindingResult.Success(
                _valuesByName.TryGetValue(text, out var value) ? value : _undefined);
            return Task.CompletedTask;
        }

        private static object FindUndefinedValue(Type enumType)
        {
            for (long candidate = -1; ; candidate--)
            {
                var value = Enum.ToObject(enumType, candidate);
                if (!Enum.IsDefined(enumType, value))
                {
                    return value;
                }
            }
        }
    }
}
