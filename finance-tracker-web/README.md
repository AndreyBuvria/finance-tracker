# Finance Tracker — Web

Angular frontend for Finance Tracker. The API lives in the sibling folder `finance-tracker-api/` of the same repo.
Specs are in `.claude/docs/` at the repo root (`../.claude/docs/PLAN.md`, `../.claude/docs/FEATURES.md`, `../.claude/docs/DESIGN.md`); coding rules are in `CLAUDE.md`.

## Prerequisites

- Node.js `^24.15.0` or `>=26` (required by Angular 22; `.nvmrc` pins major 24 → `nvm use`)
- npm 11
- The API running on `http://localhost:5080` for anything that calls the backend

## Commands

```bash
npm ci               # install exact dependencies from package-lock.json
npm start            # ng serve on http://localhost:4200; /api is proxied to http://localhost:5080 (proxy.conf.json)
npm test             # Vitest unit tests (watch mode); CI: npx ng test --watch=false
npm run lint         # angular-eslint (TypeScript + templates + accessibility)
npm run build        # production build into dist/
npm run extract-i18n # extract UI text into src/locale/messages.xlf
```

## Structure

```
src/app/
  common/          shared non-UI code: services, API config, locale, time, formatting, pipes  (import: @common/...)
  infrastructure/  shared UI building blocks: layout/shell, cards, empty states            (import: @infrastructure/...)
  pages/<page>/    one folder per page, lazy-loaded via <page>.routes.ts; its components live inside it
```

Dependency direction: `pages → infrastructure → common`. A page never imports another page.
Full rules: `CLAUDE.md` → "Project structure".

## Conventions worth knowing

- **Current date/time**: inject `ClockService` (`@common/time/clock.service`). `new Date()` / `Date.now()` are lint errors elsewhere.
  In tests use `provideFakeClock('2026-10-19T10:00:00')` from `@common/time/testing/fake-clock`.
- **API URL**: inject `API_BASE_URL` (`@common/config/api-config`); it is `/api` in every environment.
- **Locale**: the UI is English (`en-GB`); money is always Polish.
  - Money: `{{ amount | money }}` → `1 234,56 zł`; `'expense'` → `−24,00 zł`, `'income'` → `+7 500,00 zł`, `'transfer'` → no sign.
  - Dates: `{{ date | date }}` → `19 Oct 2026` (app default); `{{ date | date: MONTH_FORMAT }}` → `October 2026`.
  - Weeks start on Monday (Material date adapter).
- **UI text**: lives in templates with `i18n` attributes or `$localize` in code, with explicit `@@ids`; run `npm run extract-i18n`.
- **Theme**: Angular Material M3 with a teal primary (`src/styles/_theme-colors.scss`, generated from `#00796b`).
