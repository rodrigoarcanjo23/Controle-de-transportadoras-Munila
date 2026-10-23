import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Botão com menu suspenso (fecha ao clicar fora ou com Esc). */
export function Dropdown({ trigger, children, align = 'right' }: {
  trigger: (open: boolean, toggle: () => void) => ReactNode; children: ReactNode; align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="dropdown" ref={ref}>
      {trigger(open, () => setOpen((o) => !o))}
      {open && <div className="dropdown__menu" style={align === 'left' ? { left: 0, right: 'auto' } : undefined}>{children}</div>}
    </div>
  );
}
