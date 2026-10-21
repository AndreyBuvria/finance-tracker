# Finance Tracker — Feature Specification

> For Claude Code: `PLAN.md` says **what to build and in what order**. This file says **why each feature exists, how it should feel to the user, and how it behaves in edge cases**. When a technical choice is ambiguous, pick the option that best serves the user experience described here. When this file and `PLAN.md` conflict, ask.

---

## 1. Product vision

### The problem
Most people in Poland pay by card or phone (Google Pay / Apple Pay) and only find out what they spent when the month is over. Bank apps show a list of payments, but they don't answer the questions people actually have:

- "Can I afford to go out this weekend?"
- "Why is my money gone already on the 20th?"
- "Am I spending more on food than last month?"

### The promise
**Open the app → in 3 seconds know how much you can still spend this month.**

Everything in the product supports that sentence. Charts, tables and imports exist to make that number accurate and trustworthy.

### Product principles
1. **Budget awareness over accounting.** We are not bookkeeping software. Precision matters for money, but users never need to understand debits and credits.
2. **Fast entry or it won't be used.** Adding a cash expense must take under 10 seconds, or users stop doing it and the numbers become wrong.
3. **Warn early, never shame.** Alerts are friendly and actionable ("6 days left, 120 zł remaining"), never judgmental ("You overspent again!").
4. **Trust the numbers.** No duplicates, no silent changes. When the app changes data automatically (import, categorization), it says so.
5. **Every screen answers one question.** If a screen tries to answer three, split it.

### Target user (persona)
**Kasia, 28, Warsaw, junior marketing specialist.**
- Salary ~7,500 zł net, paid on the 10th.
- Accounts: mBank card (daily spending, Google Pay on her phone), Revolut (travel, splitting bills), a savings account, some cash.
- Rent 2,800 zł. Saving for a holiday.
- Pain: "I don't overspend on anything big, it's a hundred little things. Żabka, Bolt, Glovo."
- Behavior: checks her phone constantly, would open the app 2–3 times a week if it's quick. Will not type in 60 transactions by hand; will happily upload a CSV once a week.

Design every feature for Kasia: mobile-friendly web, Polish context (PLN, Polish banks, Polish merchants), very little setup.

### Language and formatting
- UI language: **English** for the MVP (portfolio), but all text lives in Angular i18n files so Polish can be added.
- Money format: `1 234,56 zł` (Polish locale: space thousands separator, comma decimals, `zł` after the amount). Use Angular `CurrencyPipe` with `pl-PL`.
- Dates: `19 Oct 2026` in lists, `October 2026` for months. Week starts Monday.
- Expenses shown as `−120,00 zł` in the default text color with a red accent; income as `+7 500,00 zł` in green. Never rely on color alone.

---

## 2. Feature overview

| # | Feature | User question it answers | Phase |
|---|---|---|---|
| F1 | Sign-up, login, onboarding | "How do I start without a lot of setup?" | 1 |
| F2 | Accounts | "Where is my money?" | 1 |
| F3 | Transactions (manual) | "What did I spend?" | 1 |
| F4 | Transfers | "I moved money to savings. That's not spending." | 1 |
| F5 | Categories | "What kind of spending is this?" | 1 |
| F6 | Budgets | "How much am I allowed to spend on X?" | 2 |
| F7 | Dashboard | "How am I doing this month?" | 2 |
| F8 | Alerts | "Tell me before it's too late." | 2 |
| F9 | CSV import | "I don't want to type everything." | 4 |
| F10 | Auto-categorization rules | "Stop asking me what Żabka is." | 4 |
| F11 | Monthly email report | "Remind me how last month went." | Post-MVP |
| F12 | Bank sync (open banking) | "Just pull it in automatically." | Post-MVP |

---

## F1. Sign-up, login and onboarding

**Why:** First impressions decide whether Kasia stays. An empty app with no explanation feels broken. The first session must end with a meaningful dashboard.

### User stories
- As a new user, I can sign up with email and password so my data is private.
- As a new user, I am guided through a short setup so the dashboard is useful immediately.
- As a returning user, I stay logged in on my device so I don't log in every time.

### Behavior
- Sign-up fields: display name, email, password (min. 8 chars, at least one letter and one number). Show password requirements inline while typing, not after submit.
- Duplicate email → "An account with this email already exists. Log in instead?" with a link.
- Wrong login → "Email or password is incorrect." (never say which one).
- Access token short-lived (15 min), refresh token long-lived (14 days). Refresh silently; the user should never be thrown out mid-task. If refresh fails, redirect to login and return to the same page after login.

### Onboarding (first login only, skippable, 3 steps)
1. **"Where do you keep your money?"** Pre-filled suggestions as toggle chips: Main card, Savings, Cash. User can rename and set the current balance for each (balance optional, default 0). At least one account required.
2. **"Set a monthly budget"** Show the 5 most common categories (Groceries, Eating out, Transport, Shopping, Entertainment) with empty limit fields and a hint: "Not sure? Start with a guess. You can change it anytime." Skippable.
3. **"Add your spending"** Two big options: "Import a bank statement (CSV)" and "Add a transaction manually". Third, quieter link: "I'll do it later".

After onboarding → Dashboard. Store `OnboardingCompletedAt` on the user so it never shows again.

---

## F2. Accounts

**Why:** People think in "where is my money": my card, my savings, my cash. Accounts make balances match what the user sees in their bank, which builds trust in all other numbers.

### User stories
- As a user, I can create accounts for my card, savings and cash.
- As a user, I can see the current balance of each account.
- As a user, I can archive an account I closed without losing its history.

### Behavior
- Fields: Name (required, max 50, unique per user among non-archived), Type (Card / Savings / Cash), Currency (PLN only in MVP, field disabled with hint "More currencies coming soon"), Starting balance.
- **Starting balance** is explained in the form: "The balance on the day you start tracking. Check your bank app." It can be edited later; editing it changes all computed balances.
- Balance shown on each account card. If the computed balance differs from the bank, the user fixes it by editing the starting balance or adding a correction transaction (category "Other"). No special reconciliation feature in the MVP.
- Archive (not delete): the account disappears from pickers and the net worth, but its transactions remain in history and reports, shown with an "Archived" badge. Archived accounts can be restored.
- Cannot archive the last active account: "You need at least one active account."

### Empty state
Never empty after onboarding (≥1 account is required).

---

## F3. Transactions (manual)

**Why:** The heart of the app. If adding is slow or the list is hard to scan, users stop tracking and all other features become useless.

### User stories
- As a user, I can add an expense in a few seconds, e.g. right after paying for coffee.
- As a user, I can add income, e.g. my salary.
- As a user, I can find a past transaction by searching, filtering and sorting.
- As a user, I can fix a mistake (edit or delete) at any time.
- As a user, I can recategorize several transactions at once.

### Quick add (the most important interaction in the app)
- Opens from: floating "+" button on every screen (mobile), "Add" button in the top bar (desktop), keyboard shortcut `N` on desktop.
- Field order and defaults:
  1. **Type** toggle: Expense (default) / Income.
  2. **Amount** — focused automatically, numeric keyboard on mobile, accepts both `12,50` and `12.50`.
  3. **Category** — grid of icons for the user's most-used categories (top 8 by usage in the last 90 days, defaults for new users), "More" opens the full list.
  4. **Merchant / note** — optional, single text field, autocompletes from past merchants. Choosing a past merchant pre-selects its last-used category if the user hasn't picked one.
  5. **Date** — defaults to today; quick chips "Today", "Yesterday", or a date picker.
  6. **Account** — defaults to the last account used.
- "Save" closes the dialog and shows a toast "Expense added · −24,00 zł Eating out" with **Undo** (5 seconds).
- "Save and add another" keeps the dialog open, keeps date and account, clears amount and merchant. Useful after a shopping trip.
- Target: **amount + category + save = 3 taps**.

### Transactions table
- Columns: Date, Merchant/Note, Category, Account, Amount, Source.
- Grouped by day with a daily total in the group header ("Mon, 19 Oct · −86,40 zł") on mobile; flat sortable table on desktop.
- **Source badge:** "Manual", "Imported" (with tooltip: file name and import date), later "Bank sync".
- **Inline category change:** click the category chip → dropdown → saved immediately with a small "Saved" confirmation. If the transaction was imported, show the learning prompt (F10).
- **Filters:** Month (default: current), date range, account, category (multi-select), type, amount range, text search (merchant + note, case- and accent-insensitive: "zabka" finds "Żabka"). Active filters shown as removable chips. Filters are stored in the URL so the back button and links work.
- **Footer:** "143 transactions · Spent 4 812,30 zł · Income 7 500,00 zł" for the current filter.
- **Bulk actions:** select rows → "Change category", "Delete". Deleting asks for confirmation with the count and total: "Delete 3 transactions (−212,00 zł)?"
- Clicking a row opens the edit dialog (same as Quick add, pre-filled), with Delete at the bottom.

### Edge cases
- Future dates: allowed up to tomorrow (time-zone slack). Beyond → "Date can't be in the future."
- Very old dates: allowed (users may backfill), no lower limit.
- Amount 0 or negative → "Enter an amount greater than 0." The sign comes from the type, users never type a minus.
- Deleting an imported transaction: allowed. It won't come back on re-import (tombstone). Tooltip on delete: "This won't be re-imported from the same statement."
- Editing the amount or date of an imported transaction is allowed; the original hash stays so the same row isn't imported twice.

### Empty states
- No transactions at all: illustration + "No transactions yet. Add your first one or import a bank statement." with both buttons.
- No results for filters: "Nothing matches these filters." + "Clear filters" button.

---

## F4. Transfers

**Why:** Moving 1 000 zł to savings is not spending. If it counts as an expense, the budget and the "Spent this month" number become wrong and users lose trust.

### User stories
- As a user, I can record moving money between my own accounts.
- As a user, transfers don't count as spending or income.

### Behavior
- Quick add has a third type: **Transfer**, with From account, To account, Amount, Date, Note. No category.
- Shown in the table as one row with icon ⇄ and "mBank → Savings", amount in neutral color.
- Affects both account balances. Excluded from spending, income, budgets, charts and reports.
- Editing or deleting a transfer affects both sides.
- From and To must differ: "Choose two different accounts."
- **Imported transfers (Phase 4):** a CSV row like "PRZELEW WŁASNY" or "Transfer to Savings" is imported as an expense by default. In the MVP the user can convert it: row menu → "Mark as transfer" → pick the other account. If a matching opposite row exists in the other account (same amount, ±2 days), link them instead of creating a new one.

---

## F5. Categories

**Why:** Categories turn a list of payments into insight ("40% goes on eating out"). Too few categories hide information; too many make entry slow.

### User stories
- As a user, I start with sensible default categories.
- As a user, I can add my own categories (e.g. "Dog", "Kids").
- As a user, I can clean up categories without breaking my history.

### Behavior
- Defaults (each with icon and color): Groceries, Eating out, Transport, Housing, Utilities, Health, Shopping, Entertainment, Subscriptions, Other (expense); Salary, Other income (income).
- Custom category: name (unique per user and type, max 30), type, icon (from a fixed set of ~40), color (from a fixed palette of 12, so charts stay readable).
- **Hide** a default category: disappears from pickers, history kept.
- **Archive** a custom category with transactions: same as hide. Without transactions: delete outright.
- **Merge** "Coffee" into "Eating out": moves all transactions, budgets (limits are summed for the same month) and rules, then archives "Coffee". Confirmation shows what will move: "Move 34 transactions and 1 budget to Eating out?"
- "Other" can't be hidden or merged; it's the fallback for imports.

---

## F6. Budgets

**Why:** This is the core value. A budget turns "I spent 900 zł on food" (a fact) into "I have 600 zł left for food for 12 days" (a decision).

### User stories
- As a user, I can set a monthly limit for any expense category.
- As a user, I can see for each category how much I spent and how much is left.
- As a user, I can reuse last month's budgets without retyping them.
- As a user, I can see spending that isn't covered by any budget.

### Behavior
- Budgets are **per calendar month**. Selecting a month with no budgets shows: "No budgets for November yet." + **"Copy from October"** (primary) + "Start from scratch".
- Budgets table columns: Category, Limit, Spent, Remaining, Usage bar, Status.
- Edit limit inline: click → number field → Enter saves. Setting 0 or empty removes the budget for that category.
- **Status and colors:**
  - OK (< 80%) — neutral/green bar.
  - Warning (80–99%) — amber bar, label "Almost there".
  - Over (≥ 100%) — red bar, Remaining shows negative: "−45,00 zł over".
- **Refunds** (income in an expense category, e.g. a returned item in Shopping) reduce Spent. Spent can't go below 0 on display.
- **Unbudgeted row** at the bottom: "Spending without a budget · 340,00 zł" → click shows those transactions. Gently nudges users to budget everything without forcing it.
- **Total row:** sum of limits, sum of spent, total remaining.
- Clicking a category row → Transactions filtered by that category and month.
- Past months are read-only for limits? **No** — editable, but show a hint "Editing a past month" so changes are deliberate.

### Daily allowance (current month only)
"You can spend **~45 zł/day** for the next 12 days."
- = total remaining across budgeted categories ÷ days left in the month, including today.
- If remaining ≤ 0: "You've used your whole budget for October." (no negative daily number).
- Not shown for past or future months.

---

## F7. Dashboard

**Why:** The one screen Kasia opens 3 times a week. It must answer "How am I doing this month?" in 3 seconds, before any scrolling.

### Layout (mobile first, top to bottom; desktop uses a 2–3 column grid with the same order)
1. **Month selector** — "October 2026" with ‹ › arrows. Defaults to the current month. Changing the month updates everything.
2. **Hero card: Left to spend** — big number "1 240,00 zł left", subline "of 4 500,00 zł budget · ~103 zł/day for 12 days". Color follows overall status. If no budgets: "Set budgets to see how much you have left" + button.
3. **Alerts banner** (only if unread alerts): "Eating out is at 92%. 6 days left." Dismissible (marks as read).
4. **Three small cards:** Spent this month (with "▲ 12% vs September" — up is bad, shown in amber; down is good), Income this month, Net worth (sum of balances).
5. **Budgets** — progress bars per category, sorted by usage % descending (most at risk first), top 5 + "See all budgets".
6. **Spending by category** — donut chart with legend and amounts. Click a slice → filtered transactions. Transfers excluded.
7. **Last 6 months** — bar chart of total spending per month; current month bar shows "so far" pattern/label.
8. **Recent transactions** — last 5, with "See all".

### Behavior
- One API call (`GET /dashboard?month=`), skeleton loaders while loading — never a blank screen or spinner over everything.
- For a past month: hero card becomes "Spent 4 210,00 zł of 4 500,00 zł budget" (no daily allowance). For a future month: show budgets only, "No spending yet".
- **Empty state (new user, no transactions):** keep the layout but show friendly placeholders in each card, and a central prompt: "Add your first transaction or import a statement to see your month."

---

## F8. Alerts

**Why:** A dashboard only helps when opened. Alerts bring the user back at the moment it matters — before the budget is gone, not after.

### User stories
- As a user, I am told when a category reaches 80% and when it goes over 100%.
- As a user, I am not spammed with the same alert repeatedly.

### Behavior
- Triggered by any change to expenses (manual add/edit/delete, import, recategorization).
- Created only when status **crosses** a threshold upward (OK → Warning, Warning/OK → Over). Max one Warning and one Over per category per month. If spending drops back (e.g. a refund), no "good news" alert in MVP.
- An import that pushes several categories over creates one alert per category, shown grouped: "This import pushed 2 budgets over 80%."
- Shown as: bell icon with unread count in the top bar; list of alerts in a dropdown; the newest unread on the dashboard banner.
- Copy templates:
  - Warning: "**{Category}** is at {pct}% — {remaining} left for {daysLeft} days."
  - Over: "**{Category}** is over budget by {overAmount}."
- Alerts for past months aren't created during import of old statements (only current month alerts). Importing September data in October shouldn't ring bells.
- Post-MVP: same alerts by email (opt-in).

---

## F9. CSV import

**Why:** Kasia makes 60–100 payments a month, mostly via Google Pay. She won't type them. A weekly CSV upload from her bank gets all of them in under a minute. This is also how phone wallet payments get into the app, since Google Pay / Apple Pay don't share transaction history.

### User stories
- As a user, I can upload a statement exported from my bank and have the transactions added to the right account.
- As a user, I can import overlapping periods without creating duplicates.
- As a user, I can see what happened with the import (how many added, skipped).
- As a user, I can learn how to export a CSV from my bank.

### Flow
1. Accounts screen → account card → **"Import statement"** (or from onboarding / Transactions empty state).
2. Dialog: Account (pre-selected), **Bank** (mBank, PKO BP, ING, Revolut), file picker (drag & drop on desktop). Under the bank picker: a collapsible "How do I export this from {bank}?" with 3–4 short steps per bank.
3. Upload → progress bar → "Processing…" status. User can close the dialog; processing continues and a toast appears when done.
4. **Result summary:** "Import finished · 143 added · 12 already existed · 2 rows couldn't be read." + "Review imported transactions" (opens Transactions filtered to this import) + list of the unreadable rows with the reason.
5. Imported transactions get the "Imported" badge. Those categorized as "Other" are highlighted with "Needs category" so the user can fix them quickly.

### Behavior
- File limits: `.csv` only, max 5 MB. Wrong bank format detected (expected columns missing) → "This doesn't look like an {bank} CSV. Did you choose the right bank?" — nothing imported.
- **Duplicates:** the same transaction imported twice is skipped silently and counted as "already existed". Two genuinely identical payments on the same day (two coffees, same price, same café) are both kept.
- **All-or-nothing:** if processing fails midway, nothing is saved and the user sees "Import failed. No transactions were added. Try again." Retrying is always safe.
- Rows for card holds / pending transactions (if the bank marks them) are skipped.
- Imported transfers between own accounts: see F4.
- Import history on the account page: date, file name, status, counts. MVP has no "undo import" — a post-MVP idea: delete all transactions of a batch.

---

## F10. Auto-categorization rules

**Why:** Imports are only faster than typing if the app categorizes most rows itself. After a few weeks of use, >90% of imported rows should need no manual touch.

### User stories
- As a user, imported transactions from known shops land in sensible categories automatically.
- As a user, when I fix a category once, the app remembers it.
- As a user, I can see and edit the rules.

### Behavior
- Order: **user rules** (by priority) → **built-in rules** (Polish merchants, see `PLAN.md`) → "Other".
- Rules match the merchant/description, case- and accent-insensitive.
- **Learning prompt:** when a user changes the category of an imported transaction, a snackbar asks: "Always put **Bolt** in **Transport**?" [Yes] [No]. On Yes:
  - Create a rule with a cleaned-up pattern (strip card numbers, cities, dates, store IDs: "BOLT.EU/O/2610191234 WARSZAWA" → "BOLT").
  - Offer: "Also update 7 other Bolt transactions?" [Update].
- Settings → Rules: table of Pattern, Category, Matches (count), with edit, delete and priority drag-and-drop. Adding a rule shows a live preview: "Matches 23 existing transactions."
- Rules apply to **new imports** only, unless the user chooses to apply them to existing transactions.
- Manual transactions use merchant autocomplete instead of rules (F3).

---

## F11. Monthly email report (post-MVP)

**Why:** A gentle monthly ritual. Users who don't open the app still stay aware.

- Sent on the 1st of each month at 08:00 Europe/Warsaw, opt-in in settings (default on after sign-up, with unsubscribe link).
- Content: total spent vs budget, top 3 categories, biggest change vs previous month, number of budgets kept, a button "See full report". Plain, friendly, mobile-readable HTML.
- Not sent if the user had zero transactions last month.

## F12. Bank sync via open banking (post-MVP)

**Why:** Removes the weekly CSV chore entirely.

- User connects a bank through Enable Banking (redirect to the bank, confirm in the bank's mobile app).
- Transactions sync daily into the linked account, through the same dedup and categorization pipeline as CSV.
- Consent expires after 90 days (PSD2) → the app shows "Reconnect mBank to keep syncing" a few days before.
- Never store bank credentials; only the aggregator's tokens.

---

## 3. Cross-cutting requirements

### Privacy and security
- A user can only ever see their own data. This is tested, not assumed.
- Passwords hashed (Identity default). No sensitive data in logs (no amounts with merchant names in info logs, no tokens).
- Uploaded CSV files are deleted from S3 after successful processing (S3 lifecycle rule: 7 days max).
- Settings → "Delete my account": deletes all data after typing the email to confirm. (GDPR-friendly, and a nice interview talking point.)
- Settings → "Export my data" (CSV of all transactions) — small effort, high trust.

### Responsiveness and accessibility
- Works on 360 px wide phones up to desktop. Tables become card lists on mobile.
- Keyboard accessible, visible focus, labels on all inputs, charts have a text/table alternative, color is never the only signal (status also has text).

### Performance
- Dashboard loads in < 1 s with 5 000 transactions for a user.
- Transactions table: server-side paging; search responds in < 300 ms.

### Feedback and errors
- Every action gives feedback: toast for success, inline messages for validation, a friendly full-page message for unexpected errors ("Something went wrong. Try again.") with a correlation ID shown small for support.
- Destructive actions confirm and, where possible, offer Undo instead.

---

## 4. Demo data

For the portfolio demo, provide a **"Try with demo data"** button on the login page that logs into a pre-seeded read-write demo account (reset nightly):
- 3 accounts (mBank card, Revolut, Savings), 6 months of realistic Polish transactions (Żabka, Biedronka, Bolt, Glovo, rent, salary on the 10th, Netflix, Spotify), budgets where 1 category is in Warning and 1 is Over this month, 2 import batches.

Recruiters will click this rather than sign up. It's the most important screen for the portfolio after the dashboard.

---

## 5. Definition of done (any feature)

- Behavior matches this file, including empty states and edge cases.
- Backend: user-isolation integration tests for user-owned endpoints (business-rule tests deferred, see `PLAN.md`). Frontend: Vitest tests.
- Works on mobile width and desktop.
- Loading, empty and error states implemented — not just the happy path.
- No console errors; no unhandled API errors.
