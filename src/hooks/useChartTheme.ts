import { useEffect, useState } from 'react';

/** Cores dos gráficos acompanhando o tema claro/escuro (valores fixos, compatíveis com o PDF). */
export function useChartTheme() {
  const get = () => document.documentElement.dataset.theme === 'dark';
  const [dark, setDark] = useState(get);
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(get()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return {
    dark,
    grid: dark ? '#23344b' : '#e2e8f0',
    axis: dark ? '#8c9db1' : '#64748b',
    bg: dark ? '#0b1420' : '#f4f6f9',
    tooltip: {
      borderRadius: 10, border: `1px solid ${dark ? '#31465f' : '#e3e8ef'}`,
      background: dark ? '#111c2b' : '#ffffff', color: dark ? '#e6edf5' : '#0f1b2d',
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)', fontSize: 12,
    },
    cursor: dark ? 'rgba(255,255,255,0.04)' : '#f1f5f9',
    blue: '#0ea5e9', orange: '#f97316', green: '#10b981', purple: '#8b5cf6', amber: '#f59e0b', red: '#ef4444',
  };
}
