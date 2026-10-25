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
      /common                      # shared code by domain: services, API clients, models, pipes, locale/time, date (e.g. month-select)
      /infrastructure              # shared UI building blocks: layout (+ header-actions service), cards, empty states
      /pages/<page>                # one folder per page; its feature-specific components live inside (e.g. transactions' quick-add dialog)
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
| User | Id, Email, PasswordHash, DisplayName, DefaultCurrency, CreatedAt, OnboardingCompletedAt? | Identity. UserName = Email; email unique (`RequireUniqueEmail`), so concurrent duplicate registrations fail (409) |
| RefreshToken | Id, UserId, TokenHash, CreatedAt, ExpiresAt, RevokedAt?, ReplacedByTokenId? | Unique (TokenHash). Rotated on every refresh; reuse of a revoked token revokes the whole chain, except within the ~10 s grace window (see §7 Auth contract) |
| Account | Id, UserId, Name, Type (Card/Savings/Cash), Currency, InitialBalance, IsArchived | Unique (UserId, Name) among non-archived, case-insensitive |
| Category | Id, UserId, Name, Type (Expense/Income), Icon (Material Symbols Rounded name from the fixed set), Color (hex `#RRGGBB` from the fixed 12-color palette), SystemKey? (snake_case, e.g. `eating_out`), IsArchived | Defaults are **copied to each user on registration**; `SystemKey` (e.g. `groceries`, `other`) marks a default and survives renames. Unique (UserId, Type, Name) among non-archived, case-insensitive |
| Transaction | Id, UserId, AccountId, CategoryId?, Type (Expense/Income/Transfer), TransferDirection? (Out/In), Amount, Date, Merchant, Note, Source (Manual/Csv/OpenBanking), ExternalHash?, ImportBatchId?, TransferPairId? | Index (UserId, Date); unique (AccountId, ExternalHash); `TransferDirection` set only for transfers; `CategoryId` required for Expense/Income, null for Transfer |
| Budget | Id, UserId, CategoryId, Month (first day of month), LimitAmount | Unique (UserId, CategoryId, Month) |
| CategoryRule | Id, UserId, Pattern, MatchType (Contains/StartsWith), CategoryId, Priority | |
| ImportBatch | Id, UserId, AccountId, FileKey, OriginalFileName (added in Phase 4, shown in import history), BankFormat, Status (Pending/Processing/Done/Failed), RowsTotal, RowsImported, RowsSkipped, Error, CreatedAt | |
| DeletedImportHash | AccountId, ExternalHash | Tombstone so re-import doesn't restore deleted rows |
| Alert | Id, UserId, CategoryId, Month, Level (Warning/Over), CreatedAt, ReadAt? | Unique (UserId, CategoryId, Month, Level) |

**Category colors** (fixed palette, stored as hex): `#c62828` red, `#ad1457` pink, `#7b1fa2` purple, `#3949ab` indigo, `#1565c0` blue, `#00838f` cyan, `#2e7d32` green, `#c0ca33` lime, `#fbc02d` yellow, `#ef6c00` orange, `#6d4c41` brown, `#546e7a` blue grey.

**Category icons** (fixed set, Material Symbols Rounded names): shopping_cart, restaurant, local_cafe, local_bar, bakery_dining, directions_bus, directions_car, local_taxi, train, local_gas_station, flight, home, bolt, water_drop, wifi, smartphone, build, medical_services, medication, fitness_center, spa, shopping_bag, checkroom, devices, card_giftcard, movie, sports_esports, music_note, subscriptions, beach_access, celebration, school, menu_book, child_care, pets, volunteer_activism, payments, work, savings, category.

The frontend copies are `finance-tracker-web/src/styles/category-palette.constants.ts` and `category-icons.constants.ts`; keep both sides in sync.

**Seeded default categories** (per user, with `SystemKey`). The backend owns this list; the frontend never hard-codes it and reads categories (with icon and color) from `GET /categories`.

| SystemKey | Name | Type | Icon | Color |
| --- | --- | --- | --- | --- |
| `groceries` | Groceries | Expense | shopping_cart | `#2e7d32` |
| `eating_out` | Eating out | Expense | restaurant | `#ef6c00` |
| `transport` | Transport | Expense | directions_bus | `#1565c0` |
| `housing` | Housing | Expense | home | `#6d4c41` |
| `utilities` | Utilities | Expense | bolt | `#fbc02d` |
| `health` | Health | Expense | medical_services | `#c62828` |
| `shopping` | Shopping | Expense | shopping_bag | `#ad1457` |
| `entertainment` | Entertainment | Expense | movie | `#7b1fa2` |
| `subscriptions` | Subscriptions | Expense | subscriptions | `#3949ab` |
| `other` | Other | Expense | category | `#546e7a` |
| `salary` | Salary | Income | payments | `#00838f` |
| `other_income` | Other income | Income | savings | `#c0ca33` |

## 6. Business rules

### Transactions
- Amount > 0, max 2 decimals.
- Date ≤ today + 1 day.
- Expense → expense category; Income → income or expense category (income in an expense category is a **refund**: it lowers Spent); Transfer → no category.
- Account and category must belong to the user. Newly chosen ones must be active; an archived account or category a transaction already uses may stay when the transaction is edited.
- Deleting an imported transaction writes its hash to `DeletedImportHash`.

### Transfers
- `POST /transfers` creates two rows with the same `TransferPairId` in one DB transaction: `TransferDirection = Out` on account A, `In` on account B. From ≠ To. Editing/deleting one affects both: `DELETE /transactions/{id}` and bulk delete on a transfer row remove the whole pair; editing goes through `PUT /transfers/{transferPairId}`.
- Transfers affect balances but are **excluded** from income, spending, budgets and charts.

### Balances
- Balance = InitialBalance + income − expenses − transfers out + transfers in.
- Net worth = sum of non-archived account balances (same currency only).

### Categories
- System defaults (`SystemKey` set) can be renamed and hidden (archived), not deleted.
- A custom category with transactions can only be archived or merged; without transactions it can be deleted. Deleting it also deletes its budgets, rules and alerts.
- Merge moves transactions, budgets (limits summed for the same month) and rules, then archives the source.
- "Other" (`other`) and "Other income" (`other_income`) are the fallbacks: they can't be hidden, merged or deleted (`isProtected`).
- Type can change only for a custom category with no transactions, budgets or rules; a default's type never changes.
- Merge deletes the source's alerts (they describe the old category); the target's status is recalculated once alert logic exists (Phase 2). An archived source can be merged; a fallback can be a merge target.
- Hidden (archived) categories keep their budgets, but those budgets are excluded from the Budgets table, Total and daily allowance.
- Built-in import rules whose target category is hidden or merged away fall back to "Other" / "Other income".

### Dates
- "Today" is the Europe/Warsaw calendar date (from `TimeProvider`), for date validation, the 90-day top-categories window, months and the daily allowance.

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
6. Categorize: user `CategoryRules` by Priority → built-in rules → "Other" (expenses) / "Other income" (income).
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

### Auth contract (agreed)

- `POST /auth/register` `{ displayName, email, password }` → **201** `AuthTokens`; **409** ProblemDetails for a duplicate email; **400** validation ProblemDetails.
- `POST /auth/login` `{ email, password }` → **200** `AuthTokens`; **401** ProblemDetails for a wrong email or password (never says which).
- `POST /auth/refresh` `{ refreshToken }` → **200** `AuthTokens` (refresh token rotated); **401** when invalid, expired or revoked; **400** when the body is missing entirely.
  - **Reuse grace window (~10 s):** presenting a token that was rotated within the last ~10 seconds returns a fresh access token plus the chain's current refresh token (rotated tokens are derived server-side from their predecessor, so the chain stays a single line) instead of counting as reuse, so two tabs refreshing at once don't log the user out. Reuse after the window revokes the whole chain.
  - The SPA shares one in-flight refresh within a tab and lets only one tab refresh at a time (Web Locks; the grace window covers browsers without it).
- `POST /auth/logout` `{ refreshToken }` (JWT required) → **204**, revokes the caller's own token; also 204 (no-op) for an unknown, revoked or another user's token.
- `GET /me` → **200** `{ id, email, displayName, onboardingCompletedAt: string | null }`; **401** if the token's user no longer exists.
- `POST /me/onboarding/complete` → **204**; idempotent, keeps the first completion time; **409** "Add at least one account first." when the user has no active account.
- Login takes the same time for an unknown email as for a wrong password (dummy hash check).
- Field limits: display name 100, email 256, password 8–128 with at least one letter and one ASCII digit (0–9).
- `AuthTokens` = `{ accessToken, expiresIn /* seconds */, refreshToken }`. The refresh token is returned in the body; the SPA keeps it in `localStorage` (MVP decision; httpOnly cookie is a possible later hardening).
- Errors are RFC 7807 ProblemDetails; validation errors carry `errors` keyed by field name.

### Accounts contract (agreed)

- `Account` = `{ id, name, type: "Card" | "Savings" | "Cash", currency: "PLN", initialBalance, balance, isArchived }`. `balance` is computed (initial balance + income − expenses ± transfers), never stored. Enums are sent as names.
- `GET /accounts?includeArchived=false` → **200** `{ items: Account[], netWorth }`. Active accounts first, then archived, each by name (case-insensitive). `netWorth` sums active accounts only, even with `includeArchived=true`.
- `POST /accounts` `{ name, type, currency?, initialBalance? }` → **201** `Account`; **400** validation; **409** "An account with this name already exists." Currency defaults to PLN (others rejected: "Only PLN is supported for now."); initial balance defaults to 0 and may be negative.
- `PUT /accounts/{id}` (same body) → **200** `Account`. Full replace: omitted `initialBalance`/`currency` reset to their defaults, so the client always sends the current values. Archived accounts can be edited (e.g. renamed before restore). **409** duplicate active name; **404** unknown or another user's account.
- `DELETE /accounts/{id}` → **204** archives (idempotent); **409** "You need at least one active account."; **404**.
- `POST /accounts/{id}/restore` → **204** (idempotent); **409** "An account with this name already exists. Rename it first."; **404**.
- Validation messages: "Enter an account name.", "Name can be at most 50 characters.", "Choose an account type." (also for an unknown type value), "Only PLN is supported for now.", "Enter an amount with at most 2 decimal places.", "Enter a smaller amount."

### Categories contract (agreed)

- `Category` = `{ id, name, type: "Expense" | "Income", icon, color /* lowercase #rrggbb */, systemKey: string | null, isArchived, isProtected, transactionCount, budgetCount }`. Counts cover all dates/months (for the delete-or-archive choice and the merge confirmation text).
- `GET /categories?includeArchived=false&type=` → **200** `{ items: Category[] }`. Active first, then archived; expense before income; then by name (case-insensitive).
- `GET /categories/top?limit=8&type=` → **200** `{ items: Category[] }`. Active only, ranked by transactions in the last 90 days including today; ties by seeded default order, then name; unused categories fill the rest. `limit` 1–50 ("Limit must be between 1 and 50.").
- `POST /categories` `{ name, type, icon, color }` → **201** `Category`; **400** validation; **409** "A category with this name already exists." (same type, active, case-insensitive). Color accepted in any case, stored lowercase.
- `PUT /categories/{id}` (same body, full replace) → **200** `Category`. Archived categories can be edited. **409** duplicate name; **409** "The type of a default category can't be changed."; **409** "This category is already in use, so its type can't be changed."; **404**. The frontend matches the two type-lock texts to place the error on the Type field, so reword them only together with the frontend (or switch to a stable problem `type`).
- `DELETE /categories/{id}` → **204** (with its budgets, rules and alerts); **409** "This category has transactions. Archive it or merge it into another category instead."; **409** "Default categories can't be deleted. Hide them instead."; **409** "This category can't be deleted. It collects transactions that don't fit anywhere else."; **404**.
- `POST /categories/{id}/archive` → **204** (idempotent); **409** "This category can't be hidden. It collects transactions that don't fit anywhere else."; **404**.
- `POST /categories/{id}/restore` → **204** (idempotent); **409** "A category with this name already exists. Rename it first."; **404**.
- `POST /categories/{id}/merge` `{ targetCategoryId }` → **200** `{ transactionsMoved, budgetsMoved, rulesMoved, target: Category }`; **400** on `targetCategoryId`: "Choose a category to merge into.", "Choose a different category.", "Choose an active category.", "Choose a category of the same type."; **409** "This category can't be merged. It collects transactions that don't fit anywhere else."; **404** unknown or another user's source/target.
- Validation messages: "Enter a category name.", "Name can be at most 30 characters.", "Choose a category type.", "Choose an icon.", "Choose a color."
- Merge also returns **409** "Merging would make a monthly budget too large. Lower one of the limits first." when a same-month sum would exceed the maximum amount.

### Transactions contract (agreed)

- `Transaction` = `{ id, type: "Expense" | "Income" | "Transfer", amount, date, merchant, note, source: "Manual" | "Csv" | "OpenBanking", account: { id, name, isArchived }, category: { id, name, type, icon, color, systemKey, isArchived } | null, transfer: { transferPairId, fromAccount, toAccount } | null, import: { batchId, importedAt } | null, needsCategory }`. Amounts are positive; `type` gives the sign. A transfer is listed as **one row** (its Out side) with `transfer` set and `category` null. `needsCategory` = not Manual and category is "Other" or "Other income".
- `GET /transactions?from&to&accountId&categoryId&type&minAmount&maxAmount&q&page=1&pageSize=50&sort=-date` → **200** `{ items, page, pageSize, totalCount, totalPages, totals: { income, expenses, net } }`.
  - Filters are optional and combined with AND; `categoryId` may repeat (multi-select); `accountId` also matches a transfer whose other side is that account. No default month: the client sends `from`/`to`.
  - `q`: merchant and note, case- and accent-insensitive, `%`/`_` literal, max 100 characters.
  - `sort`: `date | amount | merchant | category | account`, `-` prefix = descending; ties broken by id; amount sorts unsigned.
  - `pageSize` 1–200. `totalCount` and `totals` cover the whole filtered set; transfers count as rows but add no money. `expenses` = expenses − refunds, floored at 0 (never negative); `income` = income in income categories only; `net` = `income` − `expenses` as returned (the three footer numbers always add up).
  - Decimals in the query string use a dot; unreadable values → 400 "Enter a valid value." on that field.
- `GET /transactions/merchants?q=&limit=10` → **200** `{ items: [{ merchant, lastUsedOn, lastCategory | null }] }`. Expenses and income only; grouped ignoring letter case (most recent spelling shown); prefix matches first, then most recent; `lastCategory` = newest still-active category. `limit` 1–20 ("Limit must be between 1 and 20.").
- `POST /transactions` `{ type, amount, date, accountId, categoryId, merchant?, note? }` → **201** `Transaction`; **400** validation; **404** unknown or another user's account/category. Merchant/note trimmed; blank = none.
- `PUT /transactions/{id}` (same body, full replace) → **200**. Imported rows keep source and hash. **409** "This transaction is part of a transfer. Edit or delete the transfer instead." for a transfer row; **404**.
- `DELETE /transactions/{id}` → **204**; a transfer row deletes the whole pair; imported rows leave a `DeletedImportHash` tombstone; **404**.
- `POST /transactions/bulk` `{ action: "Delete" | "Recategorize", transactionIds (1–500), categoryId? }` → **200** `{ affectedCount }`, all or nothing. Delete removes transfer pairs whole (counted once). **404** (any id unknown or another user's) "One or more of the selected transactions don't exist. Refresh the list and try again."
- Validation messages: "Choose a transaction type.", "Choose Expense or Income. Record transfers as a transfer.", "Enter an amount greater than 0.", "Enter an amount with at most 2 decimal places.", "Enter a smaller amount.", "Choose a date.", "Date can't be in the future.", "Choose an account.", "This account is archived. Choose an active account.", "Choose a category.", "This category is hidden. Choose an active category.", "Choose an expense category.", "Merchant can be at most 200 characters.", "Note can be at most 500 characters."; list: "End date can't be before start date.", "Enter an amount of 0 or more.", "Maximum amount can't be less than minimum amount.", "Choose a transaction type." (unknown `type`), "Page must be 1 or more.", "Page size must be between 1 and 200.", "Sort by date, amount, merchant, category or account.", "Search can be at most 100 characters."; bulk: "Choose an action.", "Select at least one transaction.", "Select at most 500 transactions at once.", "Transfers don't have a category. Unselect them first.", "Select only expenses or only income to change their category."

### Transfers contract (agreed)

- `POST /transfers` `{ fromAccountId, toAccountId, amount, date, note? }` → **201** `Transaction` (the Out row, with `transfer`). Two rows sharing `TransferPairId` in one DB transaction. Messages: "Choose two different accounts." (on `toAccountId`), "Choose the account to move money from.", "Choose the account to move money to.", plus the amount/date/note/archived-account messages. **404** another user's account.
- `PUT /transfers/{transferPairId}` (same body) → **200**; both sides updated together; an unchanged archived account may stay. **404** unknown/another user's pair or a plain transaction id.
- `DELETE /transfers/{transferPairId}` → **204**; removes both sides (tombstones for imported sides). **404**.

### Budgets contract (Phase 1: set/remove one limit)

- `PUT /budgets/{categoryId}?month=YYYY-MM` `{ limitAmount }` → **200** `Budget` = `{ categoryId, month: "YYYY-MM", limitAmount }` (creates or replaces the limit for that category and month).
- `limitAmount` of `0` or `null` (or omitted, `{}`) removes the budget → **204** (also 204 when there was none). The client sends an empty field as `null`; a request with no body is a 400. On an income category even a removal is 400 "Budgets can only be set for expense categories." (it can never hold a budget).
- Rules: expense categories only; the category must be active to set a limit (removing is allowed for a hidden one); past, current and future months are all allowed. Writes take the user's category lock (same as merge, which sums budgets).
- **404** unknown or another user's category.
- Validation messages: "Choose a month." (missing), "Enter a month as YYYY-MM." (unreadable), "Enter an amount of 0 or more.", "Enter an amount with at most 2 decimal places.", "Enter a smaller amount.", "Budgets can only be set for expense categories.", "This category is hidden. Choose an active category."

## 8. Screens (Angular)

1. **Dashboard** — month selector; cards: Left to spend (+ daily allowance), Spent this month (± % vs last month), Income, Net worth; budget progress bars sorted by usage, colored by status; donut by category; bar chart last 6 months; last 5 transactions; alerts banner; Quick add button.
2. **Transactions** — table: Date, Merchant/note, Category (inline edit), Account, Amount (red/green), Source badge. Filters in URL query params, server-side paging (50) and sorting, bulk actions, footer totals. Quick-add dialog: amount focused first, last-used account preselected.
3. **Budgets** — Category, Limit (inline edit), Spent, Remaining, Usage bar, Status; Copy from last month; Unbudgeted row; row click → filtered Transactions.
4. **Accounts** — cards with balances; add/edit/archive/restore; Import CSV per account; import history.
5. **Settings** — categories (add/rename/hide/archive/merge), rules, and a toggle to disable single-key keyboard shortcuts (WCAG 2.1.4; stored per user on the device and kept across logouts: "Keyboard shortcuts" / "Single-key shortcuts").
6. **Auth** — login, register; JWT interceptor; route guards.

## 9. Phases and tasks

### Phase 1 — Core app, running locally
**Done when:** a user can register, log in, finish onboarding, add/edit/filter transactions, all via Docker Compose.

Backend (`finance-tracker-api`):
- [x] Solution + project structure from §3; Docker Compose with Postgres
- [x] Domain entities + EF Core configuration + initial migration (incl. `unaccent`, `pg_trgm`)
- [x] Identity + JWT auth (register, login, refresh with rotation, logout); per-user default categories seeded on registration; `GET /me`, onboarding complete
- [x] Accounts CRUD + archive/restore + computed balances
- [x] Categories CRUD (hide/archive, restore, delete, merge, top used)
- [x] Transactions CRUD with filters, paging, sorting, totals, merchant autocomplete; transfers (create/edit/delete pair)
- [x] Minimal budgets: `PUT /budgets/{categoryId}` (needed by onboarding step 2)
- [x] Integration tests (Testcontainers): user isolation — user A gets 404 on user B's data

Frontend (`finance-tracker-web`):
- [x] Angular: auth pages, layout, Accounts, Transactions table, Quick-add dialog (FEATURES.md F3)
- [x] Settings toggle to disable single-key shortcuts (WCAG 2.1.4); the layout's shortcut handling reads it (build with the Settings page)
- [x] Onboarding flow, 3 steps (FEATURES.md F1); CSV import option shown as "Coming soon" until Phase 4
- [x] Settings → Categories (FEATURES.md F5, DESIGN.md screen 7): list by type, add/rename custom (name, type, icon, color), hide/restore, delete or archive, merge with confirmation; Other/Other income protected

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
- [ ] RDS PostgreSQL (smallest instance), credentials in Secrets Manager; database collation must fold Polish letters in `lower()` (e.g. en_US.UTF-8 / ICU), not C/POSIX
- [ ] API on Elastic Beanstalk; config from Secrets Manager / Parameter Store
- [ ] Angular on S3 + CloudFront with HTTPS; CORS configured
- [ ] CloudWatch logs (structured logging with Serilog)
- [ ] Auth hardening: login rate limiting / lockout; scheduled cleanup of expired and revoked refresh tokens
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
