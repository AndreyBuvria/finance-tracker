using System.Globalization;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace FinanceTracker.Api.ModelBinding;

/// <summary>
/// Binds <see cref="decimal"/> query/route values with a dot as the only decimal separator and no thousands
/// separators. The default binder accepts "1,5" as 15 (comma = invariant thousands separator), which would silently
/// turn a Polish-style amount filter into a different number; here it is a binding error instead.
/// </summary>
public sealed class InvariantDecimalModelBinderProvider : IModelBinderProvider
{
    private const NumberStyles _styles = NumberStyles.AllowLeadingWhite
        | NumberStyles.AllowTrailingWhite
        | NumberStyles.AllowLeadingSign
        | NumberStyles.AllowDecimalPoint;

    public IModelBinder? GetBinder(ModelBinderProviderContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        if (!QueryBinding.IsQueryOrRouteSource(context.BindingInfo.BindingSource))
        {
            return null;
        }

        var modelType = context.Metadata.ModelType;
        return modelType == typeof(decimal) || modelType == typeof(decimal?)
            ? new DecimalModelBinder(modelType == typeof(decimal?))
            : null;
    }

    private sealed class DecimalModelBinder(bool isNullable) : IModelBinder
    {
        public Task BindModelAsync(ModelBindingContext bindingContext)
        {
            var result = bindingContext.ValueProvider.GetValue(bindingContext.ModelName);
            if (result == ValueProviderResult.None)
            {
                return Task.CompletedTask;
            }

            bindingContext.ModelState.SetModelValue(bindingContext.ModelName, result);

            var text = result.FirstValue;
            if (string.IsNullOrWhiteSpace(text) && isNullable)
            {
                bindingContext.Result = ModelBindingResult.Success(null);
                return Task.CompletedTask;
            }

            if (decimal.TryParse(text, _styles, CultureInfo.InvariantCulture, out var value))
            {
                bindingContext.Result = ModelBindingResult.Success(value);
                return Task.CompletedTask;
            }

            bindingContext.ModelState.TryAddModelError(
                bindingContext.ModelName,
                bindingContext.ModelMetadata.ModelBindingMessageProvider.AttemptedValueIsInvalidAccessor(
                    text ?? "",
                    bindingContext.ModelMetadata.Name ?? bindingContext.ModelName));
            bindingContext.Result = ModelBindingResult.Failed();
            return Task.CompletedTask;
        }
    }
}
