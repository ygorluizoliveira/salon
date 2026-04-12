import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ClientApp } from './client/ClientApp.tsx';
import './index.css';

const isClientPortal = /^\/cliente(?:\/|$)/.test(window.location.pathname);

// ─────────────────────────────────────────────────────────────────────────────
// Console filter — react-navigation + react-native-web emit harmless warnings
// about RN-only props reaching DOM elements due to library interop.
//
// IMPORTANT: React formats its messages with printf-style "%s" placeholders,
// so the prop name is in args[1], NOT args[0]. Joining all args first ensures
// the filter works regardless of argument position.
// ─────────────────────────────────────────────────────────────────────────────

/** Tokens that identify known, harmless interop warnings to suppress. */
const SUPPRESSED_INTEROP_TOKENS: string[] = [
  // React Navigation internal props
  'hasTwoStates', 'activityState', 'freezeOnBlur', 'shouldFreeze',
  // React Native layout props not supported by the DOM
  'onLayout', 'pointerEvents',
  // TextInput props that leak to <input> / <textarea>
  'placeholderTextColor', 'selectionColor',
  // Miscellaneous react-native-web deprecation noise
  'non-boolean attribute',
  'shadow',
];

function isInteropWarning(args: unknown[]): boolean {
  const message = args.map(a => String(a ?? '')).join(' ');
  return SUPPRESSED_INTEROP_TOKENS.some(token => message.includes(token));
}

const _consoleError = console.error.bind(console);
const _consoleWarn  = console.warn.bind(console);

console.error = (...args: unknown[]) => { if (!isInteropWarning(args)) _consoleError(...args); };
console.warn  = (...args: unknown[]) => { if (!isInteropWarning(args)) _consoleWarn(...args);  };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isClientPortal ? <ClientApp /> : <App />}
  </StrictMode>,
);
