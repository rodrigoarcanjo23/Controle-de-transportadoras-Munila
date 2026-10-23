import { useEffect, useRef, useState } from 'react';
import { fmt, fmtAx, type Bucket, type Kpi } from './config';

function niceStep(raw: number) {
  if (raw <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

/**
 * Gráfico do painel original (SVG puro): barras para somas, linha para índices.
 * Mesmo desenho, eixos e dica ao passar o mouse.
 */
export function Grafico({ k, bks, vals, carregando }: { k: Kpi; bks: Bucket[]; vals: (number | null)[]; carregando?: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(320);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW((w) => { const n = Math.max(240, Math.round(el.clientWidth)); return n === w ? w : n; }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (carregando) return <div className="ind-chart" ref={boxRef}><div className="ch-empty">Carregando base…</div></div>;
  if (!vals.some((v) => v != null)) return <div className="ind-chart" ref={boxRef}><div className="ch-empty">Sem lançamentos no período</div></div>;

  const H = 170;
  const max = Math.max(...vals.filter((v): v is number => v != null), 0);
  const step = niceStep((max || 1) / 4);
  const top = Math.max(step, Math.ceil((max * 1.08) / step) * step);
  const ticks: number[] = [];
  for (let t = 0; t <= top + 1e-9; t += step) ticks.push(+t.toFixed(6));
  const ml = Math.max(...ticks.map((t) => fmtAx(t, k.f, step).length)) * 6.4 + 10;
  const m = { t: 10, r: 12, b: 24, l: ml };
  const pw = W - m.l - m.r, ph = H - m.t - m.b, n = bks.length, bw = pw / n;
  const x = (i: number) => m.l + bw * (i + 0.5);
  const y = (v: number) => m.t + ph - (v / top) * ph;
  const every = Math.max(1, Math.ceil((n * 44) / pw));
  let last = -1; vals.forEach((v, i) => { if (v != null) last = i; });

  let path = ''; let pen = false;
  if (k.t === 'razao') vals.forEach((v, i) => { if (v == null) { pen = false; return; } path += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); pen = true; });
  const w = Math.max(2, Math.min(28, bw * 0.68));

  const hv = hover != null ? vals[hover] : null;
  const tipLeft = hover != null ? Math.max(0, Math.min(W - 140, x(hover) - 70)) : 0;
  const tipTop = hover != null ? Math.max(0, (hv == null ? m.t + ph / 2 : y(hv)) - 52) : 0;

  return (
    <div className="ind-chart" ref={boxRef}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={k.l} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--ind-grid)" />
            <text x={m.l - 6} y={y(t)} dy="0.32em" textAnchor="end">{fmtAx(t, k.f, step)}</text>
          </g>
        ))}
        <line x1={m.l} x2={W - m.r} y1={y(0)} y2={y(0)} stroke="var(--ind-axis)" />
        {bks.map((b, i) => ((n - 1 - i) % every === 0 ? <text key={'l' + i} x={x(i)} y={H - 6} textAnchor="middle">{b.lbl}</text> : null))}
        {k.t === 'razao' ? (
          <>
            <path d={path} fill="none" stroke="var(--ind-c1)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            {vals.map((v, i) => {
              if (v == null) return null;
              const r = i === last ? 4 : n <= 45 ? 2.5 : 0;
              return r ? <circle key={'p' + i} cx={x(i)} cy={y(v)} r={r} fill="var(--ind-c1)" opacity={hover == null || hover === i ? 1 : 0.55} /> : null;
            })}
          </>
        ) : vals.map((v, i) => (v == null ? null : (
          <rect key={'b' + i} x={x(i) - w / 2} y={y(v)} width={w} height={Math.max(0, y(0) - y(v))} rx={Math.min(3, w / 2)}
            fill="var(--ind-c1)" opacity={hover == null || hover === i ? 1 : 0.55} />
        )))}
        {bks.map((_, i) => <rect key={'h' + i} x={m.l + bw * i} y={m.t} width={bw} height={ph} fill="transparent" onMouseEnter={() => setHover(i)} />)}
      </svg>
      {hover != null && (
        <div className="ind-tip" style={{ left: tipLeft, top: tipTop }}>
          <div className="d">{bks[hover].tt}</div>
          <b>{fmt(vals[hover], k.f, k.u)}</b>
        </div>
      )}
    </div>
  );
}
