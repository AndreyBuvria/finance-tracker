using FinanceTracker.Application.Auth;
using FinanceTracker.Application.Me;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace FinanceTracker.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);

        services.AddScoped<AuthService>();
        services.AddScoped<MeService>();

        return services;
    }
}
