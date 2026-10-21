# syntax=docker/dockerfile:1
# Build context: repository root (see docker-compose.yml).

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first so the package layer is cached until project files change.
COPY Directory.Build.props Directory.Packages.props .editorconfig ./
COPY src/FinanceTracker.Domain/FinanceTracker.Domain.csproj src/FinanceTracker.Domain/
COPY src/FinanceTracker.Application/FinanceTracker.Application.csproj src/FinanceTracker.Application/
COPY src/FinanceTracker.Infrastructure/FinanceTracker.Infrastructure.csproj src/FinanceTracker.Infrastructure/
COPY src/FinanceTracker.Api/FinanceTracker.Api.csproj src/FinanceTracker.Api/
RUN dotnet restore src/FinanceTracker.Api/FinanceTracker.Api.csproj

COPY src/ src/
RUN dotnet publish src/FinanceTracker.Api/FinanceTracker.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
COPY --from=build /app/publish .
USER $APP_UID
ENTRYPOINT ["dotnet", "FinanceTracker.Api.dll"]
