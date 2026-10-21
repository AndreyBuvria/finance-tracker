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

// Layer boundaries (CLAUDE.md → Project structure): pages → infrastructure → common.
const layerRule = (patterns) => ['error', { paths: restrictedPaths, patterns }];

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
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Read the current date from ClockService (common/time), never new Date().',
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'Read the current time from ClockService (common/time), never Date.now().',
        },
        {
          selector: "Decorator Property[key.name='standalone'][value.value=true]",
          message: 'Do not set standalone: true; it is the default (CLAUDE.md).',
        },
        {
          selector:
            "Decorator Property[key.name='changeDetection'] MemberExpression[property.name='OnPush']",
          message: 'Do not set OnPush explicitly; it is the default in Angular v22+ (CLAUDE.md).',
        },
      ],
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
      ]),
    },
  },
  {
    files: ['src/app/pages/**/*.ts'],
    rules: {
      'no-restricted-imports': layerRule([
        {
          regex: '^\\.{1,2}/(.*/)?pages/',
          message:
            'A page must not import another page. Move shared code to common/ or infrastructure/ (CLAUDE.md → Project structure).',
        },
        {
          regex: '^\\.{1,2}/(.*/)?(common|infrastructure)/',
          message: 'Import shared code through the @common/* and @infrastructure/* aliases.',
        },
      ]),
    },
  },
  {
    // Tests may compare against the real clock.
    files: ['**/*.spec.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
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
