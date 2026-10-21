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
src/
  styles/                     global styles + design system (import: @styles/...)
    index.scss                global stylesheet entry (angular.json → styles); @use's the partials
    _theme.scss, _theme-colors.scss, _semantic-colors.scss, _base.scss, _a11y.scss
    category-palette.constants.ts, category-icons.constants.ts, budget-status.constants.ts,
    *.model.ts, testing/contrast.utils.ts
  app/
    app.component.ts, app.config.ts, app.routes.ts, authenticated-layout.component.ts   app root (imports features via @pages/...)
    common/                   shared code grouped by domain: auth, config, date (incl. month-select), locale, time, formatting, pipes, routing (import: @common/...)
    infrastructure/           shared UI building blocks: layout (header, navigation, account menu)   (import: @infrastructure/...)
    pages/<feature>/          one folder per feature, lazy-loaded via <feature>.routes.ts
      <page>/                 one folder per routed page (a single-page feature keeps it at the feature root)
      common/<kind>/<name>/   components/directives/models shared by this feature's pages, grouped by kind
                              (e.g. common/selects/<name>-select/)
      utils/                  helpers used by this feature only (*.utils.ts)
```

Dependency direction: `pages → infrastructure → common`; `src/styles` may be imported from anywhere and imports nothing
from `src/app`. A feature never imports another feature. ESLint enforces this: app-level code is imported through the
aliases (`@common/*`, `@infrastructure/*`, `@styles/*`), and a relative import may not climb out of its feature (or out
of `src/styles`). `@pages/*` is only for the app root (e.g. lazy routes in `app.routes.ts`); features, `common/`,
`infrastructure/` and `src/styles` may not use it (a feature imports its own files relatively).
Full rules: `CLAUDE.md` → "Project structure".

**File names state their content type**: `*.component.ts|html|scss|spec.ts` (class `NameComponent`), `*.service.ts`,
`*.directive.ts`, `*.pipe.ts`, `*.guard.ts`, `*.interceptor.ts`, `*.routes.ts`, `*.model.ts`, `*.enum.ts`,
`*.context.ts` (HttpContextToken), `*.token.ts` (InjectionToken), `*.adapter.ts` (adapter classes, e.g.
`monday-first.adapter.ts`), `*.constants.ts`, `*.utils.ts` (plain functions). Selector/dropdown components are named
`<name>-select.component.ts` (e.g. `month-select.component.ts`, class `MonthSelectComponent`).

## Conventions worth knowing

- **Routes**: every path lives in `AppRoutesEnum` (`@common/routing/app-routes.enum`) as an absolute URL
  (`AppRoutesEnum.Login` → `/auth/login`). Use it for links, navigation and redirects; route configs get their `path`
  from `routeSegment(AppRoutesEnum.Login, AppRoutesEnum.Auth)` → `'login'`. Never hard-code a path string.
- **Current date/time**: inject `ClockService` (`@common/time/clock.service`). `new Date()` / `Date.now()` are lint errors elsewhere.
  In tests use `provideFakeClock('2026-10-19T10:00:00')` from `@common/time/testing/fake-clock.service`.
- **API URL**: inject `API_BASE_URL` (`@common/config/api-config.token`); it is `/api` in every environment.
- **Locale**: the UI is English (`en-GB`); money is always Polish.
  - Money: `{{ amount | money }}` → `1 234,56 zł`; `'expense'` → `−24,00 zł`, `'income'` → `+7 500,00 zł`, `'transfer'` → no sign.
  - Dates: `{{ date | date }}` → `19 Oct 2026` (app default); `{{ date | date: MONTH_FORMAT }}` → `October 2026`
    (`@common/formatting/date-formats.constants`).
  - Weeks start on Monday (Material date adapter).
- **UI text**: lives in templates with `i18n` attributes or `$localize` in code, with explicit `@@ids`; run `npm run extract-i18n`.
- **Theme**: Angular Material M3 with a teal primary (`src/styles/_theme-colors.scss`, generated from `#00796b`).
  Light and dark follow the OS setting (`color-scheme: light dark`). Semantic colors are CSS custom properties
  in `src/styles/_semantic-colors.scss`: `--app-color-ok|warning|over` (+ `-container` / `on-*-container`),
  `--app-color-income`, `--app-color-expense-accent`, `--app-color-transfer`.
- **Categories**: the fixed 12-color palette (`@styles/category-palette.constants`; a category stores the `#RRGGBB`
  hex) and icons (`@styles/category-icons.constants`, Material Symbols names). The default categories, with their icon and
  color, are seeded and owned by the API; the frontend reads them from `GET /categories`. Budget status visuals:
  `@styles/budget-status.constants`.
- **Auth**: `@common/auth`: `AuthService`, `authInterceptor` (bearer token, silent refresh, redirect to
  `/auth/login?returnUrl=…`), `authGuard` / `guestGuard`. The access token lives in memory; the refresh token in
  `localStorage` (`ft.refreshToken`), or in memory when storage is blocked.
- **Quick add**: the layout's "Add" button, mobile "+" and the `N` shortcut emit `addRequested`; not wired to a dialog yet.
  `N` is ignored while typing and inside widgets that use letter keys (`[role=combobox|listbox|textbox|menu|radiogroup|grid]`,
  `mat-select`) or an open overlay.
