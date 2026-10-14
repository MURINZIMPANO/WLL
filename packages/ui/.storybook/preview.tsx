import '../src/styles/globals.css';

import type { Preview } from '@storybook/react-vite';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

/**
 * Global Storybook chrome.
 *
 * Every story is rendered inside the real token stylesheet, and the dark/light
 * toolbar switches the same `.dark` / `.light` class the apps use — so a
 * contrast problem shows up in Storybook exactly as it would in production.
 */

const withTheme: Preview['decorators'] = [
  (Story, context) => {
    const theme = (context.globals['theme'] as 'dark' | 'light') ?? 'dark';

    useEffect(() => {
      const root = document.documentElement;
      root.classList.remove('dark', 'light');
      root.classList.add(theme);
      return () => {
        root.classList.remove('dark', 'light');
      };
    }, [theme]);

    return (
      <div className="app-vignette relative min-h-dvh bg-bg-900 p-6 text-text-high">
        <Story />
      </div>
    );
  },
] satisfies Array<(story: () => ReactNode, context: never) => ReactNode>;

const preview: Preview = {
  decorators: withTheme,
  parameters: {
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    a11y: {
      config: {
        rules: [{ id: 'region', enabled: false }],
      },
    },
    layout: 'fullscreen',
  },
  globalTypes: {
    theme: {
      description: 'Colour theme',
      defaultValue: 'dark',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'dark', title: 'Dark' },
          { value: 'light', title: 'Light' },
        ],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;
