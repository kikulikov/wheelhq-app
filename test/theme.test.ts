import { describe, expect, it } from 'vitest';
import { applyTheme, nextTheme, resolveTheme, resolveThemeChoice } from '../src/lib/theme';

describe('resolveTheme', () => {
  it('uses the system preference when nothing is stored', () => {
    expect(resolveTheme(null, true)).toBe('night');
    expect(resolveTheme(null, false)).toBe('emerald');
  });

  it('keeps a current theme name', () => {
    expect(resolveTheme('night', false)).toBe('night');
    expect(resolveTheme('emerald', true)).toBe('emerald');
  });

  it('maps legacy and previous theme names', () => {
    expect(resolveTheme('light', true)).toBe('emerald');
    expect(resolveTheme('corporate', true)).toBe('emerald');
    expect(resolveTheme('winter', true)).toBe('emerald');
    expect(resolveTheme('bumblebee', true)).toBe('emerald');
    expect(resolveTheme('dark', false)).toBe('night');
  });
});

describe('resolveThemeChoice', () => {
  it('treats a saved value that matches the system as automatic', () => {
    expect(resolveThemeChoice(null, true)).toEqual({ theme: 'night', explicit: false });
    expect(resolveThemeChoice('night', true)).toEqual({ theme: 'night', explicit: false });
    expect(resolveThemeChoice('light', false)).toEqual({ theme: 'emerald', explicit: false });
  });

  it('treats a differing saved value as an explicit choice', () => {
    expect(resolveThemeChoice('emerald', true)).toEqual({ theme: 'emerald', explicit: true });
    expect(resolveThemeChoice('night', false)).toEqual({ theme: 'night', explicit: true });
    expect(resolveThemeChoice('dark', false)).toEqual({ theme: 'night', explicit: true });
  });
});

describe('nextTheme', () => {
  it('toggles between the two themes', () => {
    expect(nextTheme('emerald')).toBe('night');
    expect(nextTheme('night')).toBe('emerald');
  });
});

describe('applyTheme', () => {
  it('writes data-theme on the supplied root', () => {
    const root = { dataset: {} } as unknown as HTMLElement;
    applyTheme('night', root);
    expect(root.dataset.theme).toBe('night');
  });
});
