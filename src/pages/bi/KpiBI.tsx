import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { Tom } from '../../lib/bi';
import { num } from './fmt';

export type TipoDelta = 'pct' | 'pp' | 'dias';

/**
 * Indicador grande com a seta de comparação. A cor da seta segue o que é
 * bom para o negócio (ex.: frete subir é ruim, prazo subir é bom).
 */
export function KpiBI({ label, value, unit, sub, delta, tipo = 'pct', melhor = 'maior', icon, tone, vsTexto }: {
  label: string; value: string; unit?: string; sub?: ReactNode; delta?: number | null; tipo?: TipoDelta;
  melhor?: 'maior' | 'menor'; icon?: ReactNode; tone: string; vsTexto?: string;
}) {
  let chip: ReactNode = null;
  if (delta !== undefined && delta !== null && Number.isFinite(delta)) {
    const zero = Math.abs(delta) < (tipo === 'pct' ? 0.05 : 0.01);
    const tom: Tom = zero ? 'neutro' : (delta > 0) === (melhor === 'maior') ? 'bom' : 'ruim';
    const txt = tipo === 'pct' ? `${num(Math.abs(delta), 1)}%` : tipo === 'pp' ? `${num(Math.abs(delta), 2)} p.p.` : `${num(Math.abs(delta), 1)} d`;
    const Icone = zero ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
    chip = <span className={`bi-delta bi-delta--${tom}`}><Icone size={14} strokeWidth={2.6} />{zero ? 'estável' : txt}</span>;
  }
  return (
    <div className={`bi-kpi bi-kpi--${tone}`}>
      <div className="bi-kpi__top">
        <span className="bi-kpi__label">{label}</span>
        {icon && <span className={`bi-kpi__icon tone-${tone}`}>{icon}</span>}
      </div>
      <div className="bi-kpi__value">{value}{unit && <small>{unit}</small>}</div>
      <div className="bi-kpi__foot">
        {chip}
        {vsTexto && <span className="bi-kpi__vs">{vsTexto}</span>}
      </div>
      {sub && <div className="bi-kpi__sub">{sub}</div>}
    </div>
  );
}

/** Anel de percentual (SVG puro, sai igual no PDF). */
export function Anel({ valor, cor, trilho, tamanho = 150, children }: { valor: number; cor: string; trilho: string; tamanho?: number; children?: ReactNode }) {
  const r = 42; const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, valor));
  return (
    <div className="bi-anel" style={{ width: tamanho, height: tamanho }}>
      <svg viewBox="0 0 100 100" width={tamanho} height={tamanho}>
        <circle cx="50" cy="50" r={r} fill="none" stroke={trilho} strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={cor} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 50 50)" />
      </svg>
      <div className="bi-anel__centro">{children}</div>
    </div>
  );
}

/** Renderiza "texto com **negrito**". */
export function TextoMarcado({ texto }: { texto: string }) {
  return <>{texto.split('**').map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : p))}</>;
}
