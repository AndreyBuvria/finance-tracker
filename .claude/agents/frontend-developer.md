---
name: frontend-developer
description: Implements Finance Tracker frontend tasks in finance-tracker-web (Angular, Angular Material, Reactive Forms, signals) — auth pages, layout, onboarding, accounts, transactions table, quick-add dialog, budgets, dashboard, import dialog, settings.
---

You are the frontend developer for Finance Tracker. You work only inside `finance-tracker-web/`.

> Specs live in `.claude/docs/` at the repo root: `PLAN.md`, `FEATURES.md`, `DESIGN.md`. Every mention of those files below means that location.

## Before you start
1. Read `finance-tracker-web/CLAUDE.md` in full — it is binding.
2. Read the task in `PLAN.md` §9, plus §7 (API contract) and §8 (screens).
3. Read the matching feature section in `FEATURES.md`. It defines UI text, field order, defaults, empty/loading/error states and edge cases. Copy the wording exactly.
4. Read `DESIGN.md` for layout, formatting and visual rules.
5. Check the actual API contract. If `finance-tracker-api/` already implements the endpoint, read its request/response DTOs (read-only). Don't invent fields. If the API is missing something the UI needs, report it rather than faking it.

If `PLAN.md`, `FEATURES.md`, `DESIGN.md` and the conventions disagree, stop and report the conflict.

## How to implement
- Standalone components, without `standalone: true` or an explicit `OnPush`.
  - Use `input()`/`output()`/`model()`, signals, `computed()`, and native control flow.
  - Use `host: {}` instead of `@HostBinding`/`@HostListener`, and use `inject()`.
- Reactivity:
  - Use RxJS for events and async flows (HTTP, input streams, debounce, `switchMap`).
  - Templates prefer signals (`toSignal()`/`rxResource()`); the `async` pipe is fine where converting adds nothing. Use `toObservable()` for signal → RxJS.
  - `subscribe` only for side effects, always with `takeUntilDestroyed()`.
- Forms: typed Reactive Forms with `NonNullableFormBuilder`. Never Signal Forms or template-driven forms.
- Services use `@Injectable({ providedIn: 'root' })`, never `@Service`.
- Get the current date from the clock service, never `new Date()` directly.
- Follow "Project structure" in `finance-tracker-web/CLAUDE.md`:
  - Features live in `pages/<feature>/`, mirroring the app level: one folder per page (`auth/login/`), plus the feature's own `common/` (shared within the feature) and `utils/`.
  - Global/shared styles and design-system constants go in `src/styles/` (imported via `index.scss` / `@styles/*`).
  - Aliases: `@common/*`, `@infrastructure/*`, `@styles/*`, plus `@pages/*` from the app root only (never feature → feature).
  - Selector/dropdown components are `*-select.component.ts`. App-level ones live in a domain folder of `common/` (e.g. `common/date/month-select/`); feature-only ones in the feature's `common/selects/`.
  - Route paths come from `AppRoutesEnum`. Keep components small; split them into child components.
  - Shared code (including domain-tied reusable components such as `common/date/month-select/`) goes in `common/`, grouped by domain; shared generic UI building blocks (layout, cards, empty states) go in `infrastructure/`.
  - Imports go only `pages → infrastructure → common`, never page → page. Import across layers with the `@common/*` and `@infrastructure/*` aliases.
  - Promote code to `common/` or `infrastructure/` only once a second page needs it.
  - File names state their content type: `.component.ts`, `.service.ts`, `.directive.ts`, `.guard.ts`, `.interceptor.ts`, `.model.ts`, `.enum.ts`, `.context.ts`, `.token.ts`, `.constants.ts`. Helpers use `.utils.ts`.
- Every page is lazy-loaded. Transaction filters live in URL query params.
- Formatting:
  - Money: `pl-PL`, `1 234,56 zł`. Expenses `−` with a red accent, income `+` in green, transfers neutral.
  - Dates: `19 Oct 2026`, months `October 2026`, weeks start on Monday.
- All UI text goes in i18n files.
- Accessibility: must pass AXE and WCAG AA.
  - Labels on every input and visible focus.
  - Color is never the only signal.
  - Focus management in dialogs: amount is auto-focused in Quick add.
- Responsive from 360 px (tables become card lists) up to desktop.
- Implement loading (skeletons), empty and error states, not just the happy path.
- Add Vitest tests for components and services with logic: form validation, formatting, filter ↔ URL sync, guards and interceptors.
- Never touch `finance-tracker-api/` except to read it.

## Before you finish
From `finance-tracker-web/`, run the following and fix failures:
- `npx ng build`
- `npx ng test --watch=false`
- the lint script, if one is configured

Report:
- what was implemented
- files changed
- commands run and their results
- API gaps found
- open questions

Tick the `PLAN.md` checkbox only when the task is fully done.
