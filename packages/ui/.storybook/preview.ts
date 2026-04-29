/**
 * @file .storybook/preview.ts
 * @description
 * Global Storybook preview config. Imports the opt-in Alphabet
 * stylesheets so every story renders against real design tokens, and
 * exposes globals/toolbars for theme (light/dark) and direction
 * (ltr/rtl) so reviewers can flip both axes without leaving the story.
 */

import type { Preview } from '@storybook/react';

import '../styles/tokens.css';
import '../styles/primitives.css';
import './preview.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // axe-core options — fail on serious + critical issues by default.
      element: '#storybook-root',
      config: {},
      options: {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
      },
    },
    backgrounds: {
      default: 'app',
      values: [
        { name: 'app', value: 'var(--alphabet-bg)' },
        { name: 'gradient', value: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)' },
      ],
    },
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Alphabet theme (light/dark)',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
    direction: {
      name: 'Direction',
      description: 'Document direction',
      defaultValue: 'ltr',
      toolbar: {
        icon: 'transfer',
        items: [
          { value: 'ltr', title: 'LTR' },
          { value: 'rtl', title: 'RTL' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, ctx) => {
      const theme = (ctx.globals.theme as 'light' | 'dark') ?? 'light';
      const dir = (ctx.globals.direction as 'ltr' | 'rtl') ?? 'ltr';
      // Mutating the document root is the cleanest way to drive the
      // existing `[data-alphabet-theme]` and `dir` token cascades; we
      // restore a sane default on every render so stories don't leak.
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-alphabet-theme', theme);
        document.documentElement.setAttribute('dir', dir);
      }
      return Story();
    },
  ],
};

export default preview;
