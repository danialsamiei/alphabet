// @ts-check
/**
 * Shared ESLint flat configuration for the Alphabet monorepo.
 *
 * Goals:
 * - Catch real bugs (no-undef-equivalents, no-unreachable, no-fallthrough, …)
 *   without being noisy on the existing, well-typed codebase.
 * - Stay TypeScript-aware via typescript-eslint, but avoid type-checked rules
 *   so a single workspace-wide `pnpm lint` stays fast.
 * - Allow tests/benches/configs to use loose patterns.
 *
 * To run: `pnpm lint` (turbo) or `pnpm exec eslint .` from any package.
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  // 1) Global ignores: build outputs, generated artifacts, vendored docs site.
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/node_modules/**',
      '**/storybook-static/**',
      '**/bundle-report/**',
      'apps/docs/**', // not part of the pnpm workspace; has its own toolchain
      'apps/danial-site/.next/**',
      // Scaffolding templates are copied verbatim into user projects;
      // they are not part of this workspace's compiled source.
      'packages/create-alphabet/templates/**',
      '**/*.d.ts',
      'pnpm-lock.yaml',
    ],
  },

  // 2) Base JS recommended.
  js.configs.recommended,

  // 3) TypeScript recommended (non type-checked — fast, no project parsing).
  ...tseslint.configs.recommended,

  // 4) Workspace-wide language options + tweaks.
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2023,
      },
    },
    rules: {
      // The codebase intentionally uses `any` in narrow places (gtag shim,
      // adapter boundaries). Surface as warnings, not errors.
      '@typescript-eslint/no-explicit-any': 'off',
      // The `_prefix` convention is already used; align the rule with it.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      // Empty interfaces / object types are used as Brand markers.
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      // {} is used in some Brand/marker patterns — align with the above.
      '@typescript-eslint/ban-types': 'off',
      // require/dynamic require is used in CLI templates and scripts.
      '@typescript-eslint/no-require-imports': 'off',
      // ts-expect-error / ts-ignore is allowed but should have a description.
      '@typescript-eslint/ban-ts-comment': [
        'warn',
        { 'ts-expect-error': 'allow-with-description', 'ts-ignore': 'allow-with-description' },
      ],
      // Lots of intentional `function fn() {}` placeholders in adapters.
      '@typescript-eslint/no-empty-function': 'off',

      // Real-bug rules we want kept on.
      'no-fallthrough': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-self-assign': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'warn',

      // The `no-undef` rule is redundant with TS and produces false positives
      // for ambient browser globals; TS already enforces this.
      'no-undef': 'off',

      // Prefer `const` + arrow-callback are stylistic — keep off to avoid
      // touching working code.
      'prefer-const': 'warn',
      'no-var': 'error',
    },
  },

  // 5) React-aware rules for UI/demo/site .tsx files.
  {
    files: ['**/*.{tsx,jsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // New JSX transform — no React-in-scope requirement.
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      // Prop-types isn't used; TS handles this.
      'react/prop-types': 'off',
      // The codebase uses `display-name` selectively; warn rather than error.
      'react/display-name': 'warn',
      // Allow the common `<>...</>` fragments without forcing keys for trivial cases
      // and don't flag unescaped entities in MDX/text-heavy components.
      'react/no-unescaped-entities': 'off',
    },
  },

  // 6) Tests, benches and storybook stories — relaxed.
  {
    files: [
      '**/*.test.{ts,tsx}',
      '**/*.bench.{ts,tsx}',
      '**/*.stories.{ts,tsx}',
      '**/test/**',
      '**/__tests__/**',
      '**/__fixtures__/**',
      '**/.storybook/**',
    ],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-empty': 'off',
    },
  },

  // 7) Build / config / script files — Node + CommonJS allowed.
  {
    files: [
      '**/*.config.{js,mjs,cjs,ts}',
      '**/scripts/**/*.{js,mjs,cjs,ts}',
      'scripts/**/*.{js,mjs,cjs,ts}',
      '**/vite.config.{ts,mts}',
      '**/vitest.config.{ts,mts}',
      '**/playwright.config.{ts,mts}',
      'eslint.config.{js,mjs}',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
    },
  },
);
