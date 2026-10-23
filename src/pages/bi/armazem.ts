// Resumo dos Indicadores Diários do armazém para o Painel de BI.
// Usa as mesmas fórmulas da tela Armazém › Indicadores Diários (config.ts).
import { AREA, DIVS, calc, kpiDe, somaCampos, type AreaId, type Dia, type Fmt } from '../indicadores/config';
import type { Intervalo } from '../../lib/bi';

export interface KpiArmazem {
  area: AreaId; cod: string; areaNome: string; id: string; label: string; desc: string;
  valor: number | null; anterior: number | null; f: Fmt; u?: string; m: 'maior' | 'menor' | null | undefined;
}
export interface ResumoArmazem {
  /** dias lançados por área no período */
  dias: Record<AreaId, number>;
  totalDias: number;
  kpis: KpiArmazem[];
  divergencias: { tipo: string; qtd: number }[];
}

/** Indicadores escolhidos para a reunião (os mesmos nomes da tela do armazém). */
const ESCOLHA: [AreaId, string[]][] = [
  ['recebimento', ['nfs', 'volumes', 'idx_div']],
  ['armazenagem', ['ocupacao', 'acuracidade']],
  ['expedicao', ['notas', 'prazo', 'lead']],
  ['coleta', ['prazo', 'aguardando']],
  ['devolucoes', ['idx_dev', 'idx_af', 'custo']],
];

const ABERTO_DE = '0000-01-01';
const ABERTO_ATE = '9999-12-31';

export function resumirArmazem(
  dias: (area: AreaId, de: string, ate: string) => Dia[], atual: Intervalo, anterior: Intervalo | null,
): ResumoArmazem {
  const pega = (a: AreaId, i: Intervalo) => dias(a, i.de || ABERTO_DE, i.ate || ABERTO_ATE);
  const porArea = Object.fromEntries(ESCOLHA.map(([a]) => [a, pega(a, atual)])) as Record<AreaId, Dia[]>;
  const antPorArea = anterior ? Object.fromEntries(ESCOLHA.map(([a]) => [a, pega(a, anterior)])) as Record<AreaId, Dia[]> : null;

  const kpis: KpiArmazem[] = [];
  for (const [a, ids] of ESCOLHA) {
    for (const id of ids) {
      const k = kpiDe(a, id);
      kpis.push({
        area: a, cod: AREA[a].cod, areaNome: AREA[a].nome, id, label: k.l, desc: k.d,
        valor: calc(k, porArea[a]), anterior: antPorArea ? calc(k, antPorArea[a]) : null, f: k.f, u: k.u, m: k.m,
      });
    }
  }
  const divergencias = DIVS.slice(1)
    .map(([k, l]) => ({ tipo: l, qtd: somaCampos(porArea.recebimento, ['div_' + k]) }))
    .filter((x) => x.qtd > 0).sort((a, b) => b.qtd - a.qtd);
  const contagem = Object.fromEntries(ESCOLHA.map(([a]) => [a, porArea[a].length])) as Record<AreaId, number>;
  return { dias: contagem, totalDias: Object.values(contagem).reduce((s, n) => s + n, 0), kpis, divergencias };
}
