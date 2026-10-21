# Finance Tracker API

Backend for Finance Tracker: an ASP.NET Core Web API (.NET 10) with PostgreSQL. The Angular frontend lives in the sibling folder `finance-tracker-web/` of the same repository, and the shared specs are in `.claude/docs/` at the repository root (`../.claude/docs/PLAN.md`, `../.claude/docs/FEATURES.md`).

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- Docker with Docker Compose v2 (local PostgreSQL and integration tests via Testcontainers)

## Project layout

```text
FinanceTracker.slnx
src/
  FinanceTracker.Api             # controllers, DI, middleware, HTTP configuration
  FinanceTracker.Application     # use cases, business rules, DTOs, validators
  FinanceTracker.Domain          # entities, enums, domain logic (no dependencies)
  FinanceTracker.Infrastructure  # EF Core DbContext, migrations, external adapters
  FinanceTracker.Csv             # bank CSV parsers + categorization (Phase 4)
  FinanceTracker.ImportLambda    # S3-triggered CSV import function (Phase 4)
tests/
  FinanceTracker.IntegrationTests  # xUnit + WebApplicationFactory + Testcontainers PostgreSQL
  samples/                         # anonymized bank CSV fixtures
```

## Run everything with Docker Compose

```bash
docker compose up -d --build
curl http://localhost:5080/health   # -> Healthy
docker compose down                 # add -v to also delete the database volume
```

This starts PostgreSQL 18 (`localhost:5432`) and the API (`http://localhost:5080`, port 8080 inside the container). The defaults are non-secret local values; to change them, copy `.env.example` to `.env` and edit it. If another PostgreSQL already uses port 5432, set `POSTGRES_HOST_PORT` in `.env`.

## Run the API with `dotnet run`

Start only the database, then run the API on the host:

```bash
docker compose up -d postgres
dotnet run --project src/FinanceTracker.Api
```

The API listens on `http://localhost:5080` (the Angular dev server proxies `/api` there). The Development connection string is in `src/FinanceTracker.Api/appsettings.Development.json`; override it with the `ConnectionStrings__Default` environment variable if needed. In Development, the OpenAPI document is served at `/openapi/v1.json`.

## Tests

```bash
dotnet test FinanceTracker.slnx
```

Integration tests start a throwaway PostgreSQL container through Testcontainers, so Docker must be running. There are no unit tests by design.

## Useful commands

```bash
dotnet build FinanceTracker.slnx
dotnet format FinanceTracker.slnx
```

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Liveness + database connectivity check. Returns `200 Healthy` or `503 Unhealthy`. |

Errors are returned as RFC 7807 `ProblemDetails` with a `traceId`.
