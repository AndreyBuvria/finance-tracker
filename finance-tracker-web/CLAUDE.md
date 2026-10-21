# Finance Tracker — Frontend (`finance-tracker-web`)

Angular app for Finance Tracker, in a monorepo; the API lives in the sibling folder `finance-tracker-api/`. Shared specs are in `.claude/docs/` at the repo root: `../.claude/docs/PLAN.md` (order, API, rules), `../.claude/docs/FEATURES.md` (behavior, UI text, edge cases), `../.claude/docs/DESIGN.md` (UI design brief). Read the relevant `FEATURES.md` section before building a screen.

## Project structure

```
src/app/
  common/                      shared non-UI code (import via @common/...)
    config/ locale/ time/ formatting/ pipes/   (later: api/, auth/, models/)
  infrastructure/              shared UI building blocks (import via @infrastructure/...)
    layout/ cards/ empty-state/ skeleton/ ...
  pages/                       one folder per page/route
    <page>/
      <page>.routes.ts         lazy-loaded from app.routes.ts
      <page>-page.ts           the routed page component
      components/<name>/       components used only by this page
      data/                    API service, models and state used only by this page
```

- **`common/`** holds everything shared that is not UI: services, API clients and models used by more than one page, interceptors, guards, locale/time/formatting helpers, pipes, utilities.
- **`infrastructure/`** holds shared UI building blocks: app shell/layout, navigation, generic cards, empty states, skeleton loaders, confirm dialog. These are presentational and generic. They get data through `input()` and report through `output()`. They have no page-specific logic and don't call page APIs.
- **`pages/`** holds the screens. A page composes things from `common/` and `infrastructure/` with its own components.
- **All components are feature-specific.** A component belongs to the page that uses it and lives in `pages/<page>/components/`.
- **Promoting shared code.** When a second page needs a component, make it generic and move it to `infrastructure/`. When a second page needs a service, model or helper, move it to `common/`. Don't put a component in `infrastructure/` "in case" it gets reused.
- **Dependency direction.** Imports go only `pages → infrastructure → common`:
  - `common/` imports nothing from the other two.
  - `infrastructure/` never imports from `pages/`.
  - **A page never imports from another page.**
- **Import paths.** Import across layers with the `@common/*` and `@infrastructure/*` aliases. Use relative imports only inside the same page or the same layer.
- **Enforcement.** ESLint (`no-restricted-imports`) enforces the boundaries. One exception it can't catch is a page reaching into a sibling page by a short relative path (`../other-page/...`), so the reviewer checks that by hand.
- **File naming:**
  - Angular artifacts keep their type suffix: `*.service.ts`, `*.pipe.ts`, `*.routes.ts`, `*-page.ts`.
  - A file that contains plain functions or helpers (not a component, service, pipe, directive or routes file) gets a `.utils` suffix: `money.utils.ts`, tested in `money.utils.spec.ts`. This applies in every layer.
- **Feature used across pages** (e.g. the Quick-add dialog opened from the layout on every screen): if the case doesn't fit these rules, ask before choosing where it lives.

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
- Implement lazy loading for every page (`pages/<page>/<page>.routes.ts` via `loadChildren`)
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

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available. Get the current date/time from the injectable clock service so tests can control "today".

## Testing

- Use Vitest (Angular CLI default). Do NOT use Jasmine/Karma or Jest.

## Services

- Design services around a single responsibility
- Use `@Injectable({ providedIn: 'root' })` for singleton services. Do NOT use the `@Service` decorator
- Use the `inject()` function instead of constructor injection
