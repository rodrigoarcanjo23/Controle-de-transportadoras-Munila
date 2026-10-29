// Avaliação mensal das transportadoras (scorecard): nota de 0 a 10 por critério e geral.
// Usa o que o sistema já registra: prazos (SLA em dias úteis), coleta (D+N), ocorrências do
// portal e devoluções, auditoria dos CTEs pela tabela de frete, contestações de fatura e canhotos.
import type { Cte, Devolucao, Entrega, Transportadora } from '../types';
import { analisarSLA, type Aprendizado, type ConfigSLA } from './sla';
import { diasUteisEntre, somarDiasUteis } from './diasUteis';
import { auditarCtes, type LinhaAuditoria, type TabelaFrete } from './tabelaFrete';
import { transportadoraDoCte } from './financeiro';
import { toNumber } from './format';
import type { Ocorrencia } from './ocorrencias';
import type { Fatura } from './faturas';

export type Criterio = 'prazo' | 'coleta' | 'qualidade' | 'cobranca' | 'informacao';
export const CRITERIOS: { id: Criterio; label: string; curto: string; dica: string }[] = [
  { id: 'prazo', label: 'Prazo de entrega', curto: 'Prazo', dica: 'Entregas do mês feitas até a previsão (da NF, do prazo contratado ou do que as transportadoras fazem para a UF), em dias úteis. NFs em aberto já vencidas contam como atraso.' },
  { id: 'coleta', label: 'Coleta no prazo', curto: 'Coleta', dica: 'NFs faturadas no mês coletadas até D+N dias úteis (prazo de coleta dos Indicadores Diários).' },
  { id: 'qualidade', label: 'Qualidade da entrega', curto: 'Qualidade', dica: 'Avarias pesam 1; cliente ausente, endereço não localizado, reentrega, recusa e devoluções pesam ½. Taxa sobre as NFs do mês.' },
  { id: 'cobranca', label: 'Cobrança correta', curto: 'Cobrança', dica: 'CTEs do mês dentro da tabela de frete combinada (sem tabela: frete real até a margem sobre o cotado). Faturas contestadas no mês reduzem a nota.' },
  { id: 'informacao', label: 'Informação e canhoto', curto: 'Informação', dica: 'Entregas do mês informadas pela transportadora no portal, com foto do canhoto.' },
];

export interface ConfigAvaliacao {
  pesos: Record<Criterio, number>;
  /** % no prazo que vale nota 10 (entrega e coleta) */
  meta_prazo_pct: number;
  /** % no prazo que vale nota 0 */
  piso_prazo_pct: number;
  /** taxa de ocorrências (%) que zera a nota de qualidade */
  limite_ocorrencias_pct: number;
  /** abaixo deste nº de NFs no mês a nota é marcada como "amostra pequena" */
  min_nfs: number;
}
export const CONFIG_AVALIACAO_PADRAO: ConfigAvaliacao = {
  pesos: { prazo: 35, coleta: 15, qualidade: 20, cobranca: 20, informacao: 10 },
  meta_prazo_pct: 95, piso_prazo_pct: 60, limite_ocorrencias_pct: 10, min_nfs: 5,
};
export function lerConfigAvaliacao(v: unknown): ConfigAvaliacao {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<ConfigAvaliacao>;
  const P = CONFIG_AVALIACAO_PADRAO;
  const n = (x: unknown, d: number, max = 1000) => (typeof x === 'number' && isFinite(x) && x >= 0 && x <= max ? x : d);
  const pesos = { ...P.pesos };
  for (const c of CRITERIOS) pesos[c.id] = n(o.pesos?.[c.id], P.pesos[c.id], 100);
  const meta = n(o.meta_prazo_pct, P.meta_prazo_pct, 100);
  const piso = Math.min(n(o.piso_prazo_pct, P.piso_prazo_pct, 100), meta - 1);
  return { pesos, meta_prazo_pct: meta, piso_prazo_pct: piso, limite_ocorrencias_pct: Math.max(1, n(o.limite_ocorrencias_pct, P.limite_ocorrencias_pct, 100)), min_nfs: n(o.min_nfs, P.min_nfs) };
}

export type Conceito = 'A' | 'B' | 'C' | 'D';
export const CONCEITO: Record<Conceito, { label: string; tone: string; min: number }> = {
  A: { label: 'Excelente', tone: 'green', min: 8.5 },
  B: { label: 'Bom', tone: 'blue', min: 7 },
  C: { label: 'Regular', tone: 'amber', min: 5 },
  D: { label: 'Crítico', tone: 'red', min: 0 },
};
export const conceitoDe = (nota: number | null): Conceito | null => (nota === null ? null : nota >= 8.5 ? 'A' : nota >= 7 ? 'B' : nota >= 5 ? 'C' : 'D');

export interface ResultadoCriterio {
  nota: number | null;
  /** valor principal (ex.: "92%") */
  valor: string;
  detalhe: string;
  base: number;
}

export interface ItemAtraso { e: Entrega; dias: number; aberta: boolean }
export interface ItemOcorrencia { e: Entrega; codigo: string; descricao: string; data: string; peso: number }
export interface AvaliacaoTransportadora {
  id: string; nome: string; transportadora?: Transportadora;
  nfs: number; faturamento: number;
  criterios: Record<Criterio, ResultadoCriterio>;
  nota: number | null; conceito: Conceito | null; amostraPequena: boolean;
  pontos: string[]; destaques: string[];
  atrasos: ItemAtraso[]; coletasAtrasadas: { e: Entrega; dias: number }[];
  ocorrencias: ItemOcorrencia[]; devolucoes: Devolucao[];
  acimaTabela: LinhaAuditoria[]; valorAcimaTabela: number;
  faturasContestadas: Fatura[]; valorContestado: number;
  semCanhoto: Entrega[];
}

export interface EntradaAvaliacao {
  entregas: Entrega[]; devolucoes: Devolucao[]; transportadoras: Transportadora[];
  ctes: Cte[]; tabelas: TabelaFrete[]; faturas: Fatura[];
  /** null = tabela de ocorrências ainda não existe */
  ocorrencias: Ocorrencia[] | null;
  sla: ConfigSLA; apr: Aprendizado; margemCotadoPct: number; tolTabelaPct: number;
  cfg: ConfigAvaliacao;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number) => Math.max(0, Math.min(10, v));
const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
const fmtPct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`;
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const noMes = (iso: string | null | undefined, mes: string) => !!iso && iso.slice(0, 7) === mes;
/** último dia do mês (YYYY-MM-DD) */
const fimDoMes = (mes: string) => { const [a, m] = mes.split('-').map(Number); return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10); };
export const mesAnterior = (mes: string, n = 1) => { const [a, m] = mes.split('-').map(Number); const d = new Date(Date.UTC(a, m - 1 - n, 1)); return d.toISOString().slice(0, 7); };

const PESO_OCORRENCIA: Record<string, number> = { avaria: 1, recusa: 0.5, cliente_ausente: 0.5, endereco: 0.5, reentrega: 0.5 };
const DEVOLVIDA = new Set(['Devolvido', 'Devolução', 'Em devolução', 'Recusa']);

/** Nota de % no prazo: piso → 0, meta → 10, linear entre os dois. */
const notaPrazo = (p: number, cfg: ConfigAvaliacao) => clamp(((p - cfg.piso_prazo_pct) / (cfg.meta_prazo_pct - cfg.piso_prazo_pct)) * 10);

/**
 * Avalia todas as transportadoras com NFs no mês (YYYY-MM).
 * `hoje` limita a análise de NFs em aberto (atrasos que já venceram).
 */
export function avaliarMes(mes: string, ent: EntradaAvaliacao, hoje: string): AvaliacaoTransportadora[] {
  const { cfg } = ent;
  const ate = fimDoMes(mes) < hoje ? fimDoMes(mes) : hoje;
  // benchmark justo: a transportadora é medida pelo prazo da NF, pelo contratado ou pelo que o MERCADO
  // faz para a UF — não pelo próprio histórico (que a deixaria sempre "no prazo").
  const aprMercado: Aprendizado = { ...ent.apr, porTranspUf: new Map() };
  const linhas = analisarSLA(ent.entregas, ent.sla, aprMercado, ate);
  const porTransp = new Map<string, typeof linhas>();
  for (const l of linhas) {
    const id = l.e.transportadora_id ? String(l.e.transportadora_id) : '';
    if (!id) continue;
    porTransp.set(id, [...(porTransp.get(id) ?? []), l]);
  }

  const ocPorEntrega = new Map<string, Ocorrencia[]>();
  for (const o of ent.ocorrencias ?? []) ocPorEntrega.set(String(o.entrega_id), [...(ocPorEntrega.get(String(o.entrega_id)) ?? []), o]);
  // o portal só entra na nota quando já está em uso (alguma entrega informada pelo portal no mês)
  const portalEmUso = (ent.ocorrencias ?? []).some((o) => o.origem === 'portal' && noMes(o.data_ocorrencia, mes));

  const ctesMes = ent.ctes.filter((c) => noMes(c.data_emissao, mes));
  const aud = auditarCtes(ctesMes, ent.ctes, ent.entregas, ent.tabelas, ent.tolTabelaPct);

  const out: AvaliacaoTransportadora[] = [];
  for (const t of ent.transportadoras) {
    const id = String(t.id);
    const ls = porTransp.get(id) ?? [];
    // NFs "do mês": faturadas no mês ou entregues no mês
    const doMes = ls.filter((l) => noMes(l.e.data_faturamento, mes) || (l.e.status === 'Entregue' && noMes(l.e.data_entrega_agendamento, mes)));
    if (!doMes.length) continue;
    const faturamento = doMes.reduce((s, l) => s + toNumber(l.e.valor_nf), 0);

    // 1) Prazo de entrega: entregues no mês + em aberto cuja previsão venceu dentro do mês
    const entregues = ls.filter((l) => l.etapa === 'entregue' && noMes(l.e.data_entrega_agendamento, mes) && l.atraso !== null);
    const abertasVencidas = ls.filter((l) => (l.etapa === 'transito' || l.etapa === 'agendado') && l.limite && noMes(l.limite, mes) && l.limite < ate && (l.atraso ?? 0) > 0);
    const noPrazo = entregues.filter((l) => (l.atraso ?? 0) <= 0).length;
    const baseP = entregues.length + abertasVencidas.length;
    const pP = pct(noPrazo, baseP);
    const atrasos: ItemAtraso[] = [
      ...entregues.filter((l) => (l.atraso ?? 0) > 0).map((l) => ({ e: l.e, dias: l.atraso ?? 0, aberta: false })),
      ...abertasVencidas.map((l) => ({ e: l.e, dias: l.atraso ?? 0, aberta: true })),
    ].sort((a, b) => b.dias - a.dias);
    const mediaAtraso = atrasos.length ? atrasos.reduce((s, a) => s + a.dias, 0) / atrasos.length : 0;
    const prazo: ResultadoCriterio = baseP
      ? { nota: r1(notaPrazo(pP, cfg)), valor: fmtPct(pP), base: baseP, detalhe: `${noPrazo} de ${baseP} no prazo${atrasos.length ? ` · ${atrasos.length} com atraso (média ${r1(mediaAtraso).toLocaleString('pt-BR')} d.u.)` : ''}` }
      : { nota: null, valor: '—', base: 0, detalhe: 'Nenhuma entrega no mês' };

    // 2) Coleta: faturadas no mês (fora devoluções)
    const fatMes = ls.filter((l) => noMes(l.e.data_faturamento, mes) && !DEVOLVIDA.has(l.e.status));
    const coletasAtrasadas: { e: Entrega; dias: number }[] = [];
    let baseC = 0; let okC = 0;
    for (const l of fatMes) {
      const fat = l.e.data_faturamento!;
      const limite = somarDiasUteis(fat, ent.sla.coleta_dias);
      if (l.e.data_coleta) {
        baseC++;
        const d = diasUteisEntre(limite, l.e.data_coleta);
        if (d <= 0) okC++; else coletasAtrasadas.push({ e: l.e, dias: d });
      } else if (limite < ate && l.e.status !== 'Entregue' && l.e.status !== 'Em Transporte') {
        baseC++; coletasAtrasadas.push({ e: l.e, dias: diasUteisEntre(limite, ate) });
      }
    }
    coletasAtrasadas.sort((a, b) => b.dias - a.dias);
    const pC = pct(okC, baseC);
    const coleta: ResultadoCriterio = baseC
      ? { nota: r1(notaPrazo(pC, cfg)), valor: fmtPct(pC), base: baseC, detalhe: `${okC} de ${baseC} coletadas até D+${ent.sla.coleta_dias}` }
      : { nota: null, valor: '—', base: 0, detalhe: 'Sem coletas para avaliar no mês' };

    // 3) Qualidade: ocorrências do mês + devoluções do mês
    const ids = new Set(ls.map((l) => String(l.e.id)));
    const porId = new Map(ls.map((l) => [String(l.e.id), l.e]));
    const ocorrencias: ItemOcorrencia[] = [];
    if (ent.ocorrencias) {
      for (const id2 of ids) {
        const os = (ocPorEntrega.get(id2) ?? []).filter((o) => noMes(o.data_ocorrencia, mes) && PESO_OCORRENCIA[o.codigo]);
        // por NF, conta a ocorrência mais grave uma vez
        const pior = os.sort((a, b) => (PESO_OCORRENCIA[b.codigo] ?? 0) - (PESO_OCORRENCIA[a.codigo] ?? 0))[0];
        if (pior) ocorrencias.push({ e: porId.get(id2)!, codigo: pior.codigo, descricao: pior.descricao || pior.codigo, data: pior.data_ocorrencia, peso: PESO_OCORRENCIA[pior.codigo] });
      }
    } else {
      // sem a tabela de ocorrências: usa o status "Problema" das NFs do mês
      for (const l of doMes) if (l.e.status === 'Problema') ocorrencias.push({ e: l.e, codigo: 'problema', descricao: 'Status Problema', data: l.e.data_previsao || l.e.data_faturamento || '', peso: 0.5 });
    }
    const devolucoes = ent.devolucoes.filter((d) => String(d.transportadora_id ?? '') === id && noMes(d.data_emissao || d.created_at?.slice(0, 10), mes));
    const pesoQ = ocorrencias.reduce((s, o) => s + o.peso, 0) + devolucoes.length * 0.5;
    const taxa = pct(pesoQ, doMes.length);
    const avarias = ocorrencias.filter((o) => o.codigo === 'avaria').length;
    const qualidade: ResultadoCriterio = {
      nota: r1(clamp(10 - (taxa / cfg.limite_ocorrencias_pct) * 10)), base: doMes.length,
      valor: `${taxa.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`,
      detalhe: ocorrencias.length || devolucoes.length
        ? [avarias && `${avarias} avaria(s)`, ocorrencias.length - avarias && `${ocorrencias.length - avarias} outra(s) ocorrência(s)`, devolucoes.length && `${devolucoes.length} devolução(ões)`].filter(Boolean).join(' · ') + ` em ${doMes.length} NFs`
        : `Nenhuma ocorrência em ${doMes.length} NFs`,
    };

    // 4) Cobrança: CTEs do mês pela tabela (ou real × cotado) e faturas contestadas
    const audT = aud.filter((a) => a.transportadoraId === id || (!a.transportadoraId && transportadoraDoCte(a.cte, ent.transportadoras) === t.nome));
    const auditados = audT.filter((a) => a.esperado);
    const acimaTabela = auditados.filter((a) => a.situacao === 'acima');
    const valorAcimaTabela = acimaTabela.reduce((s, a) => s + (a.diferenca ?? 0), 0);
    const faturasContestadas = ent.faturas.filter((f) => String(f.transportadora_id) === id && toNumber(f.valor_contestado) > 0
      && (f.eventos ?? []).some((ev) => ev.acao.startsWith('Contestação') && noMes(ev.em.slice(0, 10), mes)));
    const valorContestado = faturasContestadas.reduce((s, f) => s + toNumber(f.valor_contestado), 0);
    let cobranca: ResultadoCriterio;
    if (auditados.length) {
      const pConf = pct(auditados.length - acimaTabela.length, auditados.length);
      const pen = Math.min(3, faturasContestadas.length); // cada fatura contestada tira 1 ponto (até 3)
      cobranca = { nota: r1(clamp(((pConf - 60) / 40) * 10 - pen)), valor: fmtPct(pConf), base: auditados.length,
        detalhe: `${auditados.length - acimaTabela.length} de ${auditados.length} CTEs dentro da tabela${acimaTabela.length ? ` · ${brl(valorAcimaTabela)} acima` : ''}${faturasContestadas.length ? ` · ${faturasContestadas.length} fatura(s) contestada(s)` : ''}` };
    } else {
      const comp = doMes.filter((l) => l.e.valor_frete_real !== null && l.e.valor_frete_real !== undefined && l.e.valor_frete_real !== '' && toNumber(l.e.valor_frete) > 0);
      if (comp.length) {
        const ok = comp.filter((l) => toNumber(l.e.valor_frete_real) <= toNumber(l.e.valor_frete) * (1 + ent.margemCotadoPct / 100) + 0.01).length;
        const pOk = pct(ok, comp.length);
        const pen = Math.min(3, faturasContestadas.length);
        cobranca = { nota: r1(clamp(((pOk - 60) / 40) * 10 - pen)), valor: fmtPct(pOk), base: comp.length,
          detalhe: `${ok} de ${comp.length} NFs com frete real até ${ent.margemCotadoPct}% acima do cotado (sem tabela de frete)${faturasContestadas.length ? ` · ${faturasContestadas.length} fatura(s) contestada(s)` : ''}` };
      } else cobranca = { nota: null, valor: '—', base: 0, detalhe: 'Sem CTEs para conferir no mês' };
    }

    // 5) Informação: entregas do mês informadas no portal / com canhoto
    const entreguesMes = ls.filter((l) => l.e.status === 'Entregue' && noMes(l.e.data_entrega_agendamento, mes)).map((l) => l.e);
    const semCanhoto: Entrega[] = [];
    let informacao: ResultadoCriterio = { nota: null, valor: '—', base: 0, detalhe: ent.ocorrencias === null ? 'Portal do transportador ainda não ativado' : 'Portal ainda não usado no mês (não entra na nota)' };
    if (ent.ocorrencias && portalEmUso && entreguesMes.length) {
      let comCanhoto = 0; let informadas = 0;
      for (const e of entreguesMes) {
        const os = ocPorEntrega.get(String(e.id)) ?? [];
        const ent2 = os.find((o) => o.codigo === 'entregue' && o.canhoto_path);
        if (ent2) comCanhoto++; else semCanhoto.push(e);
        if (os.some((o) => o.origem === 'portal')) informadas++;
      }
      const pCan = pct(comCanhoto, entreguesMes.length); const pInf = pct(informadas, entreguesMes.length);
      informacao = { nota: r1(clamp((pCan * 0.6 + pInf * 0.4) / 10)), valor: fmtPct(pCan), base: entreguesMes.length,
        detalhe: `${comCanhoto} de ${entreguesMes.length} entregas com canhoto · ${informadas} informadas pelo portal` };
    }

    const criterios = { prazo, coleta, qualidade, cobranca, informacao };
    let soma = 0; let pesos = 0;
    for (const c of CRITERIOS) { const r = criterios[c.id]; const p = cfg.pesos[c.id]; if (r.nota !== null && p > 0) { soma += r.nota * p; pesos += p; } }
    const nota = pesos ? r1(soma / pesos) : null;

    const pontos: string[] = [];
    if (atrasos.length) pontos.push(`${atrasos.length} entrega(s) com atraso${atrasos.some((a) => a.aberta) ? ` (${atrasos.filter((a) => a.aberta).length} ainda em aberto)` : ''} — média de ${r1(mediaAtraso).toLocaleString('pt-BR')} dia(s) útil(eis)`);
    if (coletasAtrasadas.length) pontos.push(`${coletasAtrasadas.length} coleta(s) depois do D+${ent.sla.coleta_dias}`);
    if (avarias) pontos.push(`${avarias} avaria(s) registrada(s)`);
    if (ocorrencias.length - avarias > 0) pontos.push(`${ocorrencias.length - avarias} NF(s) com ocorrência de entrega (ausente, endereço, reentrega ou recusa)`);
    if (devolucoes.length) pontos.push(`${devolucoes.length} devolução(ões) no mês`);
    if (acimaTabela.length) pontos.push(`${acimaTabela.length} CTE(s) acima da tabela de frete — ${brl(valorAcimaTabela)} a mais`);
    if (faturasContestadas.length) pontos.push(`${faturasContestadas.length} fatura(s) contestada(s) — ${brl(valorContestado)}`);
    if (informacao.nota !== null && semCanhoto.length) pontos.push(`${semCanhoto.length} entrega(s) sem foto do canhoto no portal`);
    const destaques = CRITERIOS.filter((c) => (criterios[c.id].nota ?? 0) >= 9 && criterios[c.id].base > 0).map((c) => `${c.label}: ${criterios[c.id].valor}`);

    out.push({
      id, nome: t.nome, transportadora: t, nfs: doMes.length, faturamento,
      criterios, nota, conceito: conceitoDe(nota), amostraPequena: doMes.length < cfg.min_nfs,
      pontos, destaques, atrasos, coletasAtrasadas, ocorrencias, devolucoes, acimaTabela, valorAcimaTabela, faturasContestadas, valorContestado, semCanhoto,
    });
  }
  return out.sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1) || b.nfs - a.nfs);
}

/** Nota dos últimos N meses (do mais antigo ao mais recente) por transportadora. */
export function historicoNotas(mes: string, ent: EntradaAvaliacao, hoje: string, n = 6): { meses: string[]; porTransp: Map<string, (number | null)[]> } {
  const meses = Array.from({ length: n }, (_, i) => mesAnterior(mes, n - 1 - i));
  const porTransp = new Map<string, (number | null)[]>();
  meses.forEach((m, i) => {
    for (const a of avaliarMes(m, ent, hoje)) {
      const arr = porTransp.get(a.id) ?? Array(n).fill(null);
      arr[i] = a.nota; porTransp.set(a.id, arr);
    }
  });
  return { meses, porTransp };
}

/** Resumo em texto (WhatsApp / e-mail) para enviar à transportadora. */
export function mensagemAvaliacao(a: AvaliacaoTransportadora, rotuloMes: string, anterior: number | null, empresa = 'Munila'): string {
  const n = (v: number | null) => (v === null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  const linhas = [
    `Olá, equipe ${a.nome}!`,
    '',
    `Segue a avaliação de desempenho de ${rotuloMes} com a ${empresa}:`,
    '',
    `*Nota geral: ${n(a.nota)} / 10${a.conceito ? ` (${a.conceito} — ${CONCEITO[a.conceito].label})` : ''}*${anterior !== null && a.nota !== null ? ` · mês anterior ${n(anterior)}` : ''}`,
    '',
    ...CRITERIOS.filter((c) => a.criterios[c.id].nota !== null).map((c) => `• ${c.label}: ${n(a.criterios[c.id].nota)} — ${a.criterios[c.id].detalhe}`),
  ];
  if (a.pontos.length) linhas.push('', '*Pontos de atenção:*', ...a.pontos.map((p) => `• ${p}`));
  if (a.destaques.length) linhas.push('', '*Destaques:*', ...a.destaques.map((p) => `• ${p}`));
  linhas.push('', 'Contamos com vocês para manter (e melhorar) esses números. Qualquer dúvida, estamos à disposição.', '', 'Obrigado!');
  return linhas.join('\n');
}
