import { useState } from 'react';

// One setting for the whole site, so it isn't under the variant's STORAGE_PREFIX. index.html reads this key too,
// to set data-theme before the first paint: the saved choice, or the system's setting until one is made.
const THEME_KEY = 'naruto-theme';

/** The small light/dark button in the corner of every screen. */
export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark');
  const label = `Switch to ${dark ? 'light' : 'dark'} mode`;

  const toggle = () => {
    const theme = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    setDark(!dark);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Storage unavailable — the choice lasts for this session only.
    }
  };

  return (
    <button type="button" className="theme-toggle" aria-label={label} title={label} onClick={toggle}>
      {dark ? '☀️' : '🌙'}
    </button>
  );
}
