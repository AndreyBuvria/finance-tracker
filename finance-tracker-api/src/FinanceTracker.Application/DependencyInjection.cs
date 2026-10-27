using FinanceTracker.Application.Accounts;
using FinanceTracker.Application.Alerts;
using FinanceTracker.Application.Auth;
using FinanceTracker.Application.Budgets;
using FinanceTracker.Application.Categories;
using FinanceTracker.Application.Common;
using FinanceTracker.Application.Me;
using FinanceTracker.Application.Transactions;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace FinanceTracker.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);

        services.AddSingleton<BusinessClock>();

        services.AddScoped<AccountService>();
        services.AddScoped<AlertService>();
        services.AddScoped<AuthService>();
        services.AddScoped<BudgetAlertDetector>();
        services.AddScoped<BudgetCalculator>();
        services.AddScoped<BudgetService>();
        services.AddScoped<CategoryService>();
        services.AddScoped<MeService>();
        services.AddScoped<TransactionService>();
        services.AddScoped<TransferService>();

        return services;
    }
}
