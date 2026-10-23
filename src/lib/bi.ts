// Regras de cálculo do Painel de BI. Funções puras (sem React) para que os
// números da tela, do modo apresentação e do PDF sejam sempre os mesmos.
import type { Entrega, MetaFrete } from '../types';
import { REGIOES } from './constants';
import { ufDestino } from './filtrosEntrega';
import { diffDias, hasValue, hojeISO, percentual, toNumber } from './format';

/* ------------------------------------------------------------------ */
/* Período e comparação                                                 */
/* ------------------------------------------------------------------ */

export type PeriodoId = 'tudo' | '30dias' | '90dias' | 'esteAno' | 'mes' | 'personalizado';
/** Intervalo de datas ISO, inclusivo. '' = sem limite. */
export interface Intervalo { de: string; ate: string }
export interface PeriodoBI { atual: Intervalo; anterior: Intervalo | null; rotulo: string; rotuloAnterior: string }

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const fmtMes = (yyyyMM: string) => { const [a, m] = yyyyMM.split('-'); return `${MESES[parseInt(m) - 1]}/${a}`; };
const fmtMesLongo = (yyyyMM: string) => { const [a, m] = yyyyMM.split('-'); return `${MESES_LONGOS[parseInt(m) - 1]} de ${a}`; };
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const ddmmaa = (iso: string) => `${ddmm(iso)}/${iso.slice(0, 4)}`;

function somaDias(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function ultimoDiaMes(yyyyMM: string): string {
  const [a, m] = yyyyMM.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}
function mesAnterior(yyyyMM: string): string {
  const [a, m] = yyyyMM.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

/**
 * Converte a escolha de período da tela em datas e calcula o período anterior
 * de mesmo tamanho (para as setas ↑ ↓ de comparação).
 */
export function resolverPeriodo(p: PeriodoId, opts: { mes?: string; de?: string; ate?: string }, hoje = hojeISO()): PeriodoBI {
  const rolando = (dias: number, nome: string): PeriodoBI => {
    const de = somaDias(hoje, -dias);
    return {
      atual: { de, ate: '' }, anterior: { de: somaDias(de, -dias - 1), ate: somaDias(de, -1) },
      rotulo: `${nome} (${ddmm(de)} a ${ddmm(hoje)})`, rotuloAnterior: `${dias} dias anteriores`,
    };
  };
  switch (p) {
    case '30dias': return rolando(30, 'Últimos 30 dias');
    case '90dias': return rolando(90, 'Últimos 3 meses');
    case 'esteAno': {
      const a = hoje.slice(0, 4); const ant = String(Number(a) - 1);
      return {
        atual: { de: `${a}-01-01`, ate: '' }, anterior: { de: `${ant}-01-01`, ate: `${ant}${hoje.slice(4)}` },
        rotulo: `${a} (até ${ddmm(hoje)})`, rotuloAnterior: `mesmo período de ${ant}`,
      };
    }
    case 'mes': {
      if (!opts.mes) return { atual: { de: '', ate: '' }, anterior: null, rotulo: 'Todo o histórico', rotuloAnterior: '' };
      const ant = mesAnterior(opts.mes);
      const nome = fmtMesLongo(opts.mes).replace(/^./, (c) => c.toUpperCase());
      // mês em andamento: compara com os mesmos dias do mês anterior (comparação justa)
      if (opts.mes === hoje.slice(0, 7)) {
        const dia = hoje.slice(8, 10);
        const ateAnt = `${ant}-${dia}` > ultimoDiaMes(ant) ? ultimoDiaMes(ant) : `${ant}-${dia}`;
        return {
          atual: { de: `${opts.mes}-01`, ate: hoje }, anterior: { de: `${ant}-01`, ate: ateAnt },
          rotulo: `${nome} (até dia ${Number(dia)})`, rotuloAnterior: `1 a ${Number(ateAnt.slice(8))} de ${MESES_LONGOS[Number(ant.slice(5)) - 1]}`,
        };
      }
      return {
        atual: { de: `${opts.mes}-01`, ate: ultimoDiaMes(opts.mes) }, anterior: { de: `${ant}-01`, ate: ultimoDiaMes(ant) },
        rotulo: nome, rotuloAnterior: fmtMesLongo(ant),
      };
    }
    case 'personalizado': {
      const de = opts.de ?? ''; const ate = opts.ate ?? '';
      const rotulo = de && ate ? `${ddmmaa(de)} a ${ddmmaa(ate)}` : de ? `A partir de ${ddmmaa(de)}` : ate ? `Até ${ddmmaa(ate)}` : 'Todo o histórico';
      const n = de && ate ? diffDias(de, ate) : null;
      if (n === null || n < 0) return { atual: { de, ate }, anterior: null, rotulo, rotuloAnterior: '' };
      return { atual: { de, ate }, anterior: { de: somaDias(de, -n - 1), ate: somaDias(de, -1) }, rotulo, rotuloAnterior: `${n + 1} dias anteriores` };
    }
    default: return { atual: { de: '', ate: '' }, anterior: null, rotulo: 'Todo o histórico', rotuloAnterior: '' };
  }
}

export const dentro = (iso: string, i: Intervalo) => (!i.de || iso >= i.de) && (!i.ate || iso <= i.ate);

/** Entregas faturadas no intervalo (e na região, se escolhida). */
export function filtrarBI(entregas: Entrega[], i: Intervalo, regiao: string): Entrega[] {
  const ufs = regiao ? REGIOES[regiao] : null;
  return entregas.filter((e) => !!e.data_faturamento && dentro(e.data_faturamento, i) && (!ufs || ufs.includes(ufDestino(e))));
}

/* ------------------------------------------------------------------ */
/* Qualidade dos dados                                                  */
/* ------------------------------------------------------------------ */

const mediana = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const digitos = (s: string) => s.split(/[^\d]+/).filter(Boolean).map((x) => x.replace(/^0+/, ''));

/**
 * Pesos que parecem erro de digitação, para não distorcer os totais:
 *  - o peso é igual ao número da NF (digitaram a NF no campo de peso);
 *  - kg por volume muito acima do padrão da empresa (20× a mediana).
 */
export function pesosSuspeitos(entregas: Entrega[]): Set<string> {
  const porVol: number[] = []; const pesos: number[] = [];
  for (const e of entregas) {
    const p = toNumber(e.peso_kg); const v = toNumber(e.volume);
    if (p > 0) pesos.push(p);
    if (p > 0 && v > 0) porVol.push(p / v);
  }
  const limVol = Math.max(100, mediana(porVol) * 20);
  const limPeso = Math.max(2000, mediana(pesos) * 20);
  const s = new Set<string>();
  for (const e of entregas) {
    const p = toNumber(e.peso_kg); if (p <= 0) continue;
    const v = toNumber(e.volume);
    const igualNF = Number.isInteger(p) && digitos(e.nota_fiscal ?? '').includes(String(p));
    const foraPadrao = v > 0 ? p / v > limVol : p > limPeso;
    if (igualNF || foraPadrao) s.add(e.id);
  }
  return s;
}

/** Frete real já informado (veio do CTE ou foi lançado à mão). */
export const temFreteReal = (e: Entrega) => hasValue(e.valor_frete_real);
const entregue = (e: Entrega) => e.status === 'Entregue' && !!e.data_entrega_agendamento;
const FINALIZADOS = new Set(['Entregue', 'Devolvido', 'Devolução', 'Em devolução']);

/* ------------------------------------------------------------------ */
/* Métricas                                                            */
/* ------------------------------------------------------------------ */

interface Media { soma: number; n: number }
const novaMedia = (): Media => ({ soma: 0, n: 0 });
/** Diferenças negativas ou acima de 90 dias são tratadas como erro de digitação. */
const somar = (m: Media, d: number | null) => { if (d !== null && d >= 0 && d <= 90) { m.soma += d; m.n++; } };
const media = (m: Media) => (m.n ? m.soma / m.n : null);

export interface Grupo {
  nome: string; notas: number; faturamento: number;
  conferidas: number; fatConferido: number; freteReal: number; custo: number;
  avaliadas: number; noPrazo: number;
  /** cotado × real só nas NFs que têm os dois */
  cotComp: number; realComp: number; comparaveis: number;
  atrasoSoma: number; atrasoN: number;
  /** em aberto com status Atrasado/Problema */
  criticas: number;
}
const novoGrupo = (nome: string): Grupo => ({
  nome, notas: 0, faturamento: 0, conferidas: 0, fatConferido: 0, freteReal: 0, custo: 0, avaliadas: 0, noPrazo: 0,
  cotComp: 0, realComp: 0, comparaveis: 0, atrasoSoma: 0, atrasoN: 0, criticas: 0,
});
export const pctFreteGrupo = (g: Grupo) => percentual(g.freteReal, g.fatConferido);
export const pctPrazoGrupo = (g: Grupo) => (g.avaliadas ? percentual(g.noPrazo, g.avaliadas) : null);

export interface MetricasBI {
  notas: number; faturamento: number; volumes: number;
  peso: number; pesosIgnorados: Entrega[];
  /** NFs com frete real informado */
  conferidas: number; cobertura: number; fatConferido: number; freteReal: number;
  /** % do frete real sobre o faturamento das MESMAS NFs (número oficial) */
  pctFrete: number;
  /** Frete real das conferidas + cotado das que aguardam CTE */
  custoTotal: number; cotadoPendente: number;
  /** Comparação cotado × real só nas NFs que têm os dois */
  comparaveis: number; cotadoComparavel: number; realComparavel: number; economia: number; economiaPct: number;
  entregues: number; avaliadasPrazo: number; noPrazo: number; pctNoPrazo: number | null;
  atrasadas: number; atrasoMedio: number | null; semPrevisao: number;
  abertas: number; vencidasAbertas: Entrega[]; criticas: number;
  etapas: { pedidoFat: number | null; fatColeta: number | null; coletaEntrega: number | null };
  leadTime: number | null;
  porTransp: Grupo[]; porCliente: Grupo[]; porUF: (Grupo & { uf: string })[];
}

export function calcularMetricas(lista: Entrega[], suspeitos: Set<string>, hoje = hojeISO()): MetricasBI {
  let fat = 0, vol = 0, peso = 0, conf = 0, fatConf = 0, real = 0, cotPend = 0;
  let comp = 0, cotComp = 0, realComp = 0;
  let entregues = 0, aval = 0, noPrazo = 0, atrasadas = 0, semPrev = 0, abertas = 0, criticas = 0;
  const atraso = novaMedia(), pf = novaMedia(), fc = novaMedia(), ce = novaMedia(), lt = novaMedia();
  const pesosIgn: Entrega[] = []; const vencidas: Entrega[] = [];
  const transp = new Map<string, Grupo>(); const cli = new Map<string, Grupo>(); const ufs = new Map<string, Grupo>();
  const grupo = (m: Map<string, Grupo>, k: string) => { let g = m.get(k); if (!g) { g = novoGrupo(k); m.set(k, g); } return g; };

  for (const e of lista) {
    const v = toNumber(e.valor_nf); const cot = toNumber(e.valor_frete);
    const temReal = temFreteReal(e); const r = toNumber(e.valor_frete_real);
    fat += v; vol += toNumber(e.volume);
    if (suspeitos.has(e.id)) pesosIgn.push(e); else peso += toNumber(e.peso_kg);
    if (temReal) { conf++; fatConf += v; real += r; if (cot > 0) { comp++; cotComp += cot; realComp += r; } } else cotPend += cot;

    const gs = [grupo(transp, e.transportadoras?.nome || 'Não informada'), grupo(cli, e.clientes?.nome || 'Cliente desconhecido'), grupo(ufs, ufDestino(e) || 'ND')];
    let ok: boolean | null = null; let diasAtraso: number | null = null; let critica = false;
    if (entregue(e)) {
      entregues++;
      somar(lt, diffDias(e.data_entrada_pedido, e.data_entrega_agendamento));
      somar(ce, diffDias(e.data_coleta, e.data_entrega_agendamento));
      if (e.data_previsao) {
        aval++;
        const d = diffDias(e.data_previsao, e.data_entrega_agendamento) ?? 0;
        ok = d <= 0;
        if (ok) noPrazo++; else { atrasadas++; somar(atraso, d); diasAtraso = d; }
      } else semPrev++;
    } else if (!FINALIZADOS.has(e.status)) {
      abertas++;
      if (e.data_previsao && e.data_previsao < hoje) vencidas.push(e);
      if (e.status === 'Atrasado' || e.status === 'Problema') { criticas++; critica = true; }
    }
    somar(pf, diffDias(e.data_entrada_pedido, e.data_faturamento));
    somar(fc, diffDias(e.data_faturamento, e.data_coleta));

    for (const g of gs) {
      g.notas++; g.faturamento += v; g.custo += temReal ? r : cot;
      if (temReal) { g.conferidas++; g.fatConferido += v; g.freteReal += r; }
      if (ok !== null) { g.avaliadas++; if (ok) g.noPrazo++; }
      if (temReal && cot > 0) { g.comparaveis++; g.cotComp += cot; g.realComp += r; }
      if (diasAtraso !== null && diasAtraso <= 90) { g.atrasoSoma += diasAtraso; g.atrasoN++; }
      if (critica) g.criticas++;
    }
  }

  const n = lista.length;
  return {
    notas: n, faturamento: fat, volumes: vol, peso, pesosIgnorados: pesosIgn,
    conferidas: conf, cobertura: percentual(conf, n), fatConferido: fatConf, freteReal: real,
    pctFrete: percentual(real, fatConf), custoTotal: real + cotPend, cotadoPendente: cotPend,
    comparaveis: comp, cotadoComparavel: cotComp, realComparavel: realComp, economia: cotComp - realComp,
    economiaPct: percentual(cotComp - realComp, cotComp),
    entregues, avaliadasPrazo: aval, noPrazo, pctNoPrazo: aval ? percentual(noPrazo, aval) : null,
    atrasadas, atrasoMedio: media(atraso), semPrevisao: semPrev,
    abertas, vencidasAbertas: vencidas.sort((a, b) => (a.data_previsao ?? '').localeCompare(b.data_previsao ?? '')), criticas,
    etapas: { pedidoFat: media(pf), fatColeta: media(fc), coletaEntrega: media(ce) },
    leadTime: media(lt),
    porTransp: [...transp.values()].sort((a, b) => b.faturamento - a.faturamento),
    porCliente: [...cli.values()].sort((a, b) => b.faturamento - a.faturamento),
    porUF: [...ufs.entries()].map(([uf, g]) => ({ ...g, uf })).sort((a, b) => b.faturamento - a.faturamento),
  };
}

/** Série para o gráfico de evolução: por dia até ~3 meses, por mês acima disso. */
export function serieEvolucao(lista: Entrega[]) {
  const datas = lista.map((e) => e.data_faturamento!).sort();
  const span = datas.length ? diffDias(datas[0], datas[datas.length - 1]) ?? 0 : 0;
  const porMes = span > 95;
  const m = new Map<string, { chave: string; nome: string; faturamento: number; fatConferido: number; freteReal: number; custo: number; avaliadas: number; noPrazo: number }>();
  for (const e of lista) {
    const iso = e.data_faturamento!;
    const chave = porMes ? iso.slice(0, 7) : iso;
    let x = m.get(chave);
    if (!x) { x = { chave, nome: porMes ? fmtMes(chave) : ddmm(iso), faturamento: 0, fatConferido: 0, freteReal: 0, custo: 0, avaliadas: 0, noPrazo: 0 }; m.set(chave, x); }
    const v = toNumber(e.valor_nf);
    x.faturamento += v;
    if (temFreteReal(e)) { x.fatConferido += v; x.freteReal += toNumber(e.valor_frete_real); x.custo += toNumber(e.valor_frete_real); } else x.custo += toNumber(e.valor_frete);
    if (entregue(e) && e.data_previsao) { x.avaliadas++; if ((diffDias(e.data_previsao, e.data_entrega_agendamento) ?? 0) <= 0) x.noPrazo++; }
  }
  return {
    porMes,
    pontos: [...m.values()].sort((a, b) => a.chave.localeCompare(b.chave)).map((x) => ({
      ...x,
      pctFrete: x.fatConferido > 0 ? +percentual(x.freteReal, x.fatConferido).toFixed(2) : null,
      pctPrazo: x.avaliadas ? +percentual(x.noPrazo, x.avaliadas).toFixed(1) : null,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Comparação e destaques em texto                                      */
/* ------------------------------------------------------------------ */

/** Variação % entre dois valores (null quando não há base de comparação). */
export function variacao(atual: number | null, anterior: number | null | undefined): number | null {
  if (atual === null || anterior === null || anterior === undefined || anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

export type Tom = 'bom' | 'ruim' | 'neutro';
/** Frase com trechos em **negrito**. */
export interface Destaque { tom: Tom; texto: string }

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: v >= 1000 ? 0 : 2 });
const pct = (v: number, c = 1) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c })}%`;
const dias = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dia${Math.round(v * 10) === 10 ? '' : 's'}`;

/** Gera as frases da "manchete" a partir dos números do período. */
export function gerarDestaques(m: MetricasBI, ant: MetricasBI | null, rotuloAnt: string): Destaque[] {
  const out: Destaque[] = [];
  if (!m.notas) return out;

  // Faturamento
  const vf = ant ? variacao(m.faturamento, ant.faturamento) : null;
  out.push({
    tom: vf === null ? 'neutro' : vf >= 0 ? 'bom' : 'ruim',
    texto: `Faturamento expedido de **${brl(m.faturamento)}** em **${m.notas.toLocaleString('pt-BR')} NFs**` +
      (vf !== null ? ` — **${vf >= 0 ? '+' : ''}${pct(vf)}** em relação a ${rotuloAnt}.` : '.'),
  });

  // Frete real × cotado
  if (m.comparaveis >= 3 && m.cotadoComparavel > 0) {
    const abaixo = m.economia >= 0;
    out.push({
      tom: abaixo ? 'bom' : 'ruim',
      texto: `Nas NFs conferidas por CTE, o frete real ficou **${pct(Math.abs(m.economiaPct))} ${abaixo ? 'abaixo' : 'acima'} do cotado** ` +
        `(${abaixo ? 'economia' : 'gasto extra'} de **${brl(Math.abs(m.economia))}**).`,
    });
  }
  if (m.conferidas) {
    const d = ant && ant.conferidas ? m.pctFrete - ant.pctFrete : null;
    out.push({
      tom: d === null ? 'neutro' : d <= 0 ? 'bom' : 'ruim',
      texto: `O frete representa **${pct(m.pctFrete, 2)} do faturamento** das NFs conferidas` +
        (d !== null && Math.abs(d) >= 0.01 ? ` (${d > 0 ? '+' : '−'}${Math.abs(d).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} p.p. vs. ${rotuloAnt}).` : '.'),
    });
  }

  // Prazo
  if (m.pctNoPrazo !== null && m.avaliadasPrazo >= 3) {
    const pior = m.porTransp.filter((t) => t.avaliadas >= 3 && t.noPrazo < t.avaliadas)
      .sort((a, b) => (pctPrazoGrupo(a) ?? 100) - (pctPrazoGrupo(b) ?? 100))[0];
    out.push({
      tom: m.pctNoPrazo >= 90 ? 'bom' : m.pctNoPrazo >= 75 ? 'neutro' : 'ruim',
      texto: `**${pct(m.pctNoPrazo)} das entregas** chegaram até a data prevista` +
        (m.atrasoMedio !== null ? `; as atrasadas levaram em média **${dias(m.atrasoMedio)} a mais**` : '') +
        (pior ? `. Maior atenção: **${pior.nome}** (${pct(pctPrazoGrupo(pior) ?? 0, 0)} no prazo).` : '.'),
    });
  }

  // Etapa mais longa
  const et = [
    ['do pedido ao faturamento', m.etapas.pedidoFat], ['do faturamento à coleta', m.etapas.fatColeta], ['da coleta à entrega', m.etapas.coletaEntrega],
  ].filter((x): x is [string, number] => x[1] !== null).sort((a, b) => b[1] - a[1])[0];
  if (et && m.leadTime !== null) {
    out.push({ tom: 'neutro', texto: `Lead time médio de **${dias(m.leadTime)}** do pedido à entrega; a etapa mais longa é **${et[0]}** (${dias(et[1])}).` });
  }

  // Concentração de clientes
  if (m.porCliente.length >= 5 && m.faturamento > 0) {
    const top = m.porCliente[0];
    const top5 = m.porCliente.slice(0, 5).reduce((s, c) => s + c.faturamento, 0);
    out.push({
      tom: 'neutro',
      texto: `**${top.nome}** é o maior cliente (${pct(percentual(top.faturamento, m.faturamento))} do faturamento); os 5 maiores somam **${pct(percentual(top5, m.faturamento), 0)}**.`,
    });
  }

  // Estado mais caro
  const ufCara = m.porUF.filter((u) => u.conferidas >= 3 && u.uf !== 'ND').sort((a, b) => pctFreteGrupo(b) - pctFreteGrupo(a))[0];
  if (ufCara && m.porUF.length > 2) {
    out.push({ tom: 'neutro', texto: `Destino com frete mais pesado: **${ufCara.uf}**, com **${pct(pctFreteGrupo(ufCara), 2)}** do valor da NF.` });
  }

  if (m.vencidasAbertas.length) {
    out.push({ tom: 'ruim', texto: `**${m.vencidasAbertas.length} NF${m.vencidasAbertas.length > 1 ? 's' : ''} em aberto** já passaram da data prevista de entrega.` });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Ranking de transportadoras                                           */
/* ------------------------------------------------------------------ */

export type Selo = 'verde' | 'amarelo' | 'vermelho' | 'cinza';
const PONTOS: Record<Selo, number> = { verde: 100, amarelo: 60, vermelho: 20, cinza: 0 };

export interface LinhaRanking {
  nome: string; notas: number; faturamento: number; custo: number;
  pctFrete: number | null; pctPrazo: number | null; atrasoMedio: number | null; desvioPct: number | null;
  criticas: number; avaliadas: number; conferidas: number;
  selos: { prazo: Selo; frete: Selo; desvio: Selo };
  /** 0–100: prazo pesa 50%, % de frete 30%, real × cotado 20% */
  nota: number | null; selo: Selo;
}

export const seloPrazo = (v: number | null): Selo => (v === null ? 'cinza' : v >= 90 ? 'verde' : v >= 75 ? 'amarelo' : 'vermelho');

/**
 * Nota de cada transportadora, comparando com a média da própria empresa:
 *  - prazo: ≥ 90% verde · ≥ 75% amarelo · abaixo vermelho;
 *  - % de frete (CTE): até a média geral verde · até 20% acima amarelo · acima vermelho;
 *  - real × cotado: igual/abaixo do cotado verde · até 5% acima amarelo · acima vermelho.
 * Métricas com poucos dados (menos de 3 NFs) ficam cinza e não entram na nota.
 */
export function rankingTransportadoras(m: MetricasBI): LinhaRanking[] {
  const media = m.pctFrete;
  return m.porTransp.map((g) => {
    const pctFrete = g.conferidas ? pctFreteGrupo(g) : null;
    const pctPrazo = pctPrazoGrupo(g);
    const desvioPct = g.comparaveis && g.cotComp > 0 ? percentual(g.realComp - g.cotComp, g.cotComp) : null;
    const selos = {
      prazo: g.avaliadas >= 3 ? seloPrazo(pctPrazo) : 'cinza' as Selo,
      frete: g.conferidas >= 3 && pctFrete !== null && media > 0 ? (pctFrete <= media ? 'verde' : pctFrete <= media * 1.2 ? 'amarelo' : 'vermelho') as Selo : 'cinza' as Selo,
      desvio: g.comparaveis >= 3 && desvioPct !== null ? (desvioPct <= 0 ? 'verde' : desvioPct <= 5 ? 'amarelo' : 'vermelho') as Selo : 'cinza' as Selo,
    };
    const pesos: [Selo, number][] = [[selos.prazo, 0.5], [selos.frete, 0.3], [selos.desvio, 0.2]];
    const validos = pesos.filter(([sl]) => sl !== 'cinza');
    const soma = validos.reduce((t, [, w]) => t + w, 0);
    const nota = soma ? Math.round(validos.reduce((t, [sl, w]) => t + PONTOS[sl] * w, 0) / soma) : null;
    const selo: Selo = nota === null ? 'cinza' : nota >= 80 ? 'verde' : nota >= 55 ? 'amarelo' : 'vermelho';
    return {
      nome: g.nome, notas: g.notas, faturamento: g.faturamento, custo: g.custo,
      pctFrete, pctPrazo, atrasoMedio: g.atrasoN ? g.atrasoSoma / g.atrasoN : null, desvioPct,
      criticas: g.criticas, avaliadas: g.avaliadas, conferidas: g.conferidas, selos, nota, selo,
    };
  }).sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1) || b.faturamento - a.faturamento);
}

/* ------------------------------------------------------------------ */
/* Metas de frete (cliente × transportadora)                            */
/* ------------------------------------------------------------------ */

export interface LinhaMeta {
  id: string; cliente: string; transportadora: string; meta: number;
  notas: number; conferidas: number; faturamento: number;
  /** % do frete real (CTE) sobre o valor das NFs conferidas */
  realizado: number | null;
  /** % com o cotado nas NFs que ainda não têm CTE (estimativa) */
  previsto: number | null;
  /** NFs conferidas cujo % ficou acima da meta */
  acima: number;
  status: 'dentro' | 'acima' | 'sem_cte' | 'sem_nfs';
}

export function avaliarMetas(lista: Entrega[], metas: MetaFrete[]): LinhaMeta[] {
  const idx = new Map<string, Entrega[]>();
  for (const e of lista) {
    const k = `${e.cliente_id}|${e.transportadora_id ?? ''}`;
    const arr = idx.get(k); if (arr) arr.push(e); else idx.set(k, [e]);
  }
  const ordem = { acima: 0, dentro: 1, sem_cte: 2, sem_nfs: 3 };
  return metas.map((mt) => {
    const es = idx.get(`${mt.cliente_id}|${mt.transportadora_id}`) ?? [];
    const meta = toNumber(mt.meta_percentual);
    let fat = 0, fatConf = 0, real = 0, efetivo = 0, conf = 0, acima = 0;
    for (const e of es) {
      const v = toNumber(e.valor_nf); fat += v;
      if (temFreteReal(e)) {
        const r = toNumber(e.valor_frete_real);
        conf++; fatConf += v; real += r; efetivo += r;
        if (v > 0 && percentual(r, v) > meta) acima++;
      } else efetivo += toNumber(e.valor_frete);
    }
    const realizado = conf && fatConf > 0 ? percentual(real, fatConf) : null;
    const previsto = fat > 0 ? percentual(efetivo, fat) : null;
    const status: LinhaMeta['status'] = !es.length ? 'sem_nfs' : realizado === null ? 'sem_cte' : realizado > meta ? 'acima' : 'dentro';
    return {
      id: mt.id, cliente: mt.clientes?.nome ?? '—', transportadora: mt.transportadoras?.nome ?? '—', meta,
      notas: es.length, conferidas: conf, faturamento: fat, realizado, previsto, acima, status,
    };
  }).sort((a, b) => ordem[a.status] - ordem[b.status]
    || ((b.realizado ?? 0) - b.meta) - ((a.realizado ?? 0) - a.meta) || b.faturamento - a.faturamento);
}
