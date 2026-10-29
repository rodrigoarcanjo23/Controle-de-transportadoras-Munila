// Faturas de frete: a cobrança da transportadora (boleto/fatura) que junta vários CTEs.
// Conferência: cada CTE da fatura é localizado no sistema e auditado pela tabela de
// frete; a soma é comparada com o valor cobrado; cobranças em dobro são apontadas.
import type { Cte, Entrega, Transportadora } from '../types';
import { auditarCtes, type LinhaAuditoria, type TabelaFrete } from './tabelaFrete';
import { transportadoraDoCte } from './financeiro';
import { toNumber } from './format';

export type StatusFatura = 'recebida' | 'conferida' | 'contestada' | 'aprovada' | 'paga' | 'cancelada';
export const STATUS_FATURA: Record<StatusFatura, { label: string; tone: string; dica: string }> = {
  recebida: { label: 'A conferir', tone: 'blue', dica: 'Fatura recebida, aguardando conferência.' },
  conferida: { label: 'Conferida', tone: 'purple', dica: 'Conferida sem divergências, aguardando aprovação do pagamento.' },
  contestada: { label: 'Contestada', tone: 'orange', dica: 'Divergência enviada à transportadora, aguardando resposta/correção.' },
  aprovada: { label: 'Aprovada p/ pagar', tone: 'amber', dica: 'Pagamento liberado, aguardando a baixa.' },
  paga: { label: 'Paga', tone: 'green', dica: 'Pagamento registrado.' },
  cancelada: { label: 'Cancelada', tone: 'slate', dica: 'Fatura substituída ou cancelada pela transportadora.' },
};
/** Faturas que ainda pedem alguma ação (não pagas nem canceladas). */
export const EM_ABERTO: StatusFatura[] = ['recebida', 'conferida', 'contestada', 'aprovada'];

export interface EventoFatura { em: string; por: string; acao: string; detalhe?: string }
export interface Fatura {
  id: string; numero: string; transportadora_id: string;
  emissao: string | null; vencimento: string; valor: number | string;
  ctes: string[]; status: StatusFatura;
  valor_contestado: number | string | null; motivo_contestacao: string | null;
  valor_aprovado: number | string | null; pago_em: string | null;
  observacao: string | null; arquivo_path: string | null;
  eventos: EventoFatura[] | null; criado_por: string | null;
  created_at: string; updated_at: string;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const digitos = (s?: string | null) => (s ?? '').replace(/\D/g, '');
/** "000123" → "123" (os números de CTE vêm com ou sem zeros à esquerda). */
export const normCte = (s: string) => { const d = digitos(s); return d ? String(Number(d)) : ''; };

/**
 * Lê os números de CTE colados (do boleto, e-mail, planilha ou PDF): aceita números
 * separados por espaço, vírgula, ponto e vírgula, barra ou linha, e chaves de 44 dígitos.
 */
export function lerNumerosCte(texto: string): string[] {
  const out: string[] = [];
  for (const g of texto.match(/\d[\d.]*\d|\d/g) ?? []) {
    const d = g.replace(/\./g, '');
    if (d.length === 44) out.push(String(Number(d.slice(25, 34))));
    else if (d.length >= 1 && d.length <= 10 && Number(d) > 0) out.push(String(Number(d)));
  }
  return out; // mantém repetidos: CTE repetido na fatura é cobrança em dobro
}

/** Transportadora (cadastro) de um CTE: pelo CNPJ do emitente ou pelo nome. */
function idDaTransportadora(c: Cte, transps: Transportadora[]): string | null {
  const nome = transportadoraDoCte(c, transps);
  const t = transps.find((x) => x.nome === nome);
  return t ? String(t.id) : null;
}

/** CTEs do sistema que correspondem ao número, preferindo os emitidos pela transportadora da fatura. */
export function localizarCte(numero: string, transportadoraId: string, indice: Map<string, Cte[]>, transps: Transportadora[]): { cte: Cte | null; outraTransportadora: boolean } {
  const cands = indice.get(numero) ?? [];
  if (!cands.length) return { cte: null, outraTransportadora: false };
  const daTransp = cands.find((c) => idDaTransportadora(c, transps) === transportadoraId);
  if (daTransp) return { cte: daTransp, outraTransportadora: false };
  // CTE de emitente sem cadastro: aceita se não houver ambiguidade
  if (cands.length === 1) {
    const id = idDaTransportadora(cands[0], transps);
    return { cte: cands[0], outraTransportadora: id !== null && id !== transportadoraId };
  }
  return { cte: null, outraTransportadora: false };
}

export const indiceCtes = (ctes: Cte[]) => {
  const m = new Map<string, Cte[]>();
  for (const c of ctes) { const n = normCte(c.numero_documento ?? ''); if (n) m.set(n, [...(m.get(n) ?? []), c]); }
  return m;
};

export type ProblemaCte = 'nao_encontrado' | 'repetido' | 'outra_fatura' | 'outra_transportadora' | 'acima_tabela' | 'nf_em_2_ctes' | 'nf_nao_entregue' | 'sem_nf';
export const PROBLEMA: Record<ProblemaCte, { label: string; tone: string; dica: string; contesta: boolean }> = {
  repetido: { label: 'Repetido na fatura', tone: 'red', dica: 'O mesmo CTE aparece duas vezes nesta fatura (contado uma vez na soma).', contesta: true },
  outra_fatura: { label: 'Já em outra fatura', tone: 'red', dica: 'Este CTE já foi cobrado em outra fatura.', contesta: true },
  acima_tabela: { label: 'Acima da tabela', tone: 'red', dica: 'Valor do CTE acima da tabela de frete combinada.', contesta: true },
  outra_transportadora: { label: 'Outra transportadora', tone: 'orange', dica: 'O CTE foi emitido por outra transportadora.', contesta: true },
  nao_encontrado: { label: 'CTE não registrado', tone: 'amber', dica: 'Registre o XML do CTE (Registro de CTE) para conferir.', contesta: false },
  nf_em_2_ctes: { label: 'NF em 2+ CTEs', tone: 'orange', dica: 'Alguma NF deste CTE também está em outro CTE — confira se não é cobrança em dobro.', contesta: false },
  nf_nao_entregue: { label: 'NF não entregue', tone: 'amber', dica: 'Há NF deste CTE ainda sem entrega confirmada.', contesta: false },
  sem_nf: { label: 'NF fora do Painel', tone: 'slate', dica: 'As NFs do CTE não estão no Painel de Entregas.', contesta: false },
};

export interface ItemConferencia {
  numero: string; cte: Cte | null; valor: number;
  aud: LinhaAuditoria | null; nfs: Entrega[];
  problemas: ProblemaCte[];
  /** quanto deste CTE é contestável (dobro = valor todo; acima da tabela = a diferença) */
  aContestar: number;
  /** já lançado no Infarma (situação FECHADO) */
  lancado: boolean;
  /** fatura onde o CTE também aparece */
  outraFatura?: string;
}
export interface Conferencia {
  itens: ItemConferencia[];
  somaCtes: number;
  /** valor da fatura − soma dos CTEs localizados (só quando todos foram localizados) */
  diferencaSoma: number | null;
  naoEncontrados: number;
  aContestar: number;
  situacao: 'ok' | 'atencao' | 'divergente' | 'vazia';
  motivos: string[];
  lancados: number;
}

const ENTREGUE = new Set(['Entregue']);
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export interface ContextoConferencia {
  ctes: Cte[]; entregas: Entrega[]; tabelas: TabelaFrete[]; transportadoras: Transportadora[];
  faturas: Fatura[]; tolPct: number; indice?: Map<string, Cte[]>;
}

export function conferirFatura(f: Pick<Fatura, 'id' | 'valor' | 'ctes' | 'transportadora_id'>, ctx: ContextoConferencia): Conferencia {
  const indice = ctx.indice ?? indiceCtes(ctx.ctes);
  const transpId = String(f.transportadora_id);
  const numeros = (f.ctes ?? []).map(normCte).filter(Boolean);

  // CTEs cobrados em outras faturas da mesma transportadora (não canceladas)
  const emOutras = new Map<string, string>();
  for (const o of ctx.faturas) {
    if (o.id === f.id || o.status === 'cancelada' || String(o.transportadora_id) !== transpId) continue;
    for (const n of o.ctes ?? []) { const k = normCte(n); if (k && !emOutras.has(k)) emOutras.set(k, o.numero); }
  }

  const localizados = numeros.map((n) => ({ n, ...localizarCte(n, transpId, indice, ctx.transportadoras) }));
  const encontrados = [...new Map(localizados.filter((l) => l.cte).map((l) => [l.cte!.id, l.cte!])).values()];
  const aud = new Map(auditarCtes(encontrados, ctx.ctes, ctx.entregas, ctx.tabelas, ctx.tolPct).map((l) => [l.cte.id, l]));

  const vistos = new Set<string>();
  const itens: ItemConferencia[] = localizados.map(({ n, cte, outraTransportadora }) => {
    const problemas: ProblemaCte[] = [];
    let aContestar = 0;
    const valor = cte ? toNumber(cte.valor_total_servico) : 0;
    const a = cte ? aud.get(cte.id) ?? null : null;
    const outra = emOutras.get(n);
    const lancado = !!cte && String(cte.situacao ?? '').toUpperCase() === 'FECHADO';
    // cobrança em dobro: o valor inteiro é contestável e os demais detalhes não importam
    if (vistos.has(n) || outra) {
      const p: ProblemaCte = vistos.has(n) ? 'repetido' : 'outra_fatura';
      vistos.add(n);
      // repetido: a diferença aparece na soma (fatura × CTEs distintos); já em outra fatura: o valor todo é indevido
      return { numero: n, cte, valor, aud: a, nfs: a?.nfs ?? [], problemas: [p], aContestar: p === 'repetido' ? 0 : r2(valor), lancado, outraFatura: p === 'outra_fatura' ? outra : undefined };
    }
    vistos.add(n);
    if (!cte) problemas.push('nao_encontrado');
    if (outraTransportadora) { problemas.push('outra_transportadora'); aContestar = Math.max(aContestar, valor); }
    if (a) {
      if (a.situacao === 'acima' && a.diferenca) { problemas.push('acima_tabela'); aContestar = Math.max(aContestar, a.diferenca); }
      if (a.duplicada) problemas.push('nf_em_2_ctes');
      if (a.situacao === 'sem_nf') problemas.push('sem_nf');
      if (a.nfs.some((e) => !ENTREGUE.has(e.status))) problemas.push('nf_nao_entregue');
    }
    return { numero: n, cte, valor, aud: a, nfs: a?.nfs ?? [], problemas, aContestar: r2(aContestar), lancado };
  });

  const valorFatura = toNumber(f.valor);
  const naoEncontrados = itens.filter((i) => !i.cte).length;
  // soma dos CTEs distintos: um CTE repetido na fatura vira diferença a contestar
  const somaCtes = r2(itens.filter((i) => !i.problemas.includes('repetido')).reduce((s, i) => s + i.valor, 0));
  const diferencaSoma = naoEncontrados || !itens.length ? null : r2(valorFatura - somaCtes);
  let aContestar = itens.reduce((s, i) => s + i.aContestar, 0);
  // sem a soma conferível (CTE não registrado), o repetido entra direto na contestação
  if (diferencaSoma === null) aContestar += itens.filter((i) => i.problemas.includes('repetido')).reduce((s, i) => s + i.valor, 0);
  const motivos: string[] = [];
  if (diferencaSoma !== null && diferencaSoma > 0.05) { aContestar += diferencaSoma; motivos.push(`Fatura ${brl(diferencaSoma)} maior que a soma dos CTEs`); }
  if (diferencaSoma !== null && diferencaSoma < -0.05) motivos.push(`Fatura ${brl(-diferencaSoma)} menor que a soma dos CTEs (desconto ou CTE faltando)`);
  const conta = (p: ProblemaCte) => itens.filter((i) => i.problemas.includes(p)).length;
  (Object.keys(PROBLEMA) as ProblemaCte[]).forEach((p) => { const n = conta(p); if (n) motivos.push(`${PROBLEMA[p].label}: ${n} CTE${n > 1 ? 's' : ''}`); });

  aContestar = r2(Math.min(aContestar, valorFatura));
  const situacao: Conferencia['situacao'] = !itens.length ? 'vazia'
    : aContestar > 0.05 ? 'divergente'
    : motivos.length ? 'atencao' : 'ok';
  return { itens, somaCtes, diferencaSoma, naoEncontrados, aContestar, situacao, motivos, lancados: new Set(itens.filter((i) => i.lancado).map((i) => i.cte!.id)).size };
}

export const SITUACAO_CONF: Record<Conferencia['situacao'], { label: string; tone: string }> = {
  ok: { label: 'Sem divergência', tone: 'green' },
  atencao: { label: 'Verificar', tone: 'amber' },
  divergente: { label: 'Divergente', tone: 'red' },
  vazia: { label: 'Sem CTEs', tone: 'slate' },
};

/** CTEs da transportadora que ainda não estão em nenhuma fatura (não cancelada). */
export function ctesSemFatura(ctes: Cte[], faturas: Fatura[], transps: Transportadora[], transportadoraId?: string): Cte[] {
  const usados = new Map<string, Set<string>>(); // transportadora → números
  for (const f of faturas) {
    if (f.status === 'cancelada') continue;
    const s = usados.get(String(f.transportadora_id)) ?? new Set<string>();
    (f.ctes ?? []).forEach((n) => s.add(normCte(n)));
    usados.set(String(f.transportadora_id), s);
  }
  return ctes.filter((c) => {
    const t = idDaTransportadora(c, transps);
    if (transportadoraId && t !== String(transportadoraId)) return false;
    const n = normCte(c.numero_documento ?? '');
    return !!n && !(t && usados.get(t)?.has(n));
  });
}
export const transportadoraIdDoCte = idDaTransportadora;

/* ---------- prazos ---------- */
const dia = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
/** dias até o vencimento (negativo = vencida). */
export const diasParaVencer = (venc: string, hoje: string) => Math.round((dia(venc) - dia(hoje)) / 864e5);

export interface ResumoFaturas {
  vencidas: { n: number; valor: number };
  vencendo: { n: number; valor: number };
  aConferir: { n: number; valor: number };
  contestadas: { n: number; valor: number; contestado: number };
  aPagar: { n: number; valor: number };
  pagasMes: { n: number; valor: number };
  economia: number;
}
/** Valor que efetivamente sai do caixa (aprovado, senão o da fatura). */
export const valorAPagar = (f: Fatura) => (f.valor_aprovado !== null && f.valor_aprovado !== undefined && f.valor_aprovado !== '' ? toNumber(f.valor_aprovado) : toNumber(f.valor));

export function resumirFaturas(faturas: Fatura[], hoje: string, diasAviso = 7): ResumoFaturas {
  const r: ResumoFaturas = { vencidas: { n: 0, valor: 0 }, vencendo: { n: 0, valor: 0 }, aConferir: { n: 0, valor: 0 }, contestadas: { n: 0, valor: 0, contestado: 0 }, aPagar: { n: 0, valor: 0 }, pagasMes: { n: 0, valor: 0 }, economia: 0 };
  const mes = hoje.slice(0, 7);
  for (const f of faturas) {
    const v = toNumber(f.valor);
    if (EM_ABERTO.includes(f.status)) {
      const d = diasParaVencer(f.vencimento, hoje);
      if (d < 0) { r.vencidas.n++; r.vencidas.valor += valorAPagar(f); }
      else if (d <= diasAviso) { r.vencendo.n++; r.vencendo.valor += valorAPagar(f); }
    }
    if (f.status === 'recebida') { r.aConferir.n++; r.aConferir.valor += v; }
    if (f.status === 'contestada') { r.contestadas.n++; r.contestadas.valor += v; r.contestadas.contestado += toNumber(f.valor_contestado); }
    if (f.status === 'aprovada' || f.status === 'conferida') { r.aPagar.n++; r.aPagar.valor += valorAPagar(f); }
    if (f.status === 'paga' && f.pago_em?.startsWith(mes)) { r.pagasMes.n++; r.pagasMes.valor += valorAPagar(f); }
    if ((f.status === 'aprovada' || f.status === 'paga') && valorAPagar(f) < v) r.economia += v - valorAPagar(f);
  }
  return r;
}

/** Mensagem de contestação pronta para a transportadora. */
export function mensagemContestacao(f: Pick<Fatura, 'numero' | 'valor' | 'vencimento'>, conf: Conferencia, nomeTransp: string, valorContestado: number, motivo: string): string {
  // só o que é cobrável da transportadora (avisos internos, como "NF não entregue", ficam de fora)
  const linhas = conf.itens.filter((i) => i.aContestar > 0 || i.problemas.includes('repetido')).map((i) => {
    const p = i.problemas.filter((x) => PROBLEMA[x].contesta).map((x) => PROBLEMA[x].label.toLowerCase()).join(', ');
    const extra = i.problemas.includes('acima_tabela') && i.aud?.esperado ? ` — cobrado ${brl(i.valor)}, tabela ${brl(i.aud.esperado.total)}` : i.outraFatura ? ` — já cobrado na fatura ${i.outraFatura}` : '';
    return `• CTE ${i.numero}${i.nfs.length ? ` (NF ${i.nfs.map((e) => e.nota_fiscal).join(', ')})` : ''}: ${p}${extra}${i.aContestar ? ` → ${brl(i.aContestar)}` : ''}`;
  });
  const dv = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
  return [
    `Olá, equipe ${nomeTransp}!`,
    '',
    `Na conferência da fatura ${f.numero} (${brl(toNumber(f.valor))}, vencimento ${dv(f.vencimento)}) encontramos divergências no valor de ${brl(valorContestado)}:`,
    '',
    ...(linhas.length ? linhas : ['• ' + (conf.motivos[0] ?? 'divergência de valores')]),
    ...(conf.diferencaSoma !== null && conf.diferencaSoma > 0.05 ? [`• Valor da fatura maior que a soma dos CTEs em ${brl(conf.diferencaSoma)}`] : []),
    ...(motivo.trim() ? ['', motivo.trim()] : []),
    '',
    `Podem, por favor, emitir a fatura corrigida (ou o desconto) no valor de ${brl(Math.max(0, toNumber(f.valor) - valorContestado))}?`,
    '',
    'Obrigado!',
  ].join('\n');
}

/** Data ISO N dias antes de outra data ISO. */
export function diasAntes(iso: string, n: number) {
  const d = new Date(dia(iso)); d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
