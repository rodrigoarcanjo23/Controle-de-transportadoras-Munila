import { CONCEITO, conceitoDe } from '../../lib/avaliacao';
import { fmtMes } from '../../lib/bi';
import { corNota, fmtNota } from './fmt';

/** Nota em anel (SVG puro: sai igual na impressão). */
export function AnelNota({ nota, tamanho = 96 }: { nota: number | null; tamanho?: number }) {
  const r = 42; const c = 2 * Math.PI * r; const v = nota === null ? 0 : Math.max(0, Math.min(10, nota)) / 10;
  return (
    <div className="av-anel" style={{ width: tamanho, height: tamanho }}>
      <svg viewBox="0 0 100 100" width={tamanho} height={tamanho} aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" style={{ stroke: 'var(--surface-3)' }} strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" style={{ stroke: corNota(nota) }} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${v * c} ${c}`} transform="rotate(-90 50 50)" />
      </svg>
      <div className="av-anel__txt" style={{ fontSize: tamanho * 0.27 }}>{fmtNota(nota)}</div>
    </div>
  );
}

/** Nota pequena colorida (critério). */
export function ChipNota({ nota, titulo }: { nota: number | null; titulo?: string }) {
  const c = nota === null ? 'slate' : CONCEITO[conceitoDe(nota)!].tone;
  return <span className={`av-chip av-chip--${c}`} title={titulo}>{fmtNota(nota)}</span>;
}

/** Mini gráfico da nota nos últimos meses. */
export function Sparkline({ valores, largura = 84, altura = 26 }: { valores: (number | null)[]; largura?: number; altura?: number }) {
  const pts = valores.map((v, i) => (v === null ? null : [4 + (i * (largura - 8)) / Math.max(1, valores.length - 1), altura - 3 - (v / 10) * (altura - 6)] as const));
  const validos = pts.filter((p): p is readonly [number, number] => !!p);
  if (validos.length < 2) return <span className="muted" style={{ fontSize: '0.75rem' }}>—</span>;
  const ultimo = valores.filter((v) => v !== null).slice(-1)[0] ?? null;
  return (
    <svg width={largura} height={altura} className="av-spark" aria-hidden="true">
      <polyline points={validos.map((p) => p.join(',')).join(' ')} fill="none" style={{ stroke: corNota(ultimo) }} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {validos.length > 0 && <circle cx={validos[validos.length - 1][0]} cy={validos[validos.length - 1][1]} r="2.8" style={{ fill: corNota(ultimo) }} />}
    </svg>
  );
}

/** Barras da nota mês a mês (SVG/CSS, sai na impressão). */
export function BarrasHistorico({ meses, valores }: { meses: string[]; valores: (number | null)[] }) {
  return (
    <div className="av-barras">
      {meses.map((m, i) => {
        const v = valores[i];
        return (
          <div key={m} className="av-barras__col" title={`${fmtMes(m)}: ${fmtNota(v)}`}>
            <span className="av-barras__v">{fmtNota(v)}</span>
            <div className="av-barras__trilho"><div className="av-barras__barra" style={{ height: `${v === null ? 0 : Math.max(3, v * 10)}%`, background: corNota(v) }} /></div>
            <span className="av-barras__m">{fmtMes(m).replace('/20', '/')}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Seta de variação da nota em relação ao mês anterior. */
export function DeltaNota({ atual, anterior }: { atual: number | null; anterior: number | null | undefined }) {
  if (atual === null || anterior === null || anterior === undefined) return null;
  const d = Math.round((atual - anterior) * 10) / 10;
  if (Math.abs(d) < 0.05) return <span className="av-delta">= {fmtNota(anterior)}</span>;
  return <span className={`av-delta ${d > 0 ? 'av-delta--up' : 'av-delta--down'}`} title={`Mês anterior: ${fmtNota(anterior)}`}>{d > 0 ? '▲' : '▼'} {fmtNota(Math.abs(d))}</span>;
}
