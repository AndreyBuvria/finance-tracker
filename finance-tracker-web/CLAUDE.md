# Finance Tracker — Frontend (`finance-tracker-web`)

Angular app for Finance Tracker, in a monorepo; the API lives in the sibling folder `finance-tracker-api/`. Shared specs are in `.claude/docs/` at the repo root: `../.claude/docs/PLAN.md` (order, API, rules), `../.claude/docs/FEATURES.md` (behavior, UI text, edge cases), `../.claude/docs/DESIGN.md` (UI design brief). Read the relevant `FEATURES.md` section before building a screen.

## Project structure

```
src/
  styles/                      global styles and the design system (import via @styles/... from TS)
    index.scss                 the global stylesheet entry; @use/@forward every partial below
    _theme-colors.scss, _semantic-colors.scss, modal.scss, ...
    category-palette.constants.ts, category-icons.constants.ts, budget-status.constants.ts, *.model.ts, ...   design-system constants and types
  app/
    app.component.ts, app.routes.ts, app.config.ts    app root
    authenticated-layout.component.ts       route-level composition of the layout with auth (app root is allowed for this)
    common/                    shared code, grouped by domain (import via @common/...)
      auth/ config/ date/ locale/ time/ formatting/ pipes/ routing/ ...
      date/month-select/month-select.component.ts   e.g. a reusable date-related component
    infrastructure/            shared UI building blocks (import via @infrastructure/...)
      layout/ directives/ cards/ empty-state/ ...
    pages/                     one folder per feature
      <feature>/
        <feature>.routes.ts                lazy-loaded from app.routes.ts
        <page>/<page>.component.ts         one folder per routed page of the feature (e.g. auth/login, auth/register)
        common/<kind>/<name>/<name>.component.ts  components (and services/models) shared by pages of this feature, grouped by kind (e.g. common/selects/<name>-select/)
        utils/<name>.utils.ts              helpers used by this feature only
```

A feature mirrors the app-level layout: its own `common/` and `utils/` folders, and one folder per page. A feature with a single page may keep that page's component at the feature root (e.g. `pages/dashboard/dashboard.component.ts`).

- **`src/styles/`** holds global styles and the design system:
  - theme and semantic color tokens;
  - styles shared by many places or tied to a common feature, e.g. a modal window → `src/styles/modal.scss`, imported in `index.scss`;
  - spec-defined design-system constants: the category color palette (hex), the category icon set and budget status visuals.

  Component-specific styles stay next to their component.
- **`common/`** (app level) holds shared code grouped by domain folder: services, API clients and models used by more than one feature, interceptors, guards, the route enum, locale/time/formatting helpers, pipes, and reusable components tied to a domain (e.g. `common/date/month-select/`). It is not limited to non-UI code.
- **`infrastructure/`** holds shared UI building blocks: layout (header, navigation), shared directives, generic cards, empty states, skeleton loaders, confirm dialog. These are presentational and generic. They get data through `input()` and report through `output()`. They have no feature-specific logic and don't call feature APIs.
- **`pages/<feature>/`** holds the screens. A page composes things from the app-level `common/`, `infrastructure/` and `src/styles/` with its feature's own `common/` and `utils/`.
- **All components are feature-specific.** A component belongs to the feature that uses it:
  - in the page folder if only that page uses it;
  - in the feature's `common/` if several pages of the feature use it.
- **Promoting shared code.** When a second feature needs a component or directive, make it generic and move it to `infrastructure/`. When a second feature needs a service, model or helper, move it to the app-level `common/`. Don't promote "in case" it gets reused.
- **Keep components small.** Split a large component into focused child components (e.g. the layout is composed of a header component and a navigation component). Encapsulate a piece of logic in its own component when that makes the parent clearer.
- **Dependency direction.** Imports go only `pages → infrastructure → common`. `src/styles/` may be imported from anywhere and imports nothing from `src/app`.
  - `common/` imports nothing from the other two.
  - `infrastructure/` never imports from `pages/`.
  - **A feature never imports from another feature.**
- **Import paths.**
  - Import app-level code with the `@common/*`, `@infrastructure/*` and `@styles/*` aliases.
  - Import features from the app root (e.g. lazy routes in `app.routes.ts`) with `@pages/*`, e.g. `@pages/onboarding/...`.
  - Inside a feature, use relative imports for the feature's own files. Never use `@pages/*` to reach another feature.
  - Use relative imports only inside the same feature or the same layer.
- **Routes.** Route paths are defined once in `AppRoutesEnum` (`common/routing/app-routes.enum.ts`); never hard-code a path string elsewhere.
- **Enforcement.** ESLint enforces the layer boundaries. Anything lint can't catch (e.g. a short relative path into a sibling feature) is checked by the reviewer.
- **File naming: the file name states the type of its content** (classic Angular convention):
  - Use `name.<type>.ts`:
    - `account.component.ts`, with `.component.html`, `.component.scss` and `.component.spec.ts` (class `AccountComponent`);
    - `.service.ts`, `.directive.ts`, `.pipe.ts`, `.guard.ts`, `.interceptor.ts`, `.routes.ts`;
    - `.model.ts` (interfaces and types), `.enum.ts`;
    - `.context.ts` for `HttpContextToken`s, e.g. `auth.context.ts`;
    - `.token.ts` for `InjectionToken`s;
    - `.adapter.ts` for adapter classes, e.g. `monday-first.adapter.ts` (a Material `DateAdapter`);
    - `.constants.ts` for constant values.
  - Selector/dropdown components are named `<name>-select.component.ts` (e.g. `month-select.component.ts`, class `MonthSelectComponent`).
  - Files with plain functions/helpers use `.utils.ts` (`money.utils.ts`, tested in `money.utils.spec.ts`).
  - Test helpers and fakes follow the same rule (e.g. `fake-clock.service.ts` if it is a service double).
- **Header actions.** The layout only renders structure; it never knows what an action does. A `HeaderActionsService` in `infrastructure/layout/` holds the current page's actions (label, icon, optional keyboard shortcut, handler). The layout renders them (top-bar buttons on desktop, the floating "+" for the primary action on mobile) and calls the handler; it also routes the `N` shortcut to the primary action. Each page registers its own actions on init and they are cleared when the page is destroyed. Pages without actions register none, so no button shows.
- **Dialogs are per purpose and live in their feature.** One dialog component per entity (transaction quick add, account dialog), not one component switching fields by type. Each lives in its feature under `pages/` (e.g. `pages/transactions/common/dialogs/quick-add-dialog/`, also reused pre-filled for edit; the account dialog in `pages/accounts/`). The feature injects `HeaderActionsService` to register and handle its own actions. Another feature that needs the dialog (Dashboard "Add", onboarding "Add a transaction manually") navigates to that feature's route with an intent query param (e.g. `/transactions?add=1`) instead of importing it; the owning page opens the dialog and removes the param.
- **Feature dialogs** live in the feature's `common/dialogs/<name>/` even when only one page of the feature uses them (e.g. `pages/settings/common/dialogs/category-dialog/`).
- **Datepicker labels:** `provideLocalizedDatepickerIntl()` (`common/locale/`) is added to the providers of each lazy route that uses a datepicker, not app-wide (app-wide pulls the datepicker into the initial bundle and breaks the budget).
- **Feature used across pages:** if a case doesn't fit these rules, ask before choosing where it lives.

## Angular frontend conventions

You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly. `OnPush` is the default in Angular v22+.
- Use signals for state management
- Implement lazy loading for every feature (`pages/<feature>/<feature>.routes.ts` via `loadChildren`)
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

## Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `model()` for two-way bound properties with `[(prop)]` syntax instead of pairing `input()` with `output()`
- Use `computed()` for derived state
- Use `linkedSignal()` for state derived from multiple reactive sources that must stay synchronized
- Prefer inline templates for small components
- Use typed Reactive Forms (`FormGroup`/`FormControl`, `NonNullableFormBuilder`) for all forms. Do NOT use Signal Forms or Template-driven forms
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- Do NOT import `CommonModule`, import only the directives and pipes the template uses, such as `AsyncPipe` or `DatePipe`
- When using external templates/styles, use paths relative to the component TS file.

## Reactivity: RxJS for events, signals preferred for display

- **RxJS handles events and async flows:** HTTP calls, user-input streams (search with `debounceTime`, filter changes), and combining or cancelling work (`switchMap`, `combineLatest`). Services expose HTTP results as observables.
- **Templates prefer signals.** Turn an observable into a signal with `toSignal()` (or `rxResource()` for request-style loading) and read the signal in the template. When converting adds nothing (e.g. a simple stream that is only displayed), binding the observable with the `async` pipe is fine.
- **Signal → RxJS:** when signal state has to drive an RxJS pipeline (e.g. a filter signal feeding a debounced HTTP request), use `toObservable()`.
- **No manual subscribe-and-assign** to push values into fields or signals for display. Use `subscribe` only for side effects (navigation, snackbar, saving), and always clean up with `takeUntilDestroyed()`.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables (prefer signals where it fits; see "Reactivity")
- Do not assume globals like (`new Date()`) are available. Get the current date/time from the injectable clock service so tests can control "today".

## Testing

- Use Vitest (Angular CLI default). Do NOT use Jasmine/Karma or Jest.

## Services

- Design services around a single responsibility
- Use `@Injectable({ providedIn: 'root' })` for singleton services. Do NOT use the `@Service` decorator
- Use the `inject()` function instead of constructor injection
