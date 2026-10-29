// Regras de SLA da Central de Logística: prazos em dias úteis, aprendidos com o
// histórico de entregas (transportadora × UF) e ajustáveis manualmente.
import type { Entrega } from '../types';
import { ufDestino } from './filtrosEntrega';
import { diasUteisEntre, somarDiasUteis } from './diasUteis';
import { hojeISO } from './format';

/** Prazo manual de trânsito (coleta → entrega), em dias úteis. */
export interface RotaPrazo { uf: string; transportadora?: string; dias: number }
export interface ConfigSLA {
  /** coleta: até D+N úteis após o faturamento (mesmo prazo dos Indicadores Diários) */
  coleta_dias: number;
  /** cliente com agendamento: até N dias úteis para conseguir a data */
  agendamento_dias: number;
  /** trânsito quando não há tabela nem histórico */
  transito_padrao: number;
  rotas: RotaPrazo[];
}
export const CONFIG_SLA_PADRAO: ConfigSLA = { coleta_dias: 1, agendamento_dias: 3, transito_padrao: 5, rotas: [] };
export function lerConfigSLA(v: unknown, coleta?: number): ConfigSLA {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<ConfigSLA>;
  const n = (x: unknown, d: number) => (typeof x === 'number' && isFinite(x) && x >= 0 ? Math.round(x) : d);
  return {
    coleta_dias: n(coleta, n(o.coleta_dias, CONFIG_SLA_PADRAO.coleta_dias)),
    agendamento_dias: n(o.agendamento_dias, CONFIG_SLA_PADRAO.agendamento_dias),
    transito_padrao: n(o.transito_padrao, CONFIG_SLA_PADRAO.transito_padrao),
    rotas: Array.isArray(o.rotas) ? o.rotas.filter((r) => r && typeof r.uf === 'string' && typeof r.dias === 'number') : [],
  };
}

/* ------------------------------------------------------------------ */
/* Aprendizado: quanto cada rota realmente leva                         */
/* ------------------------------------------------------------------ */
export interface PrazoAprendido { uf: string; transportadora?: string; n: number; mediana: number; p80: number; noPrazo: number; comPrevisao: number }
export interface Aprendizado {
  porTranspUf: Map<string, PrazoAprendido>;
  porUf: Map<string, PrazoAprendido>;
  geral: PrazoAprendido | null;
}
const chave = (t: string | undefined, uf: string) => `${(t ?? '').toUpperCase()}|${uf}`;
const quantil = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))]; };
const resumo = (uf: string, t: string | undefined, xs: number[], np: number, cp: number): PrazoAprendido => ({
  uf, transportadora: t, n: xs.length, mediana: quantil(xs, 0.5), p80: Math.max(1, quantil(xs, 0.8)), noPrazo: np, comPrevisao: cp,
});

/** Usa as entregas concluídas do último ano: dias úteis entre a coleta e a entrega. */
export function aprenderPrazos(entregas: Entrega[], hoje = hojeISO()): Aprendizado {
  const desde = `${+hoje.slice(0, 4) - 1}${hoje.slice(4)}`;
  const tu = new Map<string, { t: string; uf: string; xs: number[]; np: number; cp: number }>();
  const uf = new Map<string, { xs: number[]; np: number; cp: number }>();
  const todos: number[] = [];
  for (const e of entregas) {
    if (e.status !== 'Entregue' || !e.data_coleta || !e.data_entrega_agendamento || e.data_entrega_agendamento < desde) continue;
    const d = diasUteisEntre(e.data_coleta, e.data_entrega_agendamento);
    if (d < 0 || d > 60) continue; // datas incoerentes
    const u = ufDestino(e) || 'ND'; const t = e.transportadoras?.nome ?? 'Não informada';
    const ok = e.data_previsao ? (e.data_entrega_agendamento <= e.data_previsao ? 1 : 0) : 0;
    const temP = e.data_previsao ? 1 : 0;
    const k = chave(t, u);
    const a = tu.get(k) ?? { t, uf: u, xs: [], np: 0, cp: 0 }; a.xs.push(d); a.np += ok; a.cp += temP; tu.set(k, a);
    const b = uf.get(u) ?? { xs: [], np: 0, cp: 0 }; b.xs.push(d); b.np += ok; b.cp += temP; uf.set(u, b);
    todos.push(d);
  }
  return {
    porTranspUf: new Map([...tu].map(([k, a]) => [k, resumo(a.uf, a.t, a.xs, a.np, a.cp)])),
    porUf: new Map([...uf].map(([k, a]) => [k, resumo(k, undefined, a.xs, a.np, a.cp)])),
    geral: todos.length ? resumo('', undefined, todos, 0, 0) : null,
  };
}

export type FontePrazo = 'tabela' | 'historico' | 'padrao';
export interface PrazoResolvido { dias: number; fonte: FontePrazo; detalhe: string }

/** Prazo de trânsito de uma NF: tabela manual › histórico da transportadora na UF › histórico da UF › padrão. */
export function prazoTransito(e: Entrega, cfg: ConfigSLA, apr: Aprendizado): PrazoResolvido {
  const u = ufDestino(e); const t = e.transportadoras?.nome;
  const r = cfg.rotas.find((x) => x.uf === u && x.transportadora && t && x.transportadora.toUpperCase() === t.toUpperCase())
    ?? cfg.rotas.find((x) => x.uf === u && !x.transportadora);
  if (r) return { dias: r.dias, fonte: 'tabela', detalhe: `Tabela: ${r.transportadora ? `${r.transportadora} → ` : ''}${u} em ${r.dias} d.u.` };
  const h1 = apr.porTranspUf.get(chave(t, u));
  if (h1 && h1.n >= 3) return { dias: h1.p80, fonte: 'historico', detalhe: `Histórico ${t} → ${u}: 80% das ${h1.n} entregas em até ${h1.p80} d.u.` };
  const h2 = apr.porUf.get(u);
  if (h2 && h2.n >= 5) return { dias: h2.p80, fonte: 'historico', detalhe: `Histórico ${u}: 80% das ${h2.n} entregas em até ${h2.p80} d.u.` };
  return { dias: cfg.transito_padrao, fonte: 'padrao', detalhe: `Prazo padrão de ${cfg.transito_padrao} d.u. (pouco histórico para ${u || 'este destino'})` };
}

/* ------------------------------------------------------------------ */
/* Situação de cada NF                                                  */
/* ------------------------------------------------------------------ */
export type Etapa = 'coleta' | 'agendamento' | 'agendado' | 'transito' | 'entregue' | 'devolucao' | 'sem_data';
export type SituacaoSLA = 'atrasada' | 'vence_hoje' | 'no_prazo' | 'verificar' | 'entregue_prazo' | 'entregue_atraso' | 'fora';
export const ETAPA: Record<Etapa, { label: string; resp: string }> = {
  coleta: { label: 'Aguardando coleta', resp: 'Expedição / transportadora' },
  agendamento: { label: 'Aguardando agendamento', resp: 'Cliente / agendamento' },
  agendado: { label: 'Agendado', resp: 'Transportadora' },
  transito: { label: 'Em trânsito', resp: 'Transportadora' },
  entregue: { label: 'Entregue', resp: '' },
  devolucao: { label: 'Devolução', resp: '' },
  sem_data: { label: 'Sem faturamento', resp: '' },
};

export interface LinhaSLA {
  e: Entrega;
  etapa: Etapa; situacao: SituacaoSLA;
  /** data limite da etapa atual (coleta, agendamento, data agendada ou previsão) */
  limite: string | null;
  /** previsão de entrega (da NF ou calculada) */
  previsao: string | null; previsaoCalculada: boolean;
  prazo: PrazoResolvido;
  /** dias úteis de atraso (>0) ou que faltam (<0) em relação ao limite */
  atraso: number | null;
  /** dias úteis desde o faturamento */
  idade: number | null;
  ocorrencia: boolean;
}

const DEVOLUCAO = new Set(['Devolvido', 'Devolução', 'Em devolução', 'Recusa']);
const AGUARDA_AGENDAMENTO = new Set(['Pendente agendamento', 'Solicitado Agendamento']);
const AGENDADO = new Set(['Agendado', 'Reagendado']);

export function analisarSLA(entregas: Entrega[], cfg: ConfigSLA, apr: Aprendizado, hoje = hojeISO()): LinhaSLA[] {
  return entregas.map((e): LinhaSLA => {
    const prazo = prazoTransito(e, cfg, apr);
    const fat = e.data_faturamento;
    const base = { e, prazo, ocorrencia: e.status === 'Problema' || e.status === 'Atrasado' };
    if (DEVOLUCAO.has(e.status)) return { ...base, etapa: 'devolucao', situacao: 'fora', limite: null, previsao: e.data_previsao ?? null, previsaoCalculada: false, atraso: null, idade: null };
    if (!fat) return { ...base, etapa: 'sem_data', situacao: 'fora', limite: null, previsao: e.data_previsao ?? null, previsaoCalculada: false, atraso: null, idade: null };

    const saida = e.data_coleta ?? somarDiasUteis(fat, cfg.coleta_dias);
    const previsao = e.data_previsao || somarDiasUteis(saida, prazo.dias);
    const previsaoCalculada = !e.data_previsao;

    if (e.status === 'Entregue') {
      const ent = e.data_entrega_agendamento;
      const atraso = ent ? diasUteisEntre(previsao, ent) : null;
      return { ...base, etapa: 'entregue', situacao: atraso !== null && atraso > 0 ? 'entregue_atraso' : 'entregue_prazo', limite: previsao, previsao, previsaoCalculada, atraso, idade: ent ? diasUteisEntre(fat, ent) : null };
    }

    let etapa: Etapa; let limite: string;
    if (AGUARDA_AGENDAMENTO.has(e.status)) { etapa = 'agendamento'; limite = somarDiasUteis(fat, cfg.agendamento_dias); }
    else if (AGENDADO.has(e.status) && e.data_entrega_agendamento) { etapa = 'agendado'; limite = e.data_entrega_agendamento; }
    else if (!e.data_coleta && e.status !== 'Em Transporte') { etapa = 'coleta'; limite = somarDiasUteis(fat, cfg.coleta_dias); }
    else { etapa = 'transito'; limite = previsao; }

    const atraso = diasUteisEntre(limite, hoje);
    const idade = diasUteisEntre(fat, hoje);
    // muito além do prazo sem nenhuma atualização: provavelmente já foi entregue e falta registrar
    const esperado = cfg.coleta_dias + prazo.dias + (etapa === 'agendamento' || etapa === 'agendado' ? cfg.agendamento_dias : 0);
    const verificar = idade > Math.max(10, esperado * 2) && atraso > 0;
    const situacao: SituacaoSLA = verificar ? 'verificar' : atraso > 0 ? 'atrasada' : atraso >= -1 ? 'vence_hoje' : 'no_prazo';
    return { ...base, etapa, situacao, limite, previsao, previsaoCalculada, atraso, idade };
  });
}

/* ------------------------------------------------------------------ */
/* Envelhecimento, cobrança e desempenho                                */
/* ------------------------------------------------------------------ */
export const FAIXAS = [['0–2', 0, 2], ['3–5', 3, 5], ['6–10', 6, 10], ['11–20', 11, 20], ['21+', 21, Infinity]] as const;
export function envelhecimento(linhas: LinhaSLA[]) {
  const etapas: Etapa[] = ['coleta', 'agendamento', 'agendado', 'transito'];
  return FAIXAS.map(([nome, de, ate]) => {
    const row: Record<string, number | string> = { nome: `${nome} d.u.` };
    for (const et of etapas) row[et] = linhas.filter((l) => l.etapa === et && l.situacao !== 'verificar' && l.idade !== null && l.idade >= de && l.idade <= ate).length;
    return row;
  });
}

export interface GrupoCobranca { transportadora: string; email?: string | null; telefone?: string | null; linhas: LinhaSLA[] }
export function gruposCobranca(linhas: LinhaSLA[]): GrupoCobranca[] {
  const m = new Map<string, GrupoCobranca>();
  for (const l of linhas) {
    if (l.situacao !== 'atrasada' || l.etapa === 'agendamento') continue;
    const t = l.e.transportadoras?.nome ?? 'Sem transportadora';
    const g = m.get(t) ?? { transportadora: t, email: l.e.transportadoras?.email, telefone: l.e.transportadoras?.telefone, linhas: [] };
    g.linhas.push(l); m.set(t, g);
  }
  return [...m.values()].map((g) => ({ ...g, linhas: g.linhas.sort((a, b) => (b.atraso ?? 0) - (a.atraso ?? 0)) })).sort((a, b) => b.linhas.length - a.linhas.length);
}

const ddmm = (iso?: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');
export function mensagemCobranca(g: GrupoCobranca, empresa = 'Munila'): string {
  const linhas = g.linhas.map((l) => `• NF ${l.e.nota_fiscal} — ${l.e.clientes?.nome ?? ''} — ${l.e.cidade_destino || l.e.clientes?.cidade || ''}/${ufDestino(l.e)} — ` +
    `${l.etapa === 'coleta' ? `aguardando coleta desde ${ddmm(l.e.data_faturamento)}` : `previsão ${ddmm(l.limite)}`} (${l.atraso} dia${l.atraso === 1 ? '' : 's'} útil${l.atraso === 1 ? '' : 'eis'} de atraso)`);
  return `Olá, equipe ${g.transportadora}!\n\nIdentificamos ${g.linhas.length} NF${g.linhas.length > 1 ? 's' : ''} da ${empresa} com atraso. Podem nos enviar a posição atualizada (ocorrência e nova previsão) de cada uma?\n\n${linhas.join('\n')}\n\nObrigado!`;
}

/* ------------------------------------------------------------------ */
/* Risco de atraso: NFs ainda no prazo que provavelmente vão atrasar     */
/* ------------------------------------------------------------------ */
export type NivelRisco = 'alto' | 'medio';
export interface RiscoNF { nivel: NivelRisco; motivos: string[]; chegadaEstimada?: string }

const fmtD = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Histórico da rota (transportadora × UF) da NF, se houver amostra suficiente. */
export function historicoRota(e: Entrega, apr: Aprendizado): PrazoAprendido | undefined {
  const h = apr.porTranspUf.get(chave(e.transportadoras?.nome, ufDestino(e) || 'ND'));
  return h && h.n >= 3 ? h : undefined;
}

/**
 * Para NFs em aberto ainda dentro do prazo: estima a chegada com o tempo típico
 * (mediana) da transportadora para a UF e aponta o risco de passar da previsão.
 */
export function avaliarRisco(l: LinhaSLA, cfg: ConfigSLA, apr: Aprendizado, hoje = hojeISO()): RiscoNF | null {
  if (!['no_prazo', 'vence_hoje'].includes(l.situacao) || !l.limite) return null;
  if (!['coleta', 'transito', 'agendado'].includes(l.etapa)) return null;
  const e = l.e;
  const hist = historicoRota(e, apr);
  const tipico = hist ? hist.mediana : l.prazo.dias;
  const fonteTip = hist ? `${e.transportadoras?.nome ?? 'a transportadora'} leva em média ${tipico} d.u. para ${ufDestino(e) || 'o destino'}` : `o prazo de trânsito é de ${tipico} d.u.`;
  const motivos: string[] = [];
  let nivel: NivelRisco | null = null;
  let chegadaEstimada: string | undefined;
  const subir = (n: NivelRisco) => { if (nivel !== 'alto') nivel = n; };
  const previsao = l.previsao;

  if (l.etapa === 'coleta' && previsao) {
    // ainda não coletada: no melhor caso coleta no próximo dia útil
    chegadaEstimada = somarDiasUteis(somarDiasUteis(hoje, 1), tipico);
    if (chegadaEstimada > previsao) { motivos.push(`Ainda sem coleta: mesmo coletando no próximo dia útil, ${fonteTip} — chegaria ${fmtD(chegadaEstimada)}, depois da previsão ${fmtD(previsao)}`); subir('alto'); }
  }
  if (l.etapa === 'transito' && previsao) {
    const saida = e.data_coleta ?? somarDiasUteis(e.data_faturamento!, cfg.coleta_dias);
    chegadaEstimada = somarDiasUteis(saida, tipico);
    const decorridos = diasUteisEntre(saida, hoje);
    if (chegadaEstimada > previsao) { motivos.push(`Coletada ${fmtD(saida)} e ${fonteTip}: chegada estimada ${fmtD(chegadaEstimada)}, depois da previsão ${fmtD(previsao)}`); subir('alto'); }
    else if (hist && decorridos > hist.p80 && (l.atraso ?? -99) >= -1) { motivos.push(`Já são ${decorridos} d.u. desde a coleta sem confirmação de entrega (80% das entregas dessa rota chegam em ${hist.p80} d.u.)`); subir('medio'); }
  }
  if (l.etapa === 'agendado' && e.data_entrega_agendamento && !e.data_coleta && e.status !== 'Em Transporte') {
    const falta = diasUteisEntre(hoje, e.data_entrega_agendamento);
    if (falta <= tipico) { motivos.push(`Agendada para ${fmtD(e.data_entrega_agendamento)} e ainda sem coleta — ${fonteTip}`); subir(falta < tipico ? 'alto' : 'medio'); }
  }
  if (hist && hist.comPrevisao >= 5) {
    const taxa = hist.noPrazo / hist.comPrevisao;
    if (taxa < 0.7) { motivos.push(`Rota com histórico ruim: só ${Math.round(taxa * 100)}% das entregas de ${e.transportadoras?.nome} para ${ufDestino(e)} chegaram na previsão`); subir('medio'); }
  }
  if (l.ocorrencia) { motivos.push(`Status "${e.status}"`); subir('medio'); }
  return nivel ? { nivel, motivos, chegadaEstimada } : null;
}
