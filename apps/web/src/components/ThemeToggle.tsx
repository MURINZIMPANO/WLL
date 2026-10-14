'use client';

import { Moon, Sun } from 'lucide-react';

/**
 * Light/dark switch.
 *
 * Deliberately **stateless**. The blocking script in the root layout has
 * already applied the saved theme before first paint, so the correct icon can
 * be selected with CSS (`.dark` / `.light` on <html>) rather than by reading
 * the DOM in an effect. That keeps the component free of hydration mismatch,
 * free of a `mounted` flag, and free of the cascading re-render that a
 * `setState`-in-`useEffect` causes.
 *
 * The theme is persisted to localStorage on click; a failure there (private
 * browsing) is ignored, and the toggle still works for the session.
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.classList.contains('light') ? 'dark' : 'light';

    root.classList.remove('dark', 'light');
    root.classList.add(next);

    try {
      localStorage.setItem('lyriclens-theme', next);
    } catch {
      // Persisting is best-effort.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle colour theme"
      className="glass grid size-11 place-items-center rounded-pill border border-border-subtle text-text-mid transition-colors duration-150 ease-out hover:text-text-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {/* Sun in light mode, moon in dark mode — resolved by the theme class. */}
      <Sun aria-hidden className="size-5 dark:hidden" />
      <Moon aria-hidden className="hidden size-5 dark:block" />
    </button>
  );
}
