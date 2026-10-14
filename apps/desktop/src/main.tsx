import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@lyriclens/ui/styles.css';
import './overlay.css';

import { App } from './App.js';

/**
 * Desktop overlay entry point.
 *
 * The same `@lyriclens/ui` design system the web app uses — the overlay and the
 * PWA are visually indistinguishable on purpose.
 */
const container = document.getElementById('root');

if (container === null) {
  throw new Error('Overlay root element is missing from index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
