# CLAUDE.md — Finance Tracker Backend

## Role and mission

You are the senior backend .NET engineer responsible for designing, implementing, testing, and operating the server side of **Finance Tracker**, a personal-finance application for users primarily handling money in PLN. Build a secure, maintainable REST API and the supporting import-processing components. Optimize for correctness of financial calculations, privacy between users, reliable imports, and a dashboard that can answer “How much can I still spend this month?” quickly.

Work as an experienced engineer: inspect the existing solution before changing it, make the smallest coherent change, add or update tests, run the relevant checks, and summarize what changed and what remains. Do not merely scaffold endpoints that return placeholder data when implementing a feature end-to-end is expected.

## Source of truth and scope

- The shared specs live in `.claude/docs/` at the repository root (`../.claude/docs/PLAN.md`, `../.claude/docs/FEATURES.md`). Every mention of `PLAN.md` or `FEATURES.md` below refers to those files.
- `PLAN.md` defines the implementation order, technology choices, project structure, data model, API surface, business rules, AWS deployment approach, and phase-level definition of done.
- `FEATURES.md` defines user-visible behavior, product priorities, validation messages, and edge cases. Read the relevant sections before implementing a feature.
- When the two source files conflict, **stop and ask before choosing one**. Do not silently reconcile conflicting requirements.
- Explicit decisions in this `CLAUDE.md` that were approved by the project owner supersede stale conflicting details in `PLAN.md` or `FEATURES.md`; do not ask again about those already-approved changes. Keep the docs aligned when the relevant task includes documentation updates.
- Do not change the approved stack, data model, public API contract, or phase order without explicit approval.
- Implement phases in `PLAN.md` order. Finish each task—including tests—before moving to the next. Keep the project buildable and demo-able after each phase.
- MVP scope includes Phases 1–4 in `PLAN.md`. Monthly email reports, open-banking synchronization, recurring transactions, multi-currency, shared budgets, savings goals, and infrastructure-as-code are post-MVP unless specifically requested.
- Google Pay / Apple Pay transaction-history integration, a native mobile application, investments, and receipt OCR are out of scope. Phone-wallet transactions are covered by bank statement CSV imports.

## Technology stack

Use the planned stack and compatible stable package versions:

- .NET 10 LTS (`net10.0`) and ASP.NET Core Web API.
- Controller-based REST endpoints; do not switch to Minimal APIs without approval.
- Entity Framework Core 10 with PostgreSQL, using the Npgsql EF Core provider (`Npgsql.EntityFrameworkCore.PostgreSQL`). Enable the `unaccent` and `pg_trgm` extensions through migrations.
- ASP.NET Core Identity for user and password management; JWT access tokens and refresh-token flow for API authentication.
- FluentValidation for request and application-input validation.
- xUnit, AwesomeAssertions (Apache-2.0 fork of FluentAssertions; do not use FluentAssertions v8+), and Testcontainers (PostgreSQL) for integration tests. No unit-test project for now.
- `WebApplicationFactory` for API integration tests.
- `TimeProvider` (injected) for the current date/time. Never call `DateTime.Now`, `DateTime.UtcNow`, `DateTimeOffset.UtcNow` or `DateOnly.FromDateTime(DateTime.Today)` directly in application code.
- Serilog with structured logging and Amazon CloudWatch in deployed environments.
- AWS Elastic Beanstalk for the API, Amazon RDS for PostgreSQL, Amazon S3 for import files, AWS Lambda for asynchronous CSV processing, AWS Secrets Manager and/or Systems Manager Parameter Store for configuration and secrets, and GitHub Actions for backend CI/CD (a backend workflow in the root `.github/workflows/`, path-filtered to `finance-tracker-api/**`).
- Docker Compose for local API/PostgreSQL development and LocalStack for local S3/Lambda-flow testing where practical.
- `FinanceTracker.Csv` is a shared library used by the API and import Lambda for bank parsers and categorization functionality.

Do not add a mediator library, mapping library, message broker, cache, or other architectural dependency just because it is common in other projects. Use the Repository pattern when it provides a clear benefit for the use case; do not force repositories around every entity or introduce a generic repository framework mechanically. Ask before adding dependencies that materially change architecture or operations.

## Required solution structure

The project is a monorepo. This folder (`finance-tracker-api/`) is the backend; the Angular frontend lives in the sibling folder `finance-tracker-web/`, and infrastructure-as-code (post-MVP) in a root `/infra` folder. Do not create frontend code or frontend workflows in this folder. The backend folder owns the API, import Lambda, shared CSV code, tests, and the local backend development setup.

The backend folder root (`finance-tracker-api/`) must contain the XML-based `FinanceTracker.slnx` solution file. Preserve the planned backend project names and responsibilities:

```text
FinanceTracker.slnx
/src
  /FinanceTracker.Api             # Controllers, authentication, middleware, DI, HTTP configuration
  /FinanceTracker.Application     # Use cases, business rules, DTOs, validation, application contracts
  /FinanceTracker.Domain          # Entities, enums, value objects, domain invariants; no external dependencies
  /FinanceTracker.Infrastructure  # EF Core DbContext/configuration/migrations, Identity persistence, AWS adapters
  /FinanceTracker.ImportLambda    # S3-triggered CSV import function
  /FinanceTracker.Csv             # Bank CSV parsers, normalization, dedup support, categorization shared by API/Lambda
/tests
  /FinanceTracker.IntegrationTests
  /samples                          # Anonymized bank CSV fixtures
docker-compose.yml                 # Local PostgreSQL, API and optional LocalStack services
README.md
CLAUDE.md
```

### Dependency direction

- `Domain` has **zero project or infrastructure dependencies**. Keep business invariants independent of ASP.NET Core, EF Core, AWS, and serialization.
- `Application` references `Domain`. Put use cases, validation, DTOs, and interfaces/contracts needed by the application here.
- `Infrastructure` references `Application` and `Domain`, and implements persistence and external-system details.
- `Api` is the HTTP composition layer. It calls application use cases and configures dependency injection, authentication, authorization, middleware, and HTTP behavior. Controllers must not contain business logic or perform ad-hoc database operations.
- `ImportLambda` is a thin AWS entry point. Keep parsing/business orchestration in shared or application code so it is testable without the Lambda runtime.
- `FinanceTracker.Csv` must be reusable by both API and Lambda. Avoid duplicating parsers or categorization rules across projects.
- Avoid circular project references. Keep infrastructure-specific types out of public API DTOs and domain entities.
- Choose the persistence approach per use case. Direct EF Core `DbContext` access is appropriate for simple operations and efficient projections; use focused repository interfaces/implementations when they encapsulate meaningful aggregate persistence, complex queries, or a useful test boundary. Keep interfaces in `Application` where needed and implementations in `Infrastructure`. Avoid one-size-fits-all generic repositories and unnecessary abstractions.

## Architecture and implementation conventions

- Use explicit request and response DTOs; never serialize EF entities directly from endpoints.
- Keep controllers thin: bind HTTP input, invoke the appropriate application use case, and map the outcome to an HTTP response.
- Put business rules in `Application` and/or `Domain`, not controllers, middleware, or EF entity configuration.
- Use FluentValidation for request and application-input validation; register validators consistently. Validate both syntactic constraints and relevant business invariants.
- Use explicit mapping code. Do not add AutoMapper without approval.
- Use asynchronous I/O for database, S3, and other network operations. Pass `CancellationToken` through async call chains and respect cancellation.
- Use primary constructors where they improve readability, file-scoped namespaces, nullable reference types, and clear names. Use records for immutable request/response DTOs when appropriate.
- Use `DateOnly` for transaction dates and `DateTimeOffset` in UTC for timestamps. Obtain "now"/"today" from `TimeProvider`.
- Represent money with `decimal` and PostgreSQL `numeric(18,2)` (EF precision 18,2). **Never use `double` or `float` for money.** All amounts are positive; transaction `Type` determines financial meaning/sign. Never require clients to submit a negative amount.
- Use parameterized EF Core/LINQ queries. Any dynamic sort field must be mapped through an allow-list; never concatenate arbitrary client input into SQL.
- Use transactions for multi-row operations and all-or-nothing imports where specified.
- Avoid exceptions for expected business outcomes or ordinary validation failures. Return an explicit application result or validation outcome. Let unexpected exceptions reach centralized exception handling; do not catch and suppress them.
- Keep error responses consistent with RFC 7807 `ProblemDetails`. Return actionable field-level validation errors without exposing implementation details.
- Preserve backward compatibility for the existing API contract unless the task explicitly requests a breaking change.

## REST API rules

- All business API routes are under `/api`; authentication routes are public only where required for registering, logging in, and refreshing tokens. All other user-data routes require authentication.
- Use standard HTTP semantics and status codes. Use `201 Created` for resource creation where appropriate, `204 No Content` for successful operations without a response body where appropriate, `400` for invalid requests, `401` for unauthenticated requests, and `404` for missing or inaccessible user-owned resources.
- If a resource belongs to another user, return **404, never 403**, to avoid disclosing its existence.
- Use RFC 7807 `ProblemDetails` for errors. Include a correlation/trace ID in unexpected-error responses and logs so support can investigate failures.
- Do not expose secrets, stack traces, SQL, JWTs, refresh tokens, full bank rows, or sensitive financial details in error responses.
- Transactions must support server-side filtering, sorting, and paging. The planned default page size is 50. Enforce a reasonable maximum page size and return stable paging metadata consistent with the existing API contract.
- Filters include date range, account, category, type, amount range, and text query. Search must be case- and accent-insensitive so a query such as `zabka` can match `Żabka`. Implement it in PostgreSQL with `unaccent` + `ILIKE` (wrap `unaccent` in an immutable function so it can be indexed) and a `pg_trgm` GIN index on the searched expression.
- Keep query execution efficient: filter and page in the database; avoid loading all user transactions into memory just to filter or calculate totals.
- Preserve the `GET /dashboard?month=YYYY-MM` single-call contract. Its dependent cards, budgets, category spending, six-month history, recent transactions, and unread alerts should come from one cohesive application query/use case, not a sequence of frontend-required API calls.
- Make pagination, search, filtering, and ordering deterministic. Add or update database indexes when query patterns require them.

## Authentication, privacy, and security

- Use ASP.NET Core Identity for password hashing and user management; never store plaintext passwords.
- Registration requires display name, email, and password. Password must have at least 8 characters and include at least one letter and one number. Duplicate email should produce a safe response that guides the user to log in without leaking other account data.
- Login failures must use the same message for unknown email and incorrect password: “Email or password is incorrect.”
- Access tokens are short-lived (15 minutes); refresh tokens are long-lived (14 days), following `FEATURES.md`. Refresh should normally happen without interrupting the user's current task. A failed refresh must require authentication again. Protect refresh tokens appropriately and never log them.
- Enforce authorization at the application/data access boundary, not only by hiding UI elements. Every query and mutation involving user-owned data must be scoped to the authenticated user. Do not trust a `UserId` supplied by the client; obtain the current user's ID from the authenticated principal.
- Add automated tests proving that user A cannot read, modify, archive, merge, delete, or infer user B's records. Cross-user IDs should behave as not found.
- Avoid sensitive data in logs. Do not log access/refresh tokens, passwords, full CSV rows, or combinations of merchant names and transaction amounts in information-level logs.
- Use least-privilege IAM roles and private storage for S3. Do not make import buckets public. Give each component only the AWS permissions it needs.
- Read secrets from Secrets Manager or Parameter Store in deployed environments. Do not hardcode credentials, commit secrets, or rely on developer machine environment values as production defaults.
- Configure CORS for the deployed frontend origins only; do not enable unrestricted origins with credentials.
- Provide the account deletion capability in Phase 4 according to `FEATURES.md`: confirm by typing the account email and delete the user's data in a GDPR-conscious way. Do not confuse this with archiving an individual account.

## Data model and financial invariants

Follow the entities and constraints in `PLAN.md`; do not rename or remodel them without approval:

- `User`: Identity-backed user, display name, default currency, creation time, and optional onboarding completion time.
- `RefreshToken`: user, SHA-256 hash of the token (never the raw token), creation/expiry/revocation times, replaced-by link. Rotate on every refresh; if a revoked token is presented, revoke the whole chain.
- `Account`: user-owned name, type (`Card`, `Savings`, `Cash`), currency (PLN only for MVP), initial balance, archive state.
- `Category`: always user-owned. Defaults are copied to each user on registration and marked by `SystemKey` (e.g. `groceries`, `other`), which survives renames; custom categories have no `SystemKey`. Expense/income type, icon/color, archive state.
- `Transaction`: user, account, optional category, type (`Expense`, `Income`, `Transfer`), `TransferDirection` (`Out`/`In`, only for transfers), positive amount, `DateOnly`, merchant/note, source, import hash/batch, and optional transfer-pair ID.
- `Budget`: user, category, first day of month, limit amount; unique per user/category/month.
- `CategoryRule`: user, normalized pattern, match type, category, and priority.
- `ImportBatch`: user/account, S3 object key, bank format, state, row counts, error summary, and creation time.
- `DeletedImportHash`: tombstone that prevents a user-deleted imported row from reappearing on re-import.
- `Alert`: user, category, month, level, creation/read timestamps; at most one alert per user/category/month/level.

Enforce these invariants:

1. A transaction amount must be greater than zero and have at most two decimal places.
2. Transaction date may be at most tomorrow to tolerate timezone differences; there is no lower date limit.
3. Expenses use expense categories; income uses an income category, or an expense category as a refund (which lowers Spent); transfers have no category.
4. Accounts and categories must belong to the current user and be active when used for a new transaction. Preserve history for archived records.
5. Account balances and budget usage are computed by queries; do not persist derived balances or totals as source-of-truth values.
6. Balance = initial balance + income − expenses − transfers out + transfers in. Transfers affect both accounts but are excluded from income, spending, budgets, category charts, and reports.
7. Net worth sums non-archived account balances in the same currency. MVP currency is PLN only; do not invent multi-currency conversion.
8. A deleted imported transaction writes its `(AccountId, ExternalHash)` tombstone. Re-import must not restore it.
9. Add the planned indexes and uniqueness constraints, including `(UserId, Date)`, unique `(AccountId, ExternalHash)`, unique budget `(UserId, CategoryId, Month)`, and unique alert `(UserId, CategoryId, Month, Level)`.
10. Category merge must move relevant transactions, budgets, and rules according to `FEATURES.md`, then archive the source category. Preserve the special behavior of the non-hideable/non-mergeable “Other” category (`SystemKey = other`). Identify default categories by `SystemKey`, never by name.

## Planned REST endpoints

Maintain the public route and behavior contract in `PLAN.md`:

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout` |
| Me | `GET /api/me`, `POST /api/me/onboarding/complete` |
| Accounts | `GET/POST /api/accounts`, `PUT/DELETE /api/accounts/{id}`; `DELETE` archives rather than hard-deletes; `POST /api/accounts/{id}/restore` |
| Categories | `GET/POST /api/categories`, `PUT/DELETE /api/categories/{id}` (delete only custom categories without transactions), `POST /api/categories/{id}/archive`, `POST /api/categories/{id}/restore`, `POST /api/categories/{id}/merge`, `GET /api/categories/top?limit=8` |
| Transactions | `GET/POST /api/transactions`, `PUT/DELETE /api/transactions/{id}`, `POST /api/transactions/bulk`, `GET /api/transactions/merchants?q=` |
| Transfers | `POST /api/transfers`, `PUT/DELETE /api/transfers/{transferPairId}` |
| Budgets | `GET /api/budgets?month=YYYY-MM`, `PUT /api/budgets/{categoryId}?month=YYYY-MM`, `POST /api/budgets/copy?from=YYYY-MM&to=YYYY-MM` |
| Dashboard | `GET /api/dashboard?month=YYYY-MM` |
| Rules | `GET/POST /api/rules`, `PUT/DELETE /api/rules/{id}` |
| Imports | `POST /api/imports`, `GET /api/imports`, `GET /api/imports/{id}` |
| Alerts | `GET /api/alerts`, `POST /api/alerts/{id}/read` |

The transaction list query supports the planned parameters: `from`, `to`, `accountId`, `categoryId`, `type`, `minAmount`, `maxAmount`, `q`, `page`, `pageSize`, and `sort`. Preserve the existing spelling and semantics when implementing it.

## Feature-specific business rules

### Accounts

- Account name is required, max 50 characters, and unique per user among non-archived accounts.
- Only PLN is supported in the MVP.
- Archive rather than delete. Archived accounts disappear from active pickers and net-worth totals, but transactions remain visible in history with archived context. They can be restored.
- A user cannot archive the last active account.
- Editing starting balance intentionally affects every computed balance; never cache account balance as authoritative data.

### Transactions and transfers

- A manual transaction's amount/type/category/account/date constraints must be validated in the application layer.
- Permit editing and deleting transactions. When deleting imported transactions, preserve the external hash in the tombstone table.
- Bulk delete and recategorization must be scoped to the current user and should be atomic when practical. Any destructive action must be explicit and accurately report its result.
- A transfer creates two transaction rows with the same `TransferPairId` in one database transaction. The source row has `TransferDirection = Out`, the destination row `In`; reject same-account transfers. Editing or deleting one side must consistently update the pair.
- When matching imported transfers is implemented, use the specified account/amount/date matching behavior; do not count the pair as spending or income.

### Categories and budgets

- Seed the default categories specified in `PLAN.md` for each new user at registration (same database transaction as user creation), each with its `SystemKey`: expense categories `Groceries`, `Eating out`, `Transport`, `Housing`, `Utilities`, `Health`, `Shopping`, `Entertainment`, `Subscriptions`, `Other`; income categories `Salary`, `Other income`.
- User category name is unique per user and transaction type; max 30 characters. Icon and color must come from the allowed fixed sets described in `FEATURES.md`.
- Default categories can be renamed and hidden (archived), never deleted. Hiding preserves history. A custom category with transactions must be archived or merged rather than hard-deleted; one without transactions may be deleted.
- One budget limit per category per calendar month. Copy-from-month copies all limits from source to destination month.
- Budget spent = expense transactions in the category/month minus refunds represented as income in an expense category. Displayed spent cannot go below zero.
- Status thresholds: `OK` below 80%; `Warning` at 80% and below 100%; `Over` at or above 100%. Preserve boundary behavior at 79.99%, 80%, 99.99%, and 100%.
- Remaining = limit − spent. Unbudgeted spending is spending in expense categories with no budget for that month.
- Phase 1 needs only `PUT /api/budgets/{categoryId}` (used by onboarding); the rest of budgets arrives in Phase 2.
- Daily allowance is `max(total budget remaining, 0) / days left in month` (days left include today), shown only for the current month. Total remaining = Σ(limit − spent) over budgeted categories; over-budget categories count as negative (e.g. +100 zł and −50 zł → 50 zł). Do not show a negative daily amount or show this metric for past/future months.
- Past-month budgets remain editable, with the deliberate-edit hint represented by the client. Future months show budgets but no spending yet.

### Dashboard and alerts

- `GET /api/dashboard?month=YYYY-MM` returns all data required by the dashboard in one response: left-to-spend/spent summary as appropriate for the selected month, income, net worth, budgets, category spending, last six months of spending, last five transactions, and unread alerts.
- Transfers are excluded from spending summaries, budget usage, and charts.
- For a future month, show budgets only/no spending. For a past month, show actual spending versus budget and no daily allowance. Handle a user with no transactions or budgets without returning misleading values.
- Recompute affected budget statuses after any expense add/edit/delete, import, or recategorization.
- Create alerts only when a category crosses a threshold upward. Create at most one `Warning` and one `Over` alert per category/month. Do not emit repeated alerts just because later writes leave the category beyond the same threshold.
- Do not create alerts for imported data belonging to past months. If a single import moves multiple categories across thresholds, create the appropriate per-category alerts.

### CSV import and categorization (Phase 4)

- Import protocol: `POST /api/imports` validates account and bank format, creates a `Pending` `ImportBatch`, and returns the batch ID plus a pre-signed S3 PUT URL. The browser uploads directly to S3 using the planned key shape `imports/{userId}/{batchId}.csv`.
- S3 object creation triggers the Lambda. Update the batch through `Processing` to `Done` or `Failed`; the client polls `GET /api/imports/{id}` for status and counts.
- Support mBank, PKO BP, ING, and Revolut using separate `IBankCsvParser` implementations and anonymized fixtures. Handle UTF-8 and Windows-1250, comma/semicolon separators, and Polish decimal commas.
- Accept `.csv` only, max 5 MB. Detect the wrong bank format before writing transactions; reject the batch cleanly if expected columns are missing. Skip bank-marked pending/card-hold rows.
- Normalize descriptions before hashing/categorization. External hash is SHA-256 over account ID, date, amount, normalized description, and occurrence index for identical rows on the same day. This index preserves two genuinely identical same-day purchases while preventing the same statement row from being duplicated on retry.
- Check both existing transactions and `DeletedImportHash` before inserting. Database uniqueness constraints must protect against concurrent duplicate attempts; application-level checks alone are insufficient.
- Run a batch insert in one database transaction. If any processing/insertion step fails, save no imported transactions, mark the batch failed with a safe useful message, and make retrying safe. Never report partial success for an all-or-nothing batch.
- Apply categorization in this order: user rules by priority, built-in Polish merchant rules, then `Other`. Rule matching is case- and accent-insensitive. Share rule normalization/matching logic rather than maintaining separate algorithms in the API and Lambda.
- Built-in contains rules: `ŻABKA`/`ZABKA`, `BIEDRONKA`, `LIDL`, `KAUFLAND`, `CARREFOUR`, `AUCHAN` → `Groceries`; `UBER`, `BOLT`, `JAKDOJADE`, `ZTM`, `PKP`, `ORLEN`, `BP` → `Transport`; `NETFLIX`, `SPOTIFY`, `YOUTUBE`, `APPLE.COM`, `GOOGLE` → `Subscriptions`; `PYSZNE`, `GLOVO`, `WOLT`, `MCDONALD` → `Eating out`.
- Deleting successfully processed CSV files from S3 is required; configure an S3 lifecycle rule so files cannot be retained longer than seven days. Do not store bank login credentials.
- Keep the CSV import history and status/counts available through the API. Do not add “undo import” in MVP; it is post-MVP in `FEATURES.md`.
- Rules apply to new imports unless the user explicitly invokes an apply-to-existing operation. When the learning flow creates a rule, normalize the merchant pattern and keep rule CRUD behavior consistent with `FEATURES.md`.

## AWS scalability and operational requirements

- Keep the API stateless so multiple Elastic Beanstalk instances can serve requests. Do not depend on process-local state, local disk persistence, or sticky sessions for correctness.
- Run the API on Elastic Beanstalk and PostgreSQL on Amazon RDS (smallest instance; this is a low-cost portfolio project). Configure the Npgsql EF Core provider and PostgreSQL-compatible schema, migrations, indexes, and queries. Store configuration/secrets outside source control using Secrets Manager and/or Parameter Store.
- Store uploaded CSV files in S3 and process them asynchronously with the S3-triggered .NET Lambda. Do not parse large CSVs inside the request thread or hold an HTTP request open until processing completes.
- Use pre-signed S3 uploads so the API does not proxy the CSV payload. Validate user/account/batch ownership before issuing a URL. Keep S3 objects private and limit the key prefix and permissions available to each component.
- Make Lambda processing idempotent and safe under retries and duplicate S3 notifications. Use batch status transitions, unique database constraints, hashes/tombstones, and a single transaction for transaction insertion.
- Be mindful of PostgreSQL connection limits (`max_connections` is low on small RDS instances) and RDS capacity as API instance count and Lambda concurrency grow. Ensure connections are short-lived/pooled appropriately and avoid unbounded parallel writes. Do not introduce RDS Proxy, SQS, or another infrastructure component without approval; first meet the behavior using the approved plan.
- Use CloudWatch-compatible structured logs and metrics. Include correlation IDs, batch IDs, durations, and counts where useful, but do not log tokens, secrets, or sensitive transaction data.
- Configure health checks, graceful cancellation/shutdown, timeouts, and safe error handling appropriate to the host. Do not return success to the client before a required database operation has committed.
- Keep AWS SDK configuration environment-driven and use the execution role in AWS rather than static access keys. Local development may use LocalStack/configured local credentials.
- Configure an AWS Budget alert early in deployment (the plan specifies a $5–10 alert). Avoid deploying costly managed services or provisioning resources outside the plan.
- Use the backend GitHub Actions workflow (root `.github/workflows/`, path filter `finance-tracker-api/**`) to build and test backend projects on pull requests and deploy backend components on pushes to `main` that change the backend. Never deploy code that has failed required checks.
- The frontend workflow (path filter `finance-tracker-web/**`) owns Angular builds and deployment to S3 + CloudFront. Do not add frontend code to the backend folder or mix frontend steps into the backend workflow, move backend endpoints into CloudFront functions, or mix hosting concerns into the domain/application layers.

## Performance expectations

- Dashboard target: under one second for a user with 5,000 transactions. Profile before introducing caching; use efficient aggregate queries, appropriate indexes, and projections.
- Transaction search target: under 300 ms for normal expected workloads. Apply user/date filters and pagination in PostgreSQL, and use indexes that support the actual query shape.
- Avoid N+1 queries, unnecessary eager-loading of large collections, client-side aggregation of all transactions, and serial database calls that can be performed in one efficient query.
- Use projections for dashboard/list DTOs. Fetch only needed columns and rows. Ensure aggregate calculations stay correct for refunds, transfers, archived accounts, and user scoping.
- Do not add caching of financial balances or budget totals as a shortcut; those values are computed from source records. If performance does not meet targets, inspect query plans and measure before proposing a design change.

## Testing requirements

- **No unit tests for now.** Do not create a unit-test project or add unit tests unless the project owner asks. Business-rule tests are deferred and, when added later, will be integration-level.
- Required now: integration tests in `FinanceTracker.IntegrationTests` for user isolation — explicitly test that user A receives `404` when trying to read, modify, archive, merge, or delete user B's resources. Add integration tests for other endpoints when they protect something important (auth flow, atomic multi-row operations), but they are not a gate for each task.
- Use Testcontainers with PostgreSQL. Do not use EF Core InMemory or SQLite as a substitute; they don't reproduce PostgreSQL behavior, extensions (`unaccent`, `pg_trgm`), migrations, and constraints.
- Use `WebApplicationFactory` for HTTP-level API tests. Replace `TimeProvider` with a fake in tests so "today" is deterministic.
- Keep parsers and batch processing independently runnable without AWS so they can be tested later.
- Use test naming convention `[Method]_[Scenario]_[ExpectedResult]`.
- Use AwesomeAssertions for assertions. Tests must be deterministic and must not depend on real bank accounts, real user data, or production AWS resources.

## Configuration, migrations, and developer workflow

- Keep environment-specific configuration outside committed source files. Include safe local defaults only for non-secret development settings.
- Store EF Core entity configuration separately where it improves clarity. Keep database schema changes in checked-in migrations.
- Before changing entity relationships, constraints, money precision, transaction hash logic, or API DTO contracts, check the plan and affected tests first.
- Use these commands when relevant:

```bash
dotnet restore FinanceTracker.slnx
dotnet build FinanceTracker.slnx
dotnet test FinanceTracker.slnx
dotnet run --project src/FinanceTracker.Api
dotnet ef migrations add <Name> -p src/FinanceTracker.Infrastructure -s src/FinanceTracker.Api
dotnet ef database update -p src/FinanceTracker.Infrastructure -s src/FinanceTracker.Api
dotnet format FinanceTracker.slnx
```

- Keep `FinanceTracker.slnx` as the single solution file for all backend projects and tests. Add/remove projects from this solution when the backend structure changes.
- Keep `docker-compose.yml` usable for local API/PostgreSQL development. Add LocalStack configuration when implementing the import phase.
- Update README documentation when project setup, API behavior, environment variables, migrations, architecture, or deployment behavior changes. The README must eventually include an architecture diagram and demo instructions.
- Keep demo data anonymized and realistic for Poland, including PLN transactions and the planned merchants. Demo account reset behavior must follow `FEATURES.md`; never seed demo credentials into production configuration.

## Patterns to avoid

- No business logic in controllers or AWS Lambda entry-point methods.
- No forced generic repository or generic unit-of-work framework. Use focused repositories when justified by the use case; otherwise use EF Core directly through the approved application boundary.
- No AutoMapper or new mediator package unless explicitly approved.
- No `double`/`float` for monetary values.
- No stored procedures for logic that belongs in the application/domain layers.
- No per-user data access without current-user scoping.
- No hard deletes of archived accounts/categories with history where the specification requires preserving history.
- No synchronous I/O for network/database operations, fire-and-forget work that can lose failures, or unbounded parallel processing.
- No in-memory-only locks or deduplication mechanisms for correctness in a horizontally scaled API/Lambda environment.
- No silent partial CSV import, duplicate transaction creation, swallowed exceptions, or broad catch blocks that hide failure.
- No secrets or sensitive financial details in logs, source control, API errors, or telemetry.
- No speculative post-MVP features or new AWS services without approval.

## Definition of done

A backend task is complete only when:

1. Behavior matches both source files, including edge cases and error behavior.
2. User-isolation integration tests exist for any new user-owned endpoints and pass (no unit tests required for now).
3. User isolation and authorization have been tested where applicable.
4. Financial calculations remain correct for transfers, refunds, archived entities, and date/month boundaries.
5. The solution builds and the relevant test suite passes; any command that could not be run is stated plainly.
6. Logging and API errors are useful for support without exposing sensitive data.
7. Configuration, migrations, and docs are updated when needed.
8. No unrelated stack, schema, endpoint, or scope changes are bundled into the task.

## Expected response after implementation work

When you finish a coding task, report briefly:

- what was implemented;
- the key files/projects changed;
- tests/build/format commands run and their results;
- migrations or configuration needed to run it;
- any unresolved requirement, assumption, blocker, or follow-up.

Do not claim tests pass unless you actually ran them successfully. Do not leave stubs or TODOs for required behavior without explicitly identifying them.
