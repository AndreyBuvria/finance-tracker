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

The API container gets a local-development-only JWT signing key from `docker-compose.yml` (override it with `JWT_SIGNING_KEY` in `.env`). This starts PostgreSQL 18 (`localhost:55432` on the host, port 5432 inside the Compose network) and the API (`http://localhost:5080`, port 8080 inside the container). Host port 55432 avoids clashing with a locally installed PostgreSQL on 5432. The defaults are non-secret local values; to change them, copy `.env.example` to `.env` and edit it (e.g. `POSTGRES_HOST_PORT`). If you change the host port, also update the connection string in `src/FinanceTracker.Api/appsettings.Development.json` or set `ConnectionStrings__Default`.

## Run the API with `dotnet run`

Start only the database, set the JWT signing key once (see [Authentication](#authentication)), then run the API on the host:

```bash
docker compose up -d postgres
dotnet user-secrets set "Jwt:SigningKey" "$(openssl rand -base64 48)" --project src/FinanceTracker.Api   # once
dotnet run --project src/FinanceTracker.Api
```

The API listens on `http://localhost:5080` (the Angular dev server proxies `/api` there). The Development connection string is in `src/FinanceTracker.Api/appsettings.Development.json`; override it with the `ConnectionStrings__Default` environment variable if needed. In Development, the OpenAPI document is served at `/openapi/v1.json`.

## Authentication

JWT bearer access tokens (15 minutes) plus opaque refresh tokens (14 days). Settings live in the `Jwt` section of `appsettings.json` (`Issuer`, `Audience`, `AccessTokenLifetime`, `RefreshTokenLifetime`).

`Jwt:SigningKey` is a secret and is never committed. The API refuses to start without a key of at least 32 bytes.

| Environment | Where the key comes from |
| --- | --- |
| `dotnet run` (Development) | user-secrets: `dotnet user-secrets set "Jwt:SigningKey" "$(openssl rand -base64 48)" --project src/FinanceTracker.Api` |
| Docker Compose | `Jwt__SigningKey` env var; the compose file has a clearly local-only default, overridable via `JWT_SIGNING_KEY` in `.env` |
| Integration tests | a test-only key set in `ApiFactory` |
| Deployed (Phase 3) | Secrets Manager / Parameter Store, exposed as `Jwt__SigningKey` |

Refresh tokens are stored only as SHA-256 hashes, rotated on every refresh, and presenting an already-revoked token revokes every token rotated from it. Registration creates the user (`UserName` = email, unique) and seeds the 12 default categories in one database transaction. All endpoints require a bearer token except register, login, refresh and `/health`.

## Database and migrations

EF Core migrations live in `src/FinanceTracker.Infrastructure/Persistence/Migrations`. The initial migration creates the schema and enables the PostgreSQL `unaccent` and `pg_trgm` extensions; it also adds an immutable `f_unaccent(text)` wrapper and trigram (GIN) indexes on `f_unaccent("Merchant")` and `f_unaccent("Note")` for accent- and case-insensitive transaction search.

Pending migrations are applied automatically at startup when `Database:MigrateOnStartup` is `true` (set in `appsettings.Development.json` and by the integration tests). It is off by default, so deployed environments apply migrations as an explicit step.

```bash
dotnet tool install --global dotnet-ef   # once
dotnet ef migrations add <Name> -p src/FinanceTracker.Infrastructure -s src/FinanceTracker.Api -o Persistence/Migrations
dotnet ef database update -p src/FinanceTracker.Infrastructure -s src/FinanceTracker.Api
```

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
| `POST /api/auth/register` | `{ displayName, email, password }` → `201` `AuthTokens`; `409` duplicate email; `400` validation errors. |
| `POST /api/auth/login` | `{ email, password }` → `200` `AuthTokens`; `401` "Email or password is incorrect." |
| `POST /api/auth/refresh` | `{ refreshToken }` → `200` `AuthTokens` (rotated); `401` when invalid, expired or revoked. |
| `POST /api/auth/logout` | `{ refreshToken }`, bearer token required → `204`; revokes the caller's refresh token. |
| `GET /api/me` | `{ id, email, displayName, onboardingCompletedAt }`. |
| `POST /api/me/onboarding/complete` | `204`; sets `onboardingCompletedAt` once (repeat calls keep the first time). |

`AuthTokens` = `{ accessToken, expiresIn /* seconds */, refreshToken }`.

Errors are returned as RFC 7807 `ProblemDetails` with a `traceId`.
