// Cálculos da Gestão Financeira. Usa as mesmas regras do Painel de BI
// (% de frete só com NFs que têm CTE) para os números baterem entre as telas.
import type { Cte, Entrega, MetaFrete, Transportadora } from '../types';
import { diffDias, hasValue, hojeISO, percentual, toNumber } from './format';
import { fmtMes } from './bi';

export interface ConfigFinanceiro {
  /** orçamento de frete: % máximo do faturamento */
  orcamento_pct: number;
  /** acima deste % de frete a NF é "fora do padrão" */
  limite_pct: number;
  /** real acima do cotado em mais de X% = cobrar a transportadora */
  margem_cotado_pct: number;
}
export const CONFIG_FIN_PADRAO: ConfigFinanceiro = { orcamento_pct: 4, limite_pct: 15, margem_cotado_pct: 10 };
export const lerConfigFin = (v: unknown): ConfigFinanceiro => {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<ConfigFinanceiro>;
  const n = (x: unknown, d: number) => (typeof x === 'number' && isFinite(x) && x >= 0 ? x : d);
  return {
    orcamento_pct: n(o.orcamento_pct, CONFIG_FIN_PADRAO.orcamento_pct),
    limite_pct: n(o.limite_pct, CONFIG_FIN_PADRAO.limite_pct),
    margem_cotado_pct: n(o.margem_cotado_pct, CONFIG_FIN_PADRAO.margem_cotado_pct),
  };
};

export type Situacao = 'conferido' | 'acima_cotado' | 'acima_meta' | 'fora_padrao' | 'sem_cotacao' | 'aguardando';
export const SITUACAO: Record<Situacao, { label: string; tone: string; dica: string }> = {
  acima_cotado: { label: 'Acima do cotado', tone: 'red', dica: 'Frete real bem acima do cotado — vale cobrar a transportadora.' },
  acima_meta: { label: 'Acima da meta', tone: 'orange', dica: 'Passou da meta de frete do cliente × transportadora.' },
  fora_padrao: { label: 'Fora do padrão', tone: 'amber', dica: '% de frete muito alto para o valor da NF.' },
  sem_cotacao: { label: 'Sem cotação', tone: 'purple', dica: 'Frete cotado não informado.' },
  aguardando: { label: 'Aguardando CTE', tone: 'slate', dica: 'Ainda sem frete real.' },
  conferido: { label: 'Conferido', tone: 'green', dica: 'Frete real dentro do esperado.' },
};

export interface LinhaFin {
  e: Entrega;
  valor: number; cotado: number; real: number | null;
  /** % do frete sobre a NF (real se houver, senão cotado) */
  pct: number;
  /** real − cotado (só com os dois) */
  diferenca: number | null;
  diferencaPct: number | null;
  meta: number | null;
  /** dias desde o faturamento, para quem aguarda CTE */
  diasSemCte: number | null;
  /** todas as pendências da NF (uma NF pode estar em mais de uma aba) */
  flags: Set<Situacao>;
  /** a pendência principal (selo da linha) */
  situacao: Situacao;
}

const ORDEM: Situacao[] = ['acima_cotado', 'acima_meta', 'fora_padrao', 'sem_cotacao', 'aguardando', 'conferido'];

export function analisarNFs(lista: Entrega[], metas: MetaFrete[], cfg: ConfigFinanceiro, hoje = hojeISO()): LinhaFin[] {
  const metaDe = new Map(metas.map((m) => [`${m.cliente_id}|${m.transportadora_id}`, toNumber(m.meta_percentual)]));
  return lista.map((e) => {
    const valor = toNumber(e.valor_nf); const cotado = toNumber(e.valor_frete);
    const temReal = hasValue(e.valor_frete_real); const real = temReal ? toNumber(e.valor_frete_real) : null;
    const pct = percentual(real ?? cotado, valor);
    const meta = metaDe.get(`${e.cliente_id}|${e.transportadora_id ?? ''}`) ?? null;
    const diferenca = real !== null && cotado > 0 ? real - cotado : null;
    const diferencaPct = diferenca !== null ? percentual(diferenca, cotado) : null;
    const flags = new Set<Situacao>();
    if (!temReal) flags.add('aguardando');
    if (cotado <= 0 && !temReal) flags.add('sem_cotacao');
    if (diferencaPct !== null && diferencaPct > cfg.margem_cotado_pct) flags.add('acima_cotado');
    if (real !== null && meta !== null && valor > 0 && pct > meta) flags.add('acima_meta');
    if (valor > 0 && (real ?? cotado) > 0 && pct > cfg.limite_pct) flags.add('fora_padrao');
    if (!flags.size) flags.add('conferido');
    const situacao = ORDEM.find((s) => flags.has(s))!;
    const diasSemCte = !temReal && e.data_faturamento ? diffDias(e.data_faturamento, hoje) : null;
    return { e, valor, cotado, real, pct, diferenca, diferencaPct, meta, diasSemCte, flags, situacao };
  });
}

export interface ResumoFin {
  notas: number; faturamento: number;
  conferidas: number; fatConferido: number; freteReal: number; pctReal: number; cobertura: number;
  aguardando: number; cotadoPendente: number; diasMedioSemCte: number | null;
  comparaveis: number; cotComp: number; realComp: number; desvio: number; desvioPct: number;
  custoPrevisto: number; pctPrevisto: number;
  /** projeção: pendentes com o mesmo desvio médio real × cotado das conferidas */
  pendenteProjetado: number; custoProjetado: number; pctProjetado: number;
}

export function resumir(linhas: LinhaFin[]): ResumoFin {
  let fat = 0, conf = 0, fatConf = 0, real = 0, ag = 0, cotPend = 0, diasS = 0, diasN = 0, comp = 0, cotComp = 0, realComp = 0;
  for (const l of linhas) {
    fat += l.valor;
    if (l.real !== null) { conf++; fatConf += l.valor; real += l.real; if (l.cotado > 0) { comp++; cotComp += l.cotado; realComp += l.real; } }
    else { ag++; cotPend += l.cotado; if (l.diasSemCte !== null && l.diasSemCte >= 0) { diasS += l.diasSemCte; diasN++; } }
  }
  const desvioPct = percentual(realComp - cotComp, cotComp);
  const pendenteProjetado = cotPend * (1 + desvioPct / 100);
  return {
    notas: linhas.length, faturamento: fat, conferidas: conf, fatConferido: fatConf, freteReal: real,
    pctReal: percentual(real, fatConf), cobertura: percentual(conf, linhas.length),
    aguardando: ag, cotadoPendente: cotPend, diasMedioSemCte: diasN ? diasS / diasN : null,
    comparaveis: comp, cotComp, realComp, desvio: realComp - cotComp, desvioPct,
    custoPrevisto: real + cotPend, pctPrevisto: percentual(real + cotPend, fat),
    pendenteProjetado, custoProjetado: real + pendenteProjetado, pctProjetado: percentual(real + pendenteProjetado, fat),
  };
}

/** Série mensal: frete real, a conferir (cotado), % real e orçamento. */
export function serieMensal(linhas: LinhaFin[]) {
  const m = new Map<string, { mes: string; nome: string; faturamento: number; real: number; aConferir: number; fatConf: number }>();
  for (const l of linhas) {
    const iso = l.e.data_faturamento; if (!iso) continue;
    const k = iso.slice(0, 7);
    const x = m.get(k) ?? { mes: k, nome: fmtMes(k), faturamento: 0, real: 0, aConferir: 0, fatConf: 0 };
    x.faturamento += l.valor;
    if (l.real !== null) { x.real += l.real; x.fatConf += l.valor; } else x.aConferir += l.cotado;
    m.set(k, x);
  }
  return [...m.values()].sort((a, b) => a.mes.localeCompare(b.mes)).map((x) => ({
    ...x,
    pctReal: x.fatConf > 0 ? +percentual(x.real, x.fatConf).toFixed(2) : null,
    pctPrevisto: x.faturamento > 0 ? +percentual(x.real + x.aConferir, x.faturamento).toFixed(2) : null,
  }));
}

/* ------------------------------------------------------------------ */
/* Transportadoras e CTEs                                               */
/* ------------------------------------------------------------------ */
const digitos = (s?: string | null) => (s ?? '').replace(/\D/g, '');
const norm = (s?: string | null) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+(LTDA|S\/?A|ME|EPP|EIRELI)\.?$/g, '').trim();

/** Descobre a transportadora de um CTE pelo CNPJ do emitente (ou pelo nome). */
export function transportadoraDoCte(c: Cte, transps: Transportadora[]): string {
  const cnpj = digitos(c.cnpj_emitente);
  if (cnpj) { const t = transps.find((x) => digitos(x.cnpj_cpf) === cnpj); if (t) return t.nome; }
  const n = norm(c.razao_social_emitente);
  const t = transps.find((x) => n && (norm(x.razao_social) === n || norm(x.nome) === n || (norm(x.nome).length > 3 && n.includes(norm(x.nome)))));
  return t?.nome ?? (c.razao_social_emitente || 'Não identificada');
}

export interface LinhaTransp {
  nome: string; notas: number; faturamento: number;
  conferidas: number; freteReal: number; fatConf: number; pctReal: number | null;
  desvioPct: number | null; cotComp: number; realComp: number;
  aguardando: number; cotadoPendente: number;
  ctes: number; valorCtes: number; ctesAbertos: number; valorAbertos: number;
}

/** `ctesPeriodo` = CTEs emitidos no período; `ctesAbertos` = TODOS os CTEs ainda não lançados no Infarma (pendência não tem data). */
export function porTransportadora(linhas: LinhaFin[], ctesPeriodo: Cte[], ctesAbertos: Cte[], transps: Transportadora[]): LinhaTransp[] {
  const m = new Map<string, LinhaTransp>();
  const pega = (nome: string) => {
    let x = m.get(nome);
    if (!x) { x = { nome, notas: 0, faturamento: 0, conferidas: 0, freteReal: 0, fatConf: 0, pctReal: null, desvioPct: null, cotComp: 0, realComp: 0, aguardando: 0, cotadoPendente: 0, ctes: 0, valorCtes: 0, ctesAbertos: 0, valorAbertos: 0 }; m.set(nome, x); }
    return x;
  };
  for (const l of linhas) {
    const x = pega(l.e.transportadoras?.nome || 'Não informada');
    x.notas++; x.faturamento += l.valor;
    if (l.real !== null) { x.conferidas++; x.freteReal += l.real; x.fatConf += l.valor; if (l.cotado > 0) { x.cotComp += l.cotado; x.realComp += l.real; } }
    else { x.aguardando++; x.cotadoPendente += l.cotado; }
  }
  for (const c of ctesPeriodo) { const x = pega(transportadoraDoCte(c, transps)); x.ctes++; x.valorCtes += toNumber(c.valor_total_servico); }
  for (const c of ctesAbertos) { const x = pega(transportadoraDoCte(c, transps)); x.ctesAbertos++; x.valorAbertos += toNumber(c.valor_total_servico); }
  return [...m.values()].map((x) => ({
    ...x,
    pctReal: x.fatConf > 0 ? percentual(x.freteReal, x.fatConf) : null,
    desvioPct: x.cotComp > 0 ? percentual(x.realComp - x.cotComp, x.cotComp) : null,
  })).sort((a, b) => b.freteReal + b.cotadoPendente - (a.freteReal + a.cotadoPendente) || b.valorCtes - a.valorCtes);
}

/* ------------------------------------------------------------------ */
/* Clientes (custo para atender)                                        */
/* ------------------------------------------------------------------ */
export interface LinhaCliente {
  nome: string; notas: number; faturamento: number; custo: number; fretePorNf: number;
  /** % do frete (real nas conferidas, cotado nas pendentes) sobre o faturamento */
  pct: number; pctReal: number | null; conferidas: number;
  acimaMeta: number; comMeta: number; ticketMedio: number;
}

export function porCliente(linhas: LinhaFin[]): LinhaCliente[] {
  const m = new Map<string, LinhaCliente & { fatConf: number; real: number }>();
  for (const l of linhas) {
    const nome = l.e.clientes?.nome || 'Cliente desconhecido';
    const x = m.get(nome) ?? { nome, notas: 0, faturamento: 0, custo: 0, fretePorNf: 0, pct: 0, pctReal: null, conferidas: 0, acimaMeta: 0, comMeta: 0, ticketMedio: 0, fatConf: 0, real: 0 };
    x.notas++; x.faturamento += l.valor; x.custo += l.real ?? l.cotado;
    if (l.real !== null) { x.conferidas++; x.fatConf += l.valor; x.real += l.real; }
    if (l.meta !== null && l.real !== null) { x.comMeta++; if (l.flags.has('acima_meta')) x.acimaMeta++; }
    m.set(nome, x);
  }
  return [...m.values()].map(({ fatConf, real, ...x }) => ({
    ...x,
    fretePorNf: x.notas ? x.custo / x.notas : 0,
    ticketMedio: x.notas ? x.faturamento / x.notas : 0,
    pct: percentual(x.custo, x.faturamento),
    pctReal: fatConf > 0 ? percentual(real, fatConf) : null,
  })).sort((a, b) => b.custo - a.custo);
}

export const cteAberto = (c: Cte) => String(c.situacao ?? '').toUpperCase() === 'ABERTO';
