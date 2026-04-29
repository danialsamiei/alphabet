/**
 * @file .storybook/main.ts
 * @description
 * Storybook 8 configuration for `@alphabet/ui`. Uses the React + Vite
 * builder for parity with the package's existing build pipeline.
 *
 * Addons:
 * - `@storybook/addon-essentials` (controls, actions, viewport, …)
 * - `@storybook/addon-a11y` for axe-core based WCAG checks
 * - `@storybook/addon-interactions` for play-function debugging
 *
 * Chromatic uses `build-storybook` output unchanged; no extra config
 * is required here.
 */

import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx|mdx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: { autodocs: 'tag' },
  typescript: { reactDocgen: 'react-docgen' },
};

export default config;
