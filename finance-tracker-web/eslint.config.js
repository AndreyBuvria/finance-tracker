// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

// Imports banned everywhere (CLAUDE.md). Reused by the layer rules below, because a later
// `no-restricted-imports` entry replaces the earlier one instead of merging with it.
const restrictedPaths = [
  {
    name: '@angular/common',
    importNames: ['CommonModule', 'NgClass', 'NgStyle'],
    message: 'Import only the directives/pipes you use; use class/style bindings (CLAUDE.md).',
  },
  {
    name: '@angular/forms',
    importNames: ['FormsModule', 'NgModel'],
    message: 'Use typed Reactive Forms (CLAUDE.md).',
  },
];

// Syntax banned everywhere outside tests (CLAUDE.md): tests may build fixed dates as fixtures.
const clockSyntax = [
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: 'Read the current date from ClockService (common/time), never new Date().',
  },
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: 'Read the current time from ClockService (common/time), never Date.now().',
  },
];

// Decorator options banned everywhere, tests included (CLAUDE.md).
const decoratorSyntax = [
  {
    selector: "Decorator Property[key.name='standalone'][value.value=true]",
    message: 'Do not set standalone: true; it is the default (CLAUDE.md).',
  },
  {
    selector:
      "Decorator Property[key.name='changeDetection'] MemberExpression[property.name='OnPush']",
    message: 'Do not set OnPush explicitly; it is the default in Angular v22+ (CLAUDE.md).',
  },
];

// Shared for the same reason as restrictedPaths: a later `no-restricted-syntax` entry replaces the earlier one.
const restrictedSyntax = [...clockSyntax, ...decoratorSyntax];

// Layer boundaries (CLAUDE.md → Project structure): pages → infrastructure → common;
// src/styles imports nothing from src/app.
const layerRule = (patterns) => ['error', { paths: restrictedPaths, patterns }];

const MAX_DEPTH = 6;

/**
 * Relative imports may not climb out of `root` (a feature folder, or src/styles).
 * ESLint matches import strings, not resolved paths, so one config block per folder depth bans
 * as many `../` as it takes to leave `root` from that depth:
 * `pages/auth/login/x.ts` may use `../common/…` (still inside the feature) but not `../../…`.
 * The first block is a catch-all for every file under `root`; the per-depth blocks after it
 * replace it for depths below MAX_DEPTH. Files nested MAX_DEPTH or more folders deep keep the
 * catch-all, which bans MAX_DEPTH + 1 or more `../` (exact at depth MAX_DEPTH, stricter below it).
 */
const stayInside = (root, message) => [
  {
    files: [`${root}/**/*.ts`],
    pattern: { regex: `^(\\.\\./){${MAX_DEPTH + 1},}`, message },
  },
  ...Array.from({ length: MAX_DEPTH }, (_, depth) => ({
    files: [`${root}/${'*/'.repeat(depth)}*.ts`],
    pattern: { regex: `^(\\.\\./){${depth + 1}}`, message },
  })),
];

const LEAVE_FEATURE =
  'Do not leave the feature with a relative import. Use @common/*, @infrastructure/* or @styles/*; ' +
  'a feature never imports another feature (CLAUDE.md → Project structure).';
const LEAVE_STYLES = 'src/styles must not import from src/app (CLAUDE.md → Project structure).';
const APP_ALIASES = {
  regex: '^@(common|infrastructure|pages)/',
  message: LEAVE_STYLES,
};
// `@pages/*` is only for the app root (e.g. lazy routes in app.routes.ts).
const pagesAlias = (message) => ({ regex: '^@pages(/|$)', message });
const PAGES_ALIAS_IN_FEATURE =
  'Do not use @pages/* inside a feature. Import your own feature files relatively; ' +
  'a feature never imports another feature (CLAUDE.md → Project structure).';
const PAGES_ALIAS_IN_LAYER = (layer) =>
  `${layer} must not depend on pages/ (CLAUDE.md → Project structure).`;
// `no-restricted-imports` does not check `import()`, so lazy imports of `@pages/*` are banned via
// syntax, both as a string literal and as a template literal (`@pages/${name}/…`).
const LAYER_FILES = [
  'src/app/pages/**/*.ts',
  'src/app/common/**/*.ts',
  'src/app/infrastructure/**/*.ts',
  'src/styles/**/*.ts',
];
const DYNAMIC_PAGES_IMPORT_MESSAGE =
  '@pages/* is only for the app root (e.g. app.routes.ts). Features import their own files ' +
  'relatively; common/, infrastructure/ and src/styles never depend on pages/ (CLAUDE.md → Project structure).';
const DYNAMIC_PAGES_IMPORTS = [
  {
    selector: 'ImportExpression[source.value=/^@pages\\b/]',
    message: DYNAMIC_PAGES_IMPORT_MESSAGE,
  },
  {
    selector:
      "ImportExpression[source.type='TemplateLiteral'][source.quasis.0.value.raw=/^@pages\\b/]",
    message: DYNAMIC_PAGES_IMPORT_MESSAGE,
  },
];

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      // Conventions from CLAUDE.md
      '@angular-eslint/prefer-inject': 'error',
      '@angular-eslint/prefer-output-readonly': 'error',
      '@angular-eslint/prefer-signals': 'error',
      '@angular-eslint/use-injectable-provided-in': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': ['error', { paths: restrictedPaths, patterns: [] }],
      'no-restricted-syntax': ['error', ...restrictedSyntax],
    },
  },
  {
    files: ['src/app/common/**/*.ts'],
    rules: {
      'no-restricted-imports': layerRule([
        {
          regex: '^(@infrastructure/|\\.{1,2}/(.*/)?(infrastructure|pages)/)',
          message:
            'common/ must not depend on infrastructure/ or pages/ (CLAUDE.md → Project structure).',
        },
        pagesAlias(PAGES_ALIAS_IN_LAYER('common/')),
      ]),
    },
  },
  {
    files: ['src/app/infrastructure/**/*.ts'],
    rules: {
      'no-restricted-imports': layerRule([
        {
          regex: '^\\.{1,2}/(.*/)?pages/',
          message: 'infrastructure/ must not depend on pages/ (CLAUDE.md → Project structure).',
        },
        {
          regex: '^\\.{1,2}/(.*/)?common/',
          message: 'Import common code through the @common/* alias.',
        },
        pagesAlias(PAGES_ALIAS_IN_LAYER('infrastructure/')),
      ]),
    },
  },
  // `pages/<feature>/*` sits one level below `pages/`, so the feature root is `src/app/pages/*`.
  ...stayInside('src/app/pages/*', LEAVE_FEATURE).map(({ files, pattern }) => ({
    files,
    rules: {
      'no-restricted-imports': layerRule([pattern, pagesAlias(PAGES_ALIAS_IN_FEATURE)]),
    },
  })),
  ...stayInside('src/styles', LEAVE_STYLES).map(({ files, pattern }) => ({
    files,
    rules: { 'no-restricted-imports': layerRule([pattern, APP_ALIASES]) },
  })),
  {
    files: LAYER_FILES,
    rules: { 'no-restricted-syntax': ['error', ...restrictedSyntax, ...DYNAMIC_PAGES_IMPORTS] },
  },
  {
    // Tests may build dates from the real clock as fixtures; the decorator bans still apply.
    files: ['**/*.spec.ts'],
    rules: { 'no-restricted-syntax': ['error', ...decoratorSyntax] },
  },
  {
    files: LAYER_FILES.map((glob) => glob.replace(/\*\.ts$/, '*.spec.ts')),
    rules: { 'no-restricted-syntax': ['error', ...decoratorSyntax, ...DYNAMIC_PAGES_IMPORTS] },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {
      '@angular-eslint/template/prefer-control-flow': 'error',
      '@angular-eslint/template/prefer-ngsrc': 'error',
      '@angular-eslint/template/prefer-self-closing-tags': 'error',
      '@angular-eslint/template/button-has-type': 'error',
    },
  },
]);
