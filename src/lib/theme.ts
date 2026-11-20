export type Theme = 'emerald' | 'night';

/**
 * Resolve the theme from storage, falling back to the OS preference.
 * Legacy theme names are migrated until 2027-01, when the aliases are removed.
 */
export function resolveTheme(stored: string | null, prefersDark = false): Theme {
  if (stored === 'emerald' || stored === 'night') return stored;
  if (
    stored === 'corporate' ||
    stored === 'light' ||
    stored === 'winter' ||
    stored === 'bumblebee'
  ) {
    return 'emerald';
  }
  if (stored === 'dark') return 'night';
  return prefersDark ? 'night' : 'emerald';
}

/**
 * Older builds saved the system theme on every load. A saved value that still
 * matches the system is treated as automatic; only a differing value is explicit.
 */
export function resolveThemeChoice(
  stored: string | null,
  prefersDark = false,
): { theme: Theme; explicit: boolean } {
  const theme = resolveTheme(stored, prefersDark);
  const system: Theme = prefersDark ? 'night' : 'emerald';
  return { theme, explicit: stored !== null && theme !== system };
}

export function nextTheme(theme: Theme): Theme {
  return theme === 'emerald' ? 'night' : 'emerald';
}

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme;
}
