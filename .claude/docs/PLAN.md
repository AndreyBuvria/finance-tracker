# Finance Tracker — Implementation Plan

> Instructions for Claude Code: work through the phases **in order**. Finish one task fully (code + required tests passing) before starting the next. Tick checkboxes as you go. Each phase ends with a working, demo-able app. Ask before changing the tech stack or the data model.
>
> **Read `FEATURES.md` before starting each feature.** It describes the user-facing behavior, UI text, empty states and edge cases. A task is only done when it matches both files.

## 1. Product summary

A personal finance tracker that answers: **"How much can I still spend this month, and where is my money going?"**

Users record spending (manually or by importing a bank CSV), categorize it, set a monthly limit per category, and see on one dashboard how close they are to each limit. Default currency: PLN.

**Not in scope:** Google Pay / Apple Pay integration (no public transaction-history API exists; phone payments appear on the bank statement and are covered by CSV import), mobile app, investments, receipt OCR.

## 2. Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Angular (latest, standalone components, signals), Angular Material, Chart.js (ng2-charts), Reactive Forms |
| Backend | ASP.NET Core Web API (.NET 10 LTS), EF Core + Npgsql, FluentValidation, ASP.NET Core Identity + JWT, `TimeProvider` for current time |
| Database | PostgreSQL (`unaccent` + `pg_trgm` extensions for search) |
| Import worker | AWS Lambda (.NET), triggered by S3 |
| Local dev | Docker Compose (API, Postgres, LocalStack for S3), `dotnet run` / `ng serve` |
| Tests | Backend: integration tests only (xUnit, AwesomeAssertions, Testcontainers Postgres, `WebApplicationFactory`); no .NET unit tests for now. Frontend: Vitest |
| Cloud | S3 + CloudFront (frontend), Elastic Beanstalk (API), RDS PostgreSQL, S3, Lambda, Secrets Manager, CloudWatch |
| CI/CD | GitHub Actions in the single repo; separate API and web workflows with path filters |

## 3. Repository structure

One git repository (monorepo) with the backend and frontend in separate top-level folders. `PLAN.md`, `FEATURES.md` and `DESIGN.md` live in `.claude/docs/` and are the shared source of truth.

```
/                                  # repo root
  README.md
  /.claude
    CLAUDE.md                      # project instructions
    /docs                          # PLAN.md, FEATURES.md, DESIGN.md
    /agents                        # development and review agents
  /.github/workflows               # api.yml (paths: finance-tracker-api/**), web.yml (paths: finance-tracker-web/**)
  /finance-tracker-api             # backend — rules in its CLAUDE.md
    FinanceTracker.slnx
    /src
      /FinanceTracker.Api            # controllers, auth, DI, middleware
      /FinanceTracker.Application    # services, business rules, DTOs, validators
      /FinanceTracker.Domain         # entities, enums, domain logic (no dependencies)
      /FinanceTracker.Infrastructure # EF Core DbContext, migrations, S3 client, repositories
      /FinanceTracker.ImportLambda   # S3-triggered CSV import function
      /FinanceTracker.Csv            # bank CSV parsers + categorization (shared by API and Lambda)
    /tests
      /FinanceTracker.IntegrationTests
      /samples                       # anonymized bank CSV files
    docker-compose.yml
    README.md                        # backend setup and run instructions
  /finance-tracker-web             # frontend (Angular) — rules in its CLAUDE.md
    /src/app
      /common                      # shared non-UI code: services, API clients, models, pipes, locale/time
      /infrastructure              # shared UI building blocks: layout, cards, empty states
      /pages/<page>                # one folder per page; its feature-specific components live inside
```

Infrastructure as code (post-MVP) goes in an `/infra` folder in the same repo.

## 4. Conventions

- Money is `decimal(18,2)` (`numeric(18,2)` in Postgres); amounts are **always positive**, `Type` decides the sign. Never use `double`.
- Every user-owned entity has `UserId`; every query filters by the current user. Access to another user's row returns **404**, never 403.
- Errors are RFC 7807 `ProblemDetails`. Validation via FluentValidation.
- Dates: store `Date` as `DateOnly`; timestamps as UTC `DateTimeOffset`. Current time comes from `TimeProvider` (backend) / a clock service (frontend), never `DateTime.Now` / `new Date()` directly.
- Account balances and budget usage are **computed by query, never stored**.
- Business rules live in `Application`/`Domain`, not in controllers.
- Backend tests: integration tests for endpoints and user isolation. Business-rule tests are deferred (may be added later as integration tests).

## 5. Data model

| Entity | Fields | Constraints |
| --- | --- | --- |
| User | Id, Email, PasswordHash, DisplayName, DefaultCurrency, CreatedAt, OnboardingCompletedAt? | Identity |
| RefreshToken | Id, UserId, TokenHash, CreatedAt, ExpiresAt, RevokedAt?, ReplacedByTokenId? | Unique (TokenHash). Rotated on every refresh; reuse of a revoked token revokes the whole chain |
| Account | Id, UserId, Name, Type (Card/Savings/Cash), Currency, InitialBalance, IsArchived | Unique (UserId, Name) among non-archived |
| Category | Id, UserId, Name, Type (Expense/Income), Icon, Color, SystemKey?, IsArchived | Defaults are **copied to each user on registration**; `SystemKey` (e.g. `groceries`, `other`) marks a default and survives renames. Unique (UserId, Type, Name) |
| Transaction | Id, UserId, AccountId, CategoryId?, Type (Expense/Income/Transfer), TransferDirection? (Out/In), Amount, Date, Merchant, Note, Source (Manual/Csv/OpenBanking), ExternalHash?, ImportBatchId?, TransferPairId? | Index (UserId, Date); unique (AccountId, ExternalHash); `TransferDirection` set only for transfers |
| Budget | Id, UserId, CategoryId, Month (first day of month), LimitAmount | Unique (UserId, CategoryId, Month) |
| CategoryRule | Id, UserId, Pattern, MatchType (Contains/StartsWith), CategoryId, Priority | |
| ImportBatch | Id, UserId, AccountId, FileKey, BankFormat, Status (Pending/Processing/Done/Failed), RowsTotal, RowsImported, RowsSkipped, Error, CreatedAt | |
| DeletedImportHash | AccountId, ExternalHash | Tombstone so re-import doesn't restore deleted rows |
| Alert | Id, UserId, CategoryId, Month, Level (Warning/Over), CreatedAt, ReadAt? | Unique (UserId, CategoryId, Month, Level) |

**Seeded default categories** (per user, with `SystemKey`) — Expense: Groceries, Eating out, Transport, Housing, Utilities, Health, Shopping, Entertainment, Subscriptions, Other. Income: Salary, Other income.

## 6. Business rules

### Transactions
- Amount > 0, max 2 decimals.
- Date ≤ today + 1 day.
- Expense → expense category; Income → income category; Transfer → no category.
- Account and category must belong to the user and not be archived.
- Deleting an imported transaction writes its hash to `DeletedImportHash`.

### Transfers
- `POST /transfers` creates two rows with the same `TransferPairId` in one DB transaction: `TransferDirection = Out` on account A, `In` on account B. From ≠ To. Editing/deleting one affects both.
- Transfers affect balances but are **excluded** from income, spending, budgets and charts.

### Balances
- Balance = InitialBalance + income − expenses − transfers out + transfers in.
- Net worth = sum of non-archived account balances (same currency only).

### Categories
- System defaults (`SystemKey` set) can be renamed and hidden (archived), not deleted.
- A custom category with transactions can only be archived or merged; without transactions it can be deleted.
- Merge moves transactions, budgets (limits summed for the same month) and rules, then archives the source.
- "Other" (`SystemKey = other`) can't be hidden or merged.

### Budgets
- One limit per category per month. "Copy from last month" copies all limits.
- Spent = expenses in category within calendar month − refunds (income in that expense category). Displayed Spent ≥ 0.
- Remaining = Limit − Spent; Usage = Spent / Limit.
- Status: **OK** < 80%, **Warning** 80–99.99%, **Over** ≥ 100%.
- Daily allowance = max(total Remaining, 0) / days left in month (including today), current month only. Total Remaining = Σ (Limit − Spent) over budgeted categories, where over-budget categories contribute a **negative** value (e.g. Groceries +100 zł, Eating out −50 zł → 50 zł).
- Spending in categories without a budget = "Unbudgeted".

### Alerts
- After creating/updating/importing expenses, recompute affected categories. Create an `Alert` only when status crosses a threshold; at most one per (category, month, level).

### CSV import
1. `POST /imports` with accountId + bankFormat → creates `ImportBatch` (Pending), returns pre-signed S3 PUT URL + batchId.
2. Browser uploads directly to S3 (`imports/{userId}/{batchId}.csv`).
3. S3 event triggers Lambda → batch Processing.
4. Parse with the bank's mapping (handle Windows-1250 and UTF-8, `;` and `,` separators, Polish decimal comma).
5. `ExternalHash` = SHA-256(AccountId + Date + Amount + normalized description + occurrence index of identical rows that day). Skip if it exists in Transactions or `DeletedImportHash`.
6. Categorize: user `CategoryRules` by Priority → built-in rules → "Other".
7. Insert all rows in **one DB transaction**. On error: batch Failed + message, nothing saved (retry is safe).
8. Batch Done with RowsTotal / RowsImported / RowsSkipped. Frontend polls `GET /imports/{id}`.

Built-in rules (case-insensitive contains, target categories resolved by `SystemKey`): ŻABKA/ZABKA, BIEDRONKA, LIDL, KAUFLAND, CARREFOUR, AUCHAN → Groceries; UBER, BOLT, JAKDOJADE, ZTM, PKP, ORLEN, BP → Transport; NETFLIX, SPOTIFY, YOUTUBE, APPLE.COM, GOOGLE → Subscriptions; PYSZNE, GLOVO, WOLT, MCDONALD → Eating out.

Supported formats in MVP: mBank, PKO BP, ING, Revolut. Each parser = one class implementing `IBankCsvParser`; an anonymized sample file per bank lives in `/tests/samples`.

**Learning rule:** when a user recategorizes an imported transaction, the UI offers "Always put {Merchant} in {Category}?" → `POST /rules`.

### Source abstraction
All transaction sources implement `ITransactionSource` (Manual, CsvImport, later OpenBanking) so adding open banking later doesn't change business logic.

## 7. API

All under `/api`, JWT required except register/login/refresh.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` (revokes refresh token) |
| Me | `GET /me`, `POST /me/onboarding/complete` |
| Accounts | `GET/POST /accounts`, `PUT/DELETE /accounts/{id}` (delete = archive), `POST /accounts/{id}/restore` |
| Categories | `GET/POST /categories`, `PUT/DELETE /categories/{id}` (delete only custom without transactions), `POST /categories/{id}/archive`, `POST /categories/{id}/restore`, `POST /categories/{id}/merge`, `GET /categories/top?limit=8` (most used, last 90 days) |
| Transactions | `GET /transactions?from&to&accountId&categoryId&type&minAmount&maxAmount&q&page&pageSize&sort` (+ footer totals), `POST /transactions`, `PUT/DELETE /transactions/{id}`, `POST /transactions/bulk` (recategorize/delete), `GET /transactions/merchants?q=` (autocomplete + last-used category) |
| Transfers | `POST /transfers`, `PUT/DELETE /transfers/{transferPairId}` |
| Budgets | `GET /budgets?month=YYYY-MM`, `PUT /budgets/{categoryId}?month=YYYY-MM`, `POST /budgets/copy?from=YYYY-MM&to=YYYY-MM` |
| Dashboard | `GET /dashboard?month=YYYY-MM` → cards, budget bars, spending by category, last 6 months, last 5 transactions, unread alerts |
| Rules | `GET/POST /rules`, `PUT/DELETE /rules/{id}` |
| Imports | `POST /imports`, `GET /imports`, `GET /imports/{id}` |
| Alerts | `GET /alerts`, `POST /alerts/{id}/read` |

## 8. Screens (Angular)

1. **Dashboard** — month selector; cards: Left to spend (+ daily allowance), Spent this month (± % vs last month), Income, Net worth; budget progress bars sorted by usage, colored by status; donut by category; bar chart last 6 months; last 5 transactions; alerts banner; Quick add button.
2. **Transactions** — table: Date, Merchant/note, Category (inline edit), Account, Amount (red/green), Source badge. Filters in URL query params, server-side paging (50) and sorting, bulk actions, footer totals. Quick-add dialog: amount focused first, last-used account preselected.
3. **Budgets** — Category, Limit (inline edit), Spent, Remaining, Usage bar, Status; Copy from last month; Unbudgeted row; row click → filtered Transactions.
4. **Accounts** — cards with balances; add/edit/archive/restore; Import CSV per account; import history.
5. **Settings** — categories (add/rename/hide/archive/merge) and rules.
6. **Auth** — login, register; JWT interceptor; route guards.

## 9. Phases and tasks

### Phase 1 — Core app, running locally
**Done when:** a user can register, log in, finish onboarding, add/edit/filter transactions, all via Docker Compose.

Backend (`finance-tracker-api`):
- [x] Solution + project structure from §3; Docker Compose with Postgres
- [ ] Domain entities + EF Core configuration + initial migration (incl. `unaccent`, `pg_trgm`)
- [ ] Identity + JWT auth (register, login, refresh with rotation, logout); per-user default categories seeded on registration; `GET /me`, onboarding complete
- [ ] Accounts CRUD + archive/restore + computed balances
- [ ] Categories CRUD (hide/archive, restore, delete, merge, top used)
- [ ] Transactions CRUD with filters, paging, sorting, totals, merchant autocomplete; transfers (create/edit/delete pair)
- [ ] Minimal budgets: `PUT /budgets/{categoryId}` (needed by onboarding step 2)
- [ ] Integration tests (Testcontainers): user isolation — user A gets 404 on user B's data

Frontend (`finance-tracker-web`):
- [ ] Angular: auth pages, layout, Accounts, Transactions table, Quick-add dialog (FEATURES.md F3)
- [ ] Onboarding flow, 3 steps (FEATURES.md F1); CSV import option shown as "Coming soon" until Phase 4

### Phase 2 — Budgets and dashboard
**Done when:** the dashboard shows "left to spend" and budget status per category.

- [ ] Budgets endpoints: list with calculations, copy from last month
- [ ] Budget calculation service (spent, refunds, remaining, status, daily allowance, unbudgeted)
- [ ] Alerts on threshold crossing
- [ ] Dashboard endpoint (single call)
- [ ] Angular: Dashboard with charts, Budgets table, alerts banner

### Phase 3 — Deploy to AWS
**Done when:** the app is live on a public URL and each half deploys on every push to `main` that changes it.

- [ ] AWS Budgets alert at $5–10 (do first)
- [ ] RDS PostgreSQL (smallest instance), credentials in Secrets Manager
- [ ] API on Elastic Beanstalk; config from Secrets Manager / Parameter Store
- [ ] Angular on S3 + CloudFront with HTTPS; CORS configured
- [ ] CloudWatch logs (structured logging with Serilog)
- [ ] GitHub Actions with path filters: build + test on PR; deploy on `main` (`finance-tracker-api/**` → Beanstalk + Lambda; `finance-tracker-web/**` → S3 + CloudFront invalidation)

### Phase 4 — CSV import pipeline
**Done when:** a real bank CSV imports correctly, and importing the same file twice adds 0 rows.

- [ ] `FinanceTracker.Csv`: `IBankCsvParser` + mBank, PKO BP, ING, Revolut parsers with anonymized sample files
- [ ] Hashing + dedup (incl. tombstones); categorization engine (user rules → built-in → Other)
- [ ] `POST /imports` with pre-signed S3 URL; ImportBatch status endpoints
- [ ] Lambda function (S3 trigger), all-or-nothing insert, batch status updates
- [ ] LocalStack for local testing of the S3 → Lambda flow
- [ ] Rules CRUD + "Always put X in Y?" learning prompt
- [ ] Angular: import dialog (account, bank, file), progress polling, result summary, import history
- [ ] Settings: export my data (CSV), delete my account (FEATURES.md §3)
- [ ] "Try with demo data" seeded account, reset nightly (FEATURES.md §4)
- [ ] Root README: architecture diagram + screenshots

**— MVP complete —**

### Phase 2+ (after MVP)
- [ ] Monthly email report: EventBridge schedule → Lambda → SES
- [ ] Open banking sync via Enable Banking (link your own account) as an `ITransactionSource`
- [ ] Recurring transactions
- [ ] Infrastructure as code (AWS CDK in C#, `/infra` folder)
- [ ] Backend business-rule tests (integration level)
- [ ] Later: multi-currency with NBP exchange rates, shared budgets, savings goals
