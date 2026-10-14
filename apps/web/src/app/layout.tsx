import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';

import '@lyriclens/ui/styles.css';
import './globals.css';

export const metadata: Metadata = {
  // Phase 2 replaces this with the full marketing site; the values here are the
  // real product identity, not filler.
  title: {
    default: 'LyricLens — live lyrics, subtitles and language learning',
    template: '%s · LyricLens',
  },
  description:
    'Synced lyrics for whatever is playing, subtitles you can read along with, and a language-learning mode built on real songs. Desktop overlay, web app and PWA.',
  applicationName: 'LyricLens',
  // Phase 2 attaches the generated manifest here.
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0E140A' },
    { media: '(prefers-color-scheme: light)', color: '#F4F8EC' },
  ],
  colorScheme: 'dark light',
  width: 'device-width',
  initialScale: 1,
  // The floating tab bar sits above the home indicator on iOS.
  viewportFit: 'cover',
};

/**
 * Applies the saved theme before first paint.
 *
 * This has to be a blocking inline script in <head>: doing it in an effect
 * would paint the default theme first and then flash to the correct one. The
 * stored value is validated against a fixed allowlist before it is written to
 * the DOM, so a tampered localStorage value cannot inject a class.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('lyriclens-theme');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(theme);
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="app-vignette relative min-h-dvh bg-bg-900 text-text-high antialiased">
        {children}
      </body>
    </html>
  );
}
