import { useEffect, useRef } from 'react';

function digitando(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  if (!t) return false;
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
}

/**
 * Atalho de teclado simples ("/" ou "n"). Ignorado enquanto o usuário digita
 * em um campo ou quando há um modal aberto.
 */
export function useHotkey(key: string, handler: () => void, enabled = true) {
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      if (digitando(e.target) || document.querySelector('.modal-backdrop')) return;
      e.preventDefault();
      ref.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key, enabled]);
}
