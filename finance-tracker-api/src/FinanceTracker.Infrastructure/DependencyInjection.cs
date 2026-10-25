using FinanceTracker.Application.Abstractions;
using FinanceTracker.Application.Auth;
using FinanceTracker.Infrastructure.Identity;
using FinanceTracker.Infrastructure.Persistence;
using FinanceTracker.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace FinanceTracker.Infrastructure;

public static class DependencyInjection
{
    public const string ConnectionStringName = "Default";

    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        // The connection string is resolved when the DbContext is first created, so hosts
        // (including integration tests) can supply it through any configuration source.
        services.AddDbContext<AppDbContext>((serviceProvider, options) =>
        {
            var configuration = serviceProvider.GetRequiredService<IConfiguration>();
            var connectionString = configuration.GetConnectionString(ConnectionStringName)
                ?? throw new InvalidOperationException(
                    $"Connection string 'ConnectionStrings:{ConnectionStringName}' is not configured.");

            options.UseNpgsql(connectionString);
        });

        services
            .AddIdentityCore<User>(options =>
            {
                // UserName = Email, so the unique UserNameIndex also rejects concurrent duplicate emails.
                options.User.RequireUniqueEmail = true;
                // Any email the validator accepts is a valid user name.
                options.User.AllowedUserNameCharacters = string.Empty;

                // FEATURES.md F1: at least 8 characters with a letter and a number. The letter rule
                // is enforced by the request validator; Identity has no "any letter" option.
                options.Password.RequiredLength = AuthRules.PasswordMinLength;
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = false;
                options.Password.RequireUppercase = false;
                options.Password.RequireNonAlphanumeric = false;
                options.Password.RequiredUniqueChars = 1;
            })
            .AddEntityFrameworkStores<AppDbContext>();

        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IUserAccounts, UserAccounts>();
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
        services.AddScoped<ICategoryRepository, CategoryRepository>();
        services.AddScoped<IAccountRepository, AccountRepository>();
        services.AddScoped<ITransactionRepository, TransactionRepository>();
        services.AddScoped<IBudgetRepository, BudgetRepository>();

        return services;
    }
}
