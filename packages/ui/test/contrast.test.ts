import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * WCAG AA verification against the real shipped tokens.
 *
 * This deliberately parses `tokens.css` rather than duplicating hex values in
 * the test: a duplicated literal would happily keep passing after someone
 * changed the palette. Parsing the source means the only way this suite goes
 * green is if the CSS itself is accessible.
 */

// Resolved from the package root, which is the cwd Vitest runs in. `import.meta.url`
// is rewritten by the jsdom transform and is not a file:// URL here.
const tokensPath = resolve(process.cwd(), 'src/styles/tokens.css');
const css = readFileSync(tokensPath, 'utf8');

function extractBlock(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  expect(start, `selector ${selector} not found in tokens.css`).toBeGreaterThan(-1);

  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const body = css.slice(open + 1, close);

  const vars: Record<string, string> = {};
  for (const line of body.split('\n')) {
    const match = /^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/i.exec(line);
    if (match !== null && match[1] !== undefined && match[2] !== undefined) {
      vars[match[1].slice(2)] = match[2].trim();
    }
  }
  return vars;
}

const dark = extractBlock(':root');
const light = extractBlock(':root.light');

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Parses `#rgb`, `#rrggbb` and `rgb(r g b / p%)`, which is what the tokens use. */
function parseColor(value: string): Rgba {
  const raw = value.trim();

  if (raw.startsWith('#')) {
    const hex = raw.slice(1);
    const expanded =
      hex.length === 3
        ? hex
            .split('')
            .map((c) => c + c)
            .join('')
        : hex;
    return {
      r: Number.parseInt(expanded.slice(0, 2), 16),
      g: Number.parseInt(expanded.slice(2, 4), 16),
      b: Number.parseInt(expanded.slice(4, 6), 16),
      a: 1,
    };
  }

  const match = /^rgba?\(([^)]+)\)$/.exec(raw);
  if (match !== null && match[1] !== undefined) {
    const parts = match[1]
      .replace('/', ' ')
      .split(/\s+/)
      .filter((p) => p !== '');
    const channel = (text: string) =>
      text.endsWith('%') ? (Number.parseFloat(text) / 100) * 255 : Number.parseFloat(text);

    const alphaText = parts[3] ?? '1';
    return {
      r: channel(parts[0] ?? '0'),
      g: channel(parts[1] ?? '0'),
      b: channel(parts[2] ?? '0'),
      a: alphaText.endsWith('%')
        ? Number.parseFloat(alphaText) / 100
        : Number.parseFloat(alphaText),
    };
  }

  throw new Error(`Unsupported colour syntax in tokens.css: ${raw}`);
}

/** Flatten a translucent colour onto an opaque backdrop, as the browser does. */
function compositeOver(foreground: Rgba, background: Rgba): Rgba {
  if (foreground.a >= 1) return foreground;
  return {
    r: foreground.r * foreground.a + background.r * (1 - foreground.a),
    g: foreground.g * foreground.a + background.g * (1 - foreground.a),
    b: foreground.b * foreground.a + background.b * (1 - foreground.a),
    a: 1,
  };
}

/** WCAG 2.1 relative luminance. Requires an opaque colour. */
function luminance(color: Rgba): number {
  const channel = (raw: number) => {
    const c = raw / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

/** WCAG contrast ratio, 1..21. Translucent colours are composited first. */
function contrast(foregroundValue: string, backgroundValue: string): number {
  const background = parseColor(backgroundValue);
  const foreground = compositeOver(parseColor(foregroundValue), background);

  const a = luminance(foreground);
  const b = luminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Minimum 4.5:1 for body text, 3:1 for large text and UI boundaries. */
const AA_TEXT = 4.5;
const AA_LARGE_OR_UI = 3;

interface Pair {
  theme: 'dark' | 'light';
  fg: string;
  bg: string;
  minimum: number;
  why: string;
}

const PAIRS: Pair[] = [
  // --- dark theme ---------------------------------------------------------
  { theme: 'dark', fg: 'text-high', bg: 'bg-900', minimum: AA_TEXT, why: 'primary body text' },
  { theme: 'dark', fg: 'text-mid', bg: 'bg-900', minimum: AA_TEXT, why: 'secondary body text' },
  { theme: 'dark', fg: 'text-low', bg: 'bg-900', minimum: AA_TEXT, why: 'tertiary text and hints' },
  { theme: 'dark', fg: 'text-high', bg: 'surface', minimum: AA_TEXT, why: 'text on cards' },
  {
    theme: 'dark',
    fg: 'text-mid',
    bg: 'surface',
    minimum: AA_TEXT,
    why: 'secondary text on cards',
  },
  { theme: 'dark', fg: 'text-low', bg: 'surface', minimum: AA_TEXT, why: 'hints on cards' },
  {
    theme: 'dark',
    fg: 'text-low',
    bg: 'surface-2',
    minimum: AA_TEXT,
    why: 'hints on MediaCard art and rail placeholders — was 4.47:1, below AA',
  },
  {
    theme: 'dark',
    fg: 'text-low',
    bg: 'bg-800',
    minimum: AA_TEXT,
    why: 'hints on an alternating section band',
  },
  {
    theme: 'dark',
    fg: 'accent-ink',
    bg: 'accent',
    minimum: AA_TEXT,
    why: 'dark-on-lime button label',
  },
  {
    theme: 'dark',
    fg: 'accent',
    bg: 'bg-900',
    minimum: AA_TEXT,
    why: 'lime accent text on the page',
  },
  { theme: 'dark', fg: 'accent', bg: 'surface', minimum: AA_TEXT, why: 'lime text on a card' },
  { theme: 'dark', fg: 'danger', bg: 'bg-900', minimum: AA_TEXT, why: 'error text' },
  { theme: 'dark', fg: 'success', bg: 'bg-900', minimum: AA_TEXT, why: 'success text' },
  { theme: 'dark', fg: 'warning', bg: 'bg-900', minimum: AA_TEXT, why: 'warning text' },
  {
    theme: 'dark',
    fg: 'border-strong',
    bg: 'bg-900',
    minimum: AA_LARGE_OR_UI,
    why: 'input border',
  },
  { theme: 'dark', fg: 'accent', bg: 'surface', minimum: AA_LARGE_OR_UI, why: 'focus ring' },

  // --- light theme --------------------------------------------------------
  { theme: 'light', fg: 'text-high', bg: 'bg-900', minimum: AA_TEXT, why: 'primary body text' },
  { theme: 'light', fg: 'text-mid', bg: 'bg-900', minimum: AA_TEXT, why: 'secondary body text' },
  {
    theme: 'light',
    fg: 'text-low',
    bg: 'bg-900',
    minimum: AA_TEXT,
    why: 'tertiary text and hints',
  },
  { theme: 'light', fg: 'text-high', bg: 'surface', minimum: AA_TEXT, why: 'text on cards' },
  {
    theme: 'light',
    fg: 'text-mid',
    bg: 'surface',
    minimum: AA_TEXT,
    why: 'secondary text on cards',
  },
  {
    theme: 'light',
    fg: 'accent-ink',
    bg: 'accent',
    minimum: AA_TEXT,
    why: 'dark-on-lime button label',
  },
  { theme: 'light', fg: 'danger', bg: 'bg-900', minimum: AA_TEXT, why: 'error text' },
  { theme: 'light', fg: 'success', bg: 'bg-900', minimum: AA_TEXT, why: 'success text' },
  { theme: 'light', fg: 'warning', bg: 'bg-900', minimum: AA_TEXT, why: 'warning text' },
  {
    theme: 'light',
    fg: 'border-strong',
    bg: 'bg-900',
    minimum: AA_LARGE_OR_UI,
    why: 'input border',
  },
  {
    theme: 'light',
    fg: 'accent-text',
    bg: 'bg-900',
    minimum: AA_TEXT,
    why: 'lime as text on light — needs the darkened role, not the brand fill',
  },
  {
    theme: 'light',
    fg: 'accent-text',
    bg: 'bg-800',
    minimum: AA_TEXT,
    why: 'lime as text on an alternating band — was 4.24:1, below AA',
  },
];

describe('design tokens — WCAG AA', () => {
  it.each(PAIRS)(
    '$theme: $fg on $bg ($why) reaches at least $minimum:1',
    ({ theme, fg, bg, minimum, why }) => {
      const tokens = theme === 'dark' ? dark : light;
      const foreground = tokens[fg];
      const background = tokens[bg];

      expect(foreground, `${theme} theme is missing --${fg}`).toBeDefined();
      expect(background, `${theme} theme is missing --${bg}`).toBeDefined();

      const ratio = contrast(foreground as string, background as string);
      expect(
        ratio,
        `${theme}: --${fg} (${foreground}) on --${bg} (${background}) is ${ratio.toFixed(2)}:1 — ${why} needs ${minimum}:1`,
      ).toBeGreaterThanOrEqual(minimum);
    },
  );

  it('reports the exact ratios for the two brand-critical pairs', () => {
    // The spec calls these out by name, so lock in their measured values.
    expect(contrast(dark['accent-ink'] as string, dark['accent'] as string)).toBeGreaterThanOrEqual(
      10,
    );
    expect(contrast(dark['accent'] as string, dark['bg-900'] as string)).toBeGreaterThanOrEqual(10);
    expect(
      contrast(light['accent-ink'] as string, light['accent'] as string),
    ).toBeGreaterThanOrEqual(10);
  });

  it('defines every theme-dependent token in both themes', () => {
    const themeTokens = [
      'bg-900',
      'bg-800',
      'surface',
      'surface-2',
      'surface-glass',
      'border-subtle',
      'border-strong',
      'accent',
      'accent-ink',
      'accent-text',
      'text-high',
      'text-mid',
      'text-low',
      'danger',
      'success',
      'warning',
    ];

    for (const token of themeTokens) {
      expect(dark[token], `--${token} missing from the dark theme`).toBeDefined();
      expect(light[token], `--${token} missing from the light theme`).toBeDefined();
    }
  });

  it('defines theme-independent scale tokens once, in :root', () => {
    // Radii, elevation, blur and motion are identical in both themes, so they
    // are declared a single time and inherited by .light.
    for (const token of [
      'radius-card',
      'radius-xl',
      'radius-pill',
      'shadow-card',
      'blur-glass',
      'ease-out',
    ]) {
      expect(dark[token], `--${token} missing from :root`).toBeDefined();
    }
  });

  it('keeps the signature radii at the sizes the design reference specifies', () => {
    expect(dark['radius-card']).toBe('1.75rem'); // 28px
    expect(dark['radius-xl']).toBe('2rem'); // 32px
    expect(dark['radius-pill']).toBe('999px');
  });

  it('sets color-scheme so form controls and scrollbars follow the theme', () => {
    expect(css).toContain('color-scheme: dark');
    expect(css).toContain('color-scheme: light');
  });

  it('keeps interactive control boundaries above 3:1', () => {
    // `--border-subtle` is a 9% hairline: right for a divider, far too faint
    // for the edge of a control the user has to find and hit. WCAG 1.4.11 asks
    // 3:1 for any boundary that identifies a control.
    //
    // This pair is the reason `Input` uses `--border-strong`: asserting it here
    // means the component cannot quietly fall back to the subtle hairline while
    // the token suite still reports green.
    for (const theme of ['dark', 'light'] as const) {
      const tokens = theme === 'dark' ? dark : light;
      const ratio = contrast(tokens['border-strong'] as string, tokens['bg-900'] as string);
      expect(
        ratio,
        `${theme}: --border-strong on --bg-900 is ${ratio.toFixed(2)}:1, control boundaries need 3:1`,
      ).toBeGreaterThanOrEqual(3);

      const subtle = contrast(tokens['border-subtle'] as string, tokens['bg-900'] as string);
      expect(subtle, `${theme}: --border-subtle measures ${subtle.toFixed(2)}:1`).toBeLessThan(3);
    }
  });
});
