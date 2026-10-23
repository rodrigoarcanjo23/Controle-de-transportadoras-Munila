import type { useChartTheme } from '../../hooks/useChartTheme';
// Formatação usada nos blocos do BI.
/** Valor compacto para leitura rápida em reunião: R$ 1,24 mi · R$ 845 mil. */
export function moedaCompacta(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
  if (a >= 10_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
export const num = (v: number, casas = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });


export const corPrazo = (c: ReturnType<typeof useChartTheme>, v: number | null) => (v === null ? c.axis : v >= 90 ? c.green : v >= 75 ? c.amber : c.red);
export const encurta = (v: string, n = 18) => (v.length > n ? v.slice(0, n - 1) + '…' : v);
