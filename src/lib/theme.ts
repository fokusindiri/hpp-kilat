import { useEffect, useState } from 'react';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'hpp_kilat_theme';
const THEME_CHANGE_EVENT = 'hpp-kilat-theme-change';

export function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch {
    // Abaikan jika localStorage tidak tersedia
  }
  return 'dark';
}

export function applyThemeToDocument(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  root.style.colorScheme = theme;
}

export function saveTheme(theme: ThemeMode): void {
  applyThemeToDocument(theme);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Abaikan jika localStorage tidak tersedia
  }
  window.dispatchEvent(new CustomEvent<ThemeMode>(THEME_CHANGE_EVENT, { detail: theme }));
}

export function useTheme(): {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (next: ThemeMode) => void;
  toggleTheme: () => void;
} {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const initial = getInitialTheme();
    applyThemeToDocument(initial);
    return initial;
  });

  useEffect(() => {
    applyThemeToDocument(theme);

    const handleCustomChange = (event: Event) => {
      const customEvent = event as CustomEvent<ThemeMode>;
      if (customEvent.detail === 'light' || customEvent.detail === 'dark') {
        setThemeState(customEvent.detail);
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && (event.newValue === 'light' || event.newValue === 'dark')) {
        setThemeState(event.newValue);
        applyThemeToDocument(event.newValue);
      }
    };

    window.addEventListener(THEME_CHANGE_EVENT, handleCustomChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, handleCustomChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [theme]);

  const setTheme = (next: ThemeMode) => {
    setThemeState(next);
    saveTheme(next);
  };

  const toggleTheme = () => {
    setThemeState((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      saveTheme(next);
      return next;
    });
  };

  return {
    theme,
    isDark: theme === 'dark',
    setTheme,
    toggleTheme,
  };
}