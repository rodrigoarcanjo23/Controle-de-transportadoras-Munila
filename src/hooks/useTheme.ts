import { useCallback, useEffect, useState } from 'react';
import { loadPrefRaw, savePref } from '../lib/storage';

export type Theme = 'light' | 'dark';

function inicial(): Theme {
  const salvo = loadPrefRaw<Theme | null>('tema', null);
  if (salvo) return salvo;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(inicial);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#08111c' : '#0b1f33');
  }, [theme]);
  const toggle = useCallback(() => setTheme((t) => {
    const n = t === 'dark' ? 'light' : 'dark';
    savePref('tema', n);
    return n;
  }), []);
  return { theme, toggle };
}
