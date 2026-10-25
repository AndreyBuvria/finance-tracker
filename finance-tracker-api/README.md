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

JWT bearer access tokens (15 minutes) plus opaque refresh tokens (14 days). Settings live in the `Jwt` section of `appsettings.json` (`Issuer`, `Audience`, `AccessTokenLifetime`, `RefreshTokenLifetime`, `RefreshTokenReuseGraceWindow`).

`Jwt:SigningKey` is a secret and is never committed. The API refuses to start without a key of at least 32 bytes, and outside the `Development` and `Testing` environments it also refuses the public local-only key from `docker-compose.yml`.

| Environment | Where the key comes from |
| --- | --- |
| `dotnet run` (Development) | user-secrets: `dotnet user-secrets set "Jwt:SigningKey" "$(openssl rand -base64 48)" --project src/FinanceTracker.Api` |
| Docker Compose | `Jwt__SigningKey` env var; the compose file has a clearly local-only default, overridable via `JWT_SIGNING_KEY` in `.env` |
| Integration tests | a test-only key set in `ApiFactory` |
| Deployed (Phase 3) | Secrets Manager / Parameter Store, exposed as `Jwt__SigningKey` |

Refresh tokens are stored only as SHA-256 hashes, rotated on every refresh, and presenting an already-revoked token revokes every token rotated from it. Exception: a token rotated less than `RefreshTokenReuseGraceWindow` (10 s) ago is treated as a concurrent refresh and gets a fresh access token plus the chain's current refresh token (re-derived with a server-side HMAC, so the chain is not forked). Logged-out or reuse-revoked tokens get no grace. Refresh decisions for a user are serialized with a PostgreSQL advisory lock. Login with an unknown email still verifies a dummy password hash, so it takes as long as a wrong password. Registration creates the user (`UserName` = email, unique) and seeds the 12 default categories in one database transaction. All endpoints require a bearer token except register, login, refresh and `/health`.

## Database and migrations

EF Core migrations live in `src/FinanceTracker.Infrastructure/Persistence/Migrations`. The initial migration creates the schema and enables the PostgreSQL `unaccent` and `pg_trgm` extensions; it also adds an immutable `f_unaccent(text)` wrapper and trigram (GIN) indexes on `f_unaccent("Merchant")` and `f_unaccent("Note")` for accent- and case-insensitive transaction search.

Pending migrations are applied automatically at startup when `Database:MigrateOnStartup` is `true` (set in `appsettings.Development.json` and by the integration tests). It is off by default, so deployed environments apply migrations as an explicit step. Startup settings (e.g. `Jwt`) are validated before migrating, so a misconfigured start fails without touching the database.

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
| `POST /api/auth/refresh` | `{ refreshToken }` → `200` `AuthTokens` (rotated); `401` when invalid, expired or revoked; `400` when the body is missing. A token rotated within the last 10 s returns `200` (see [Authentication](#authentication)). |
| `POST /api/auth/logout` | `{ refreshToken }`, bearer token required → `204`; revokes the caller's refresh token (also `204`, no-op, for an unknown, revoked or another user's token). |
| `GET /api/me` | `{ id, email, displayName, onboardingCompletedAt }`. |
| `POST /api/me/onboarding/complete` | `204`; sets `onboardingCompletedAt` once (repeat calls keep the first time); `409` "Add at least one account first." when the user has no active account. |
| `GET /api/accounts?includeArchived=false` | `200` `{ items: Account[], netWorth }`. Active accounts first, then archived ones (only with `includeArchived=true`), each sorted by name (case-insensitive). `netWorth` sums the active accounts only, even with `includeArchived=true`. |
| `POST /api/accounts` | `{ name, type, currency?, initialBalance? }` → `201` `Account`; `400` validation errors; `409` "An account with this name already exists." Currency defaults to PLN (others: "Only PLN is supported for now."); `initialBalance` defaults to 0 and may be negative. |
| `PUT /api/accounts/{id}` | Same body → `200` `Account`. Full replace: an omitted `initialBalance`/`currency` resets to its default, so send the current values. Archived accounts can be edited too (e.g. renamed before restore). `409` duplicate active name; `404` unknown or another user's account. |
| `DELETE /api/accounts/{id}` | Archives (never deletes) → `204`, also when already archived; `409` "You need at least one active account."; `404`. |
| `POST /api/accounts/{id}/restore` | `204`, also when already active; `409` "An account with this name already exists. Rename it first."; `404`. |
| `GET /api/categories?includeArchived=false&type=` | `200` `{ items: Category[] }`. Optional `type` (`Expense`/`Income`). Active first, then archived (only with `includeArchived=true`); expense before income; then by name (case-insensitive). |
| `GET /api/categories/top?limit=8&type=` | `200` `{ items: Category[] }`: active categories by number of transactions dated in the last 90 days (today in Europe/Warsaw included), then defaults in seeded order, then by name, so a new user gets the defaults. `limit` 1–50 (default 8), else `400` "Limit must be between 1 and 50." |
| `POST /api/categories` | `{ name, type, icon, color }` → `201` `Category`; `400` validation errors; `409` "A category with this name already exists." (same type, active, case-insensitive). `color` is stored lowercase. |
| `PUT /api/categories/{id}` | Same body → `200` `Category`. Archived categories can be edited (e.g. renamed before restore). `409` duplicate name; `409` "The type of a default category can't be changed."; `409` "This category is already in use, so its type can't be changed." (custom category with transactions, budgets or rules); `404`. |
| `DELETE /api/categories/{id}` | Hard-deletes a custom category without transactions, with its budgets, rules and alerts → `204`; `409` "This category has transactions. Archive it or merge it into another category instead."; `409` "Default categories can't be deleted. Hide them instead."; `409` for "Other"/"Other income"; `404`. |
| `POST /api/categories/{id}/archive` | Hides it → `204`, also when already archived; `409` "This category can't be hidden. It collects transactions that don't fit anywhere else." for "Other"/"Other income"; `404`. |
| `POST /api/categories/{id}/restore` | `204`, also when already active; `409` "A category with this name already exists. Rename it first."; `404`. |
| `POST /api/categories/{id}/merge` | `{ targetCategoryId }` → `200` `{ transactionsMoved, budgetsMoved, rulesMoved, target: Category }`. One DB transaction: moves transactions and rules, sums budgets of the same month (moves the rest), deletes the source's alerts, archives the source. `400` on `targetCategoryId`: "Choose a category to merge into.", "Choose a different category.", "Choose an active category.", "Choose a category of the same type."; `409` "This category can't be merged. It collects transactions that don't fit anywhere else." for "Other"/"Other income"; `409` "Merging would make a monthly budget too large. Lower one of the limits first." when a same-month sum would exceed the largest storable amount; `404` unknown or another user's source or target. |
| `GET /api/transactions?from&to&accountId&categoryId&type&minAmount&maxAmount&q&page=1&pageSize=50&sort=-date` | `200` `{ items: Transaction[], page, pageSize, totalCount, totalPages, totals: { income, expenses, net } }`. All filters optional (AND); `categoryId` may repeat; `accountId` also matches a transfer whose other side is in that account; `q` searches merchant and note case- and accent-insensitively (`f_unaccent` + `ILIKE`, trigram indexes). `sort` = `date`/`amount`/`merchant`/`category`/`account`, `-` prefix for descending, ties broken by ID. `pageSize` 1–200; amount sorts unsigned; no default month (the client sends `from`/`to`). A transfer is one row; `totalCount` and `totals` cover all matching rows, transfers count as rows but add no money, `expenses` = expenses − refunds (income in expense categories), floored at 0 (never negative), `net` = `income` − `expenses` as returned, `income` = income in income categories only. Query decimals use a dot. |
| `GET /api/transactions/merchants?q=&limit=10` | `200` `{ items: [{ merchant, lastUsedOn, lastCategory: TransactionCategory \| null }] }`: past merchants (expenses and income) containing `q`, grouped ignoring letter case and shown in their most recent spelling (names starting with `q` first, then most recent), each with the category of its newest transaction whose category is still active. `limit` 1–20. |
| `POST /api/transactions` | `{ type: "Expense" \| "Income", amount, date, accountId, categoryId, merchant?, note? }` → `201` `Transaction`. Expenses need an expense category; income may use an income category or an expense category (a refund, which lowers Spent). `400` field errors; `404` unknown or another user's account/category. |
| `PUT /api/transactions/{id}` | Same body → `200` `Transaction`. An unchanged archived account/category may stay; new ones must be active. `409` for a transfer row; `404`. |
| `DELETE /api/transactions/{id}` | `204`; a transfer row deletes the whole pair; an imported row leaves a `DeletedImportHashes` tombstone. `404`. |
| `POST /api/transactions/bulk` | `{ action: "Delete" \| "Recategorize", transactionIds: Guid[1..500], categoryId? }` → `200` `{ affectedCount }`, all or nothing. Delete removes a selected transfer as a pair (counted once). Recategorize: expenses need an expense category, income fits either type, so an income category with expenses selected is refused ("Choose an expense category." when only expenses are selected, "Select only expenses or only income to change their category." for a mix); transfers can't be recategorized. `404` if any ID is unknown or another user's. |
| `POST /api/transfers` | `{ fromAccountId, toAccountId, amount, date, note? }` → `201` `Transaction` (the Out row, with `transfer`). Two rows sharing `transferPairId` in one DB transaction. `400` "Choose two different accounts."; `404`. |
| `PUT /api/transfers/{transferPairId}` | Same body → `200` `Transaction`; changes both sides. `404`. |
| `DELETE /api/transfers/{transferPairId}` | `204`; deletes both sides. `404`. |
| `PUT /api/budgets/{categoryId}?month=YYYY-MM` | `{ limitAmount }` → `200` `{ categoryId, month: "YYYY-MM", limitAmount }`, creating or replacing the limit (stored as the first day of the month). `limitAmount` `0` or `null` removes it → `204`, also when there was none. Expense categories only (`400` "Budgets can only be set for expense categories." on `categoryId`); setting needs an active category (`400` "This category is hidden. Choose an active category."), removing is allowed for a hidden one; any month. `400` on `month`: "Choose a month." / "Enter a month as YYYY-MM."; on `limitAmount`: "Enter an amount of 0 or more.", "Enter an amount with at most 2 decimal places.", "Enter a smaller amount."; `404` unknown or another user's category. Runs under the user's category lock (shared with merge). |

`AuthTokens` = `{ accessToken, expiresIn /* seconds */, refreshToken }`.

`Account` = `{ id, name, type: "Card" | "Savings" | "Cash", currency: "PLN", initialBalance, balance, isArchived }`. `balance` is never stored: PostgreSQL computes it as `initialBalance` + income − expenses − transfers out + transfers in. Validation messages: "Enter an account name.", "Name can be at most 50 characters.", "Choose an account type." (also for an unknown `type` value), "Only PLN is supported for now.", "Enter an amount with at most 2 decimal places.", "Enter a smaller amount.". Another user's account ID always returns `404`.

`Category` = `{ id, name, type: "Expense" | "Income", icon, color, systemKey: string | null, isArchived, isProtected, transactionCount, budgetCount }`. `isProtected` marks the import fallbacks "Other" and "Other income" (can't be hidden, merged or deleted); the counts cover all dates/months and drive the delete/merge UI. Validation messages: "Enter a category name.", "Name can be at most 30 characters.", "Choose a category type.", "Choose an icon.", "Choose a color.". Another user's category ID (as source or merge target) always returns `404`.

`Transaction` = `{ id, type: "Expense" | "Income" | "Transfer", amount, date, merchant, note, source: "Manual" | "Csv" | "OpenBanking", account: { id, name, isArchived }, category: { id, name, type, icon, color, systemKey, isArchived } | null, transfer: { transferPairId, fromAccount, toAccount } | null, import: { batchId, importedAt } | null, needsCategory }`. Amounts are always positive; `type` decides the sign. `needsCategory` marks imported rows still in "Other"/"Other income". "Today" for date rules is the Europe/Warsaw calendar date; a date may be at most tomorrow ("Date can't be in the future.").

Enums are sent as their names (e.g. `"Card"`) and accepted case-insensitively by name, never as numbers. An unknown value is reported as a validation error on that field (e.g. `type`), not as a JSON parsing error. The same applies to enums in the query string (e.g. `?type=Refund`). Other query values that can't be read (e.g. `from=yesterday`, `minAmount=1,5` — use a dot) return "Enter a valid value." on that field.

Successful bodies are `application/json`. Errors are RFC 7807 `ProblemDetails` (`application/problem+json`) with a `traceId`; validation errors carry `errors` keyed by camelCase field name.
