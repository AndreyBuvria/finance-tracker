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
  - Desktop: left navigation rail/drawer (Dashboard, Transactions, Budgets, Accounts, Settings). Top bar with
  the app name, the current page's primary "Add" button with an "N" shortcut hint (Dashboard and
  Transactions: add a transaction; Accounts: add an account; Settings: none), and a user avatar menu
  (Settings, Log out).
  - Mobile: top app bar plus bottom navigation (Dashboard, Transactions, Budgets, Accounts, Settings). A
  floating "+" action button for the current page's "Add" action (hidden on Settings).
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

  3. Onboarding (3 steps, progress dots with "Step n of 3", "Skip" in the top corner on step 2, a
  small "Log out" link in the top bar)
  - Step 1 "Where do you keep your money?": toggle chips "Main card", "Savings", "Cash". Each
  selected chip expands to an editable name plus an optional current balance (default 0). Hint: "The
  balance on the day you start tracking. Check your bank app." At least one account is required, so
  Continue stays disabled until one is selected.
  - Step 2 "Set a monthly budget": 5 rows (Groceries, Eating out, Transport, Shopping,
  Entertainment), each with a category icon and an empty "zł" limit field. Hint: "Not sure? Start
  with a guess. You can change it anytime." Buttons: Back, Continue; "Skip" in the top corner (step 2
  only: step 1 is required, step 3 has "I'll do it later").
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

  PHASE 2 SCREENS (replace the Dashboard placeholder)

  8. Dashboard
  - Same month selector as Transactions. Mobile: one column in the FEATURES F7 order; desktop: a
  12-column grid — hero card (8 cols) + three small cards stacked (4 cols); budgets bars and donut
  side by side; last 6 months and recent transactions side by side.
  - Hero card "Left to spend": large number in the status color (OK: primary/green tone, Warning:
  amber, Over: red), subline "of 4 500,00 zł budget · ~103 zł/day for 12 days". Past month: "Spent
  4 210,00 zł of 4 500,00 zł budget". No budgets: "Set budgets to see how much you have left" +
  button "Set budgets".
  - Alerts banner under the hero: tonal amber (Warning) or red (Over) surface, icon, text, close ×.
  - Small cards: Spent this month with "▲ 12% vs September" (up = amber, down = green), Income, Net
  worth.
  - Budgets card: 5 rows (icon, name, "320 / 400 zł", thin progress bar in the status color, Warning
  label "Almost there", Over shows "−45,00 zł over"), link "See all budgets".
  - Donut: 6 category colors + grey "Everything else", total in the middle, legend with amounts.
  - Bars: 6 months, labels "May"…"Oct", the current month hatched with "so far".
  - Recent transactions: 5 rows as in the Transactions mobile list, link "See all".
  - Empty state: same layout with placeholder cards and a central prompt "Add your first transaction
  or import a statement to see your month."
  - Charts are simple SVG in the category palette; each has a visually hidden table with the same
  numbers.

  9. Budgets
  - Month selector; for a past month a hint chip "Editing a past month".
  - Table (desktop) / cards (mobile): Category (icon + name), Limit (click → inline number field,
  Enter saves, Esc cancels), Spent, Remaining ("−45,00 zł over" in red when over), Usage bar, Status
  ("Almost there" amber / "Over" red / none for OK).
  - Total row: limits, spent, remaining. Above the table for the current month: "You can spend ~45
  zł/day for the next 12 days." or "You've used your whole budget for October."
  - Collapsed section "Spending without a budget · 340,00 zł": rows with icon, name, spent and a
  "Set limit" text button; hidden categories show a "Hidden" badge and no button.
  - Empty month: "No budgets for November yet." + primary "Copy from October" + "Start from scratch".
  - Top bar "Add" opens "Set a limit": category select (expense categories without a limit) +
  amount.

  10. Alerts bell (top bar, every page)
  - Bell icon with a small red badge showing the unread count (hidden at 0). Opens a dropdown list:
  each alert with category icon, text, relative date, unread dot; "Mark all as read" at the top;
  empty: "No alerts yet."

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
