Design a responsive web app UI for "Finance Tracker", a personal budgeting app for young
  professionals in Poland. Core promise: "Open the app → in 3 seconds know how much you can still
  spend this month." Tone: calm, friendly, trustworthy, never judgmental. Budget awareness, not
  accounting software.

  DESIGN SYSTEM
  - Based on Material Design 3 (it will be built with Angular Material), so use M3 components,
  elevation, shapes and type scale.
  - Clean and minimal with lots of white space. One primary brand color (a calm teal or indigo),
  neutral greys, plus semantic colors: green = income/OK, amber = warning, red = expense accent/over
  budget.
  - Never rely on color alone: always pair it with a sign, icon or text label.
  - Category palette: 12 fixed distinct colors that read well in charts. Category icons: rounded
  Material Symbols.
  - Create light mode first. Add dark mode variants for the key screens if possible.
  - Frames: Mobile 360×800 and Desktop 1440×900 for every screen.
  - Accessible: visible focus states, labels on every input, contrast at least WCAG AA.

  FORMATTING (Polish locale, English UI)
  - Money: "1 234,56 zł" (space as thousands separator, comma decimals, "zł" after the amount).
  - Expenses: "−120,00 zł" in the default text color with a small red accent. Income: "+7 500,00 zł"
  in green. Transfers: neutral, no sign.
  - Dates: "19 Oct 2026" in lists, "October 2026" for months. Weeks start on Monday.

  SAMPLE DATA (use throughout)
  User "Kasia". Accounts: "mBank card" (Card) 2 340,15 zł, "Revolut" (Card) 412,80 zł, "Savings"
  (Savings) 8 000,00 zł, "Cash" (Cash) 150,00 zł.
  Transactions: Żabka −18,47 Groceries; Bolt −24,00 Transport; Glovo −56,90 Eating out; Biedronka
  −132,60 Groceries; Netflix −43,00 Subscriptions; Rent −2 800,00 Housing; Salary +7 500,00 Salary;
  transfer mBank card → Savings 1 000,00.
  Categories. Expense: Groceries, Eating out, Transport, Housing, Utilities, Health, Shopping,
  Entertainment, Subscriptions, Other. Income: Salary, Other income.

  APP SHELL
  - Desktop: left navigation rail/drawer (Dashboard, Transactions, Accounts, Settings). Top bar with
  the app name, a primary "Add" button with an "N" shortcut hint, and a user avatar menu (Settings,
  Log out).
  - Mobile: top app bar plus bottom navigation (Dashboard, Transactions, Accounts, Settings). A
  floating "+" action button on every screen.
  - Dashboard is a later phase: show it as a simple placeholder page with the month selector
  "October 2026 ‹ ›" and an empty-state card "Add your first transaction to see your month."

  SCREENS

  1. Login
  - Email, password, "Log in" button, link to "Create an account".
  - Error state: "Email or password is incorrect."

  2. Register
  - Display name, email, password.
  - Password requirements shown inline as a checklist that ticks off live while typing: "At least 8
  characters", "At least one letter", "At least one number".
  - Error state for a duplicate email: "An account with this email already exists. Log in instead?"
  (with a link).

  3. Onboarding (3 steps, stepper or progress dots, "Skip" in the top corner)
  - Step 1 "Where do you keep your money?": toggle chips "Main card", "Savings", "Cash". Each
  selected chip expands to an editable name plus an optional current balance (default 0). Hint: "The
  balance on the day you start tracking. Check your bank app." At least one account is required, so
  Continue stays disabled until one is selected.
  - Step 2 "Set a monthly budget": 5 rows (Groceries, Eating out, Transport, Shopping,
  Entertainment), each with a category icon and an empty "zł" limit field. Hint: "Not sure? Start
  with a guess. You can change it anytime." Buttons: Continue, Skip.
  - Step 3 "Add your spending": two large option cards, "Import a bank statement (CSV)" (with a
  "Coming soon" badge, disabled) and "Add a transaction manually", plus a quieter text link "I'll do
  it later".

  4. Quick add dialog (the most important interaction; full-screen bottom sheet on mobile, centered
  dialog on desktop)
  - Segmented toggle: Expense (default) / Income / Transfer.
  - Large amount field at the top, focused, with "zł" suffix and placeholder "0,00".
  - Category grid: 8 icon tiles (icon + label + category color) plus a "More" tile that opens the
  full category list. Show one tile selected.
  - "Merchant or note" field with an autocomplete dropdown of past merchants (show "Żabka", "Zara").
  - Date chips "Today" (selected) / "Yesterday" plus a calendar icon for the date picker.
  - Account dropdown, preselected to "mBank card".
  - Buttons: "Save and add another" (secondary), "Save" (primary).
  - Transfer variant: no category grid. Fields are From account, To account, Amount, Date, Note.
  Error state: "Choose two different accounts."
  - Validation state: "Enter an amount greater than 0." Also show a future-date error: "Date can't
  be in the future."
  - Success toast with an Undo action: "Expense added · −24,00 zł Eating out   UNDO".
  - Edit variant: same dialog pre-filled, title "Edit transaction", with a red text button "Delete"
  at the bottom.

  5. Transactions
  - Desktop: a flat sortable table with columns Checkbox, Date, Merchant/Note, Category (a colored
  chip you can click), Account, Amount (right-aligned), Source badge ("Manual").
    - Transfer row: ⇄ icon, "mBank card → Savings", neutral amount.
    - Show a row whose category chip is open as an inline dropdown, with a small "Saved"
  confirmation.
  - Mobile: a card list grouped by day with group headers like "Mon, 19 Oct · −86,40 zł".
  - Filter bar:
    - Month selector (default current month), a search field ("Search merchant or note"), and filter
  buttons for Date range, Account, Category (multi-select), Type, Amount range.
    - Active filters shown as removable chips, e.g. "Groceries ×", "mBank card ×".
  - Sticky footer summary: "143 transactions · Spent 4 812,30 zł · Income 7 500,00 zł". Pagination
  of 50 per page.
  - Bulk selection state: with 3 rows selected, a contextual bar shows "3 selected · Change category
  · Delete".
  - Delete confirmation dialog: "Delete 3 transactions (−212,00 zł)?"
  - Empty state (no data): friendly illustration, "No transactions yet. Add your first one or import
  a bank statement.", buttons "Add transaction" and "Import statement".
  - Empty state (no results): "Nothing matches these filters." with a "Clear filters" button.
  - Loading state: skeleton rows.

  6. Accounts
  - Grid of account cards (1 column on mobile, 3 on desktop). Each card shows a type icon (card /
  piggy bank / wallet), the name, a large balance, the type label and a "⋮" menu (Edit, Archive).
  - Total at the top: "Net worth · 10 902,95 zł".
  - "Add account" button.
  - Collapsed "Archived accounts (1)" section with a muted card, an "Archived" badge and a "Restore"
  action.
  - Add/Edit account dialog:
    - Name, Type (segmented: Card / Savings / Cash), Currency (disabled, "PLN", hint "More
  currencies coming soon"), Starting balance with the helper text "The balance on the day you start
  tracking. Check your bank app."
    - Error states: "An account with this name already exists." and, when archiving, "You need at
  least one active account."

  7. Settings → Categories
  - Two sections: Expense categories and Income categories.
  - Each row shows a colored icon, the name, a transaction count and a "⋮" menu. Default categories
  offer Rename, Hide and Merge into…; custom categories offer Rename, Archive/Delete and Merge
  into….
  - "Other" shows a lock icon with the tooltip "Used as the fallback category".
  - A collapsed "Hidden & archived" section with a Restore action.
  - Add/Edit category dialog: name (max 30), type, an icon picker (a grid of about 40 icons) and a
  color picker (12 swatches).
  - Merge dialog: "Merge Coffee into…" with a category dropdown, plus a confirmation line "Move 34
  transactions and 1 budget to Eating out?"

  GENERAL STATES TO INCLUDE
  - A success toast, an inline validation error, and a full-page error: "Something went wrong. Try
  again." with a small grey "Error ID: 7f3a-91c2".
  - Skeleton loaders for lists and cards. No full-screen spinners.

  Two things to know before you use it:
  - Dashboard placeholder. The full dashboard is Phase 2, so the prompt asks for a placeholder page
    only. I can write a Phase 2 prompt later.
  - Onboarding step 2. The prompt includes the budgets step. That assumes you accept my
    recommendation (point 4 in my last message) to bring a minimal budgets endpoint into Phase 1. If
    you'd rather leave it out, delete step 2 from the prompt.
