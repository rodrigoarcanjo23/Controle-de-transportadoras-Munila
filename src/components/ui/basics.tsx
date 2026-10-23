import { useState, type ReactNode } from 'react';
import { Search, X, Inbox, SlidersHorizontal } from 'lucide-react';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { toneOf, type Tone } from '../../lib/constants';

export function PageHeader({ icon, title, subtitle, actions }: {
  icon?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header__titles">
        {icon && <div className="page-header__icon">{icon}</div>}
        <div style={{ minWidth: 0 }}>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="page-header__actions no-print">{actions}</div>}
    </header>
  );
}

export function KpiCard({ label, value, unit, hint, icon, tone = 'brand', valueClass, accent, onClick, active, children }: {
  label: string; value?: ReactNode; unit?: string; hint?: ReactNode; icon?: ReactNode; tone?: Tone;
  valueClass?: string; accent?: string; onClick?: () => void; active?: boolean; children?: ReactNode;
}) {
  const cls = ['kpi', accent && 'kpi--accent', onClick && 'kpi--clickable', active && 'kpi--active'].filter(Boolean).join(' ');
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={cls} onClick={onClick} style={{ ...(accent ? { ['--kpi-accent' as string]: accent } : {}), textAlign: 'left', font: 'inherit' }} type={onClick ? 'button' : undefined}>
      <div className="kpi__top">
        <span className="kpi__label">{label}</span>
        {icon && <span className={`kpi__icon tone-${tone}`}>{icon}</span>}
      </div>
      {value !== undefined && <div className={`kpi__value ${valueClass ?? ''}`}>{value}{unit && <small>{unit}</small>}</div>}
      {children}
      {hint && <div className="kpi__hint">{hint}</div>}
    </Tag>
  );
}

export function Badge({ children, tone, square, dot }: { children: ReactNode; tone?: Tone; square?: boolean; dot?: boolean }) {
  const t = tone ?? toneOf(typeof children === 'string' ? children : undefined);
  return <span className={`badge tone-${t} ${square ? 'badge--square' : ''} ${dot ? 'badge-dot' : ''}`}>{children}</span>;
}

export const StatusBadge = ({ status }: { status?: string | null }) =>
  status ? <Badge tone={toneOf(status)} dot>{status}</Badge> : <span className="muted">-</span>;

export function Field({ label, required, hint, hintKind, children, className, htmlFor }: {
  label?: ReactNode; required?: boolean; hint?: ReactNode; hintKind?: 'ok' | 'error'; children: ReactNode; className?: string; htmlFor?: string;
}) {
  return (
    <div className={`field ${className ?? ''}`}>
      {label && <label htmlFor={htmlFor}>{label}{required && <span className="field__req">*</span>}</label>}
      {children}
      {hint && <span className={`field__hint ${hintKind ? `field__hint--${hintKind}` : ''}`}>{hint}</span>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder, inputRef, className, shortcut }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>; className?: string; shortcut?: string;
}) {
  return (
    <div className={`input-icon ${className ?? ''}`}>
      <Search size={16} />
      <input ref={inputRef} type="search" className="input" placeholder={placeholder} value={value}
        onChange={(e) => onChange(e.target.value)} style={{ paddingRight: value || shortcut ? 40 : undefined }} />
      <span className="input-suffix">
        {value ? (
          <button type="button" className="icon-btn icon-btn--sm" onClick={() => onChange('')} aria-label="Limpar busca"><X size={14} /></button>
        ) : shortcut ? <span className="kbd hide-mobile">{shortcut}</span> : null}
      </span>
    </div>
  );
}

export function EmptyState({ title, text, icon, action }: { title: string; text?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon ?? <Inbox size={36} />}
      <div className="empty__title">{title}</div>
      {text && <div style={{ maxWidth: 420 }}>{text}</div>}
      {action}
    </div>
  );
}

export function Check({ checked, onChange, children, id }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; id?: string }) {
  return (
    <label className={`check ${checked ? 'check--on' : ''}`} htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

/** Cartão de filtros: sempre aberto no computador; recolhido atrás de um botão no celular. */
export function FilterCard({ children, ativos = 0, minCol = 170 }: { children: ReactNode; ativos?: number; minCol?: number }) {
  const isMobile = useIsMobile();
  const [aberto, setAberto] = useState(false);
  if (isMobile && !aberto) {
    return (
      <div className="toolbar no-print">
        <button className={`btn ${ativos ? 'btn-primary' : ''}`} onClick={() => setAberto(true)}>
          <SlidersHorizontal size={16} /> Filtros {ativos > 0 && <span className="count" style={{ background: '#fff', color: 'var(--brand)' }}>{ativos}</span>}
        </button>
      </div>
    );
  }
  return (
    <div className="card no-print" style={{ padding: 14 }}>
      <div className="form-grid form-grid--auto" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minCol}px, 1fr))`, alignItems: 'end' }}>
        {children}
      </div>
      {isMobile && <button className="btn btn-block btn-ghost" style={{ marginTop: 10 }} onClick={() => setAberto(false)}>Ocultar filtros</button>}
    </div>
  );
}
