// Tabela de frete por transportadora × UF e o cálculo do frete "esperado",
// componente por componente (como fazem os módulos de auditoria de frete).
import type { Cte, Entrega } from '../types';
import { calcularIntegracao } from './integracaoCte';

export interface Faixa { ate_kg: number; valor: number }
export interface Taxa { nome: string; valor: number }
export interface Componentes {
  /** frete peso por faixa (valor fechado até X kg) */
  faixas: Faixa[];
  /** R$ por kg acima da última faixa (ou por kg, se não houver faixas) */
  excedente_kg: number;
  /** frete-valor / ad valorem: % sobre o valor da NF */
  advalorem_pct: number;
  /** GRIS (gerenciamento de risco): % sobre o valor da NF */
  gris_pct: number;
  /** pedágio por fração de 100 kg */
  pedagio_100kg: number;
  /** taxas fixas por NF/CTE: TDE, TAS, despacho, agendamento… */
  taxas: Taxa[];
  /** frete mínimo (antes do ICMS) */
  minimo: number;
  /** ICMS embutido no frete (%) — 0 se a tabela já é com imposto */
  icms_pct: number;
  /** prazo contratado em dias úteis (opcional — alimenta o SLA) */
  prazo_dias?: number | null;
}
export interface TabelaFrete { id?: string; transportadora_id: string; uf: string; nome?: string | null; componentes: Componentes; ativo: boolean; updated_at?: string }

export const COMPONENTES_VAZIOS: Componentes = {
  faixas: [{ ate_kg: 10, valor: 0 }, { ate_kg: 30, valor: 0 }, { ate_kg: 50, valor: 0 }, { ate_kg: 100, valor: 0 }],
  excedente_kg: 0, advalorem_pct: 0, gris_pct: 0, pedagio_100kg: 0, taxas: [], minimo: 0, icms_pct: 0, prazo_dias: null,
};

export function normalizar(c: Partial<Componentes> | null | undefined): Componentes {
  const n = (x: unknown) => (typeof x === 'number' && isFinite(x) && x >= 0 ? x : 0);
  return {
    faixas: (Array.isArray(c?.faixas) ? c!.faixas : []).filter((f) => f && n(f.ate_kg) > 0).map((f) => ({ ate_kg: n(f.ate_kg), valor: n(f.valor) })).sort((a, b) => a.ate_kg - b.ate_kg),
    excedente_kg: n(c?.excedente_kg), advalorem_pct: n(c?.advalorem_pct), gris_pct: n(c?.gris_pct), pedagio_100kg: n(c?.pedagio_100kg),
    taxas: (Array.isArray(c?.taxas) ? c!.taxas : []).filter((t) => t && t.nome).map((t) => ({ nome: String(t.nome), valor: n(t.valor) })),
    minimo: n(c?.minimo), icms_pct: Math.min(n(c?.icms_pct), 30), prazo_dias: c?.prazo_dias && c.prazo_dias > 0 ? Math.round(c.prazo_dias) : null,
  };
}

export interface ItemCalculo { nome: string; valor: number; detalhe?: string }
export interface Calculo { itens: ItemCalculo[]; subtotal: number; minimoAplicado: boolean; icms: number; total: number }

const r2 = (v: number) => Math.round(v * 100) / 100;
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Frete esperado para um peso (kg) e valor de mercadoria (R$). */
export function calcularFrete(comp: Componentes, pesoKg: number, valorNf: number): Calculo {
  const c = normalizar(comp);
  const peso = Math.max(0, pesoKg || 0); const valor = Math.max(0, valorNf || 0);
  const itens: ItemCalculo[] = [];
  let fretePeso: number; let det: string;
  if (c.faixas.length) {
    const f = c.faixas.find((x) => peso <= x.ate_kg);
    if (f) { fretePeso = f.valor; det = `faixa até ${f.ate_kg} kg`; }
    else {
      const ult = c.faixas[c.faixas.length - 1];
      fretePeso = ult.valor + (peso - ult.ate_kg) * c.excedente_kg;
      det = `faixa ${ult.ate_kg} kg + ${(peso - ult.ate_kg).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg × ${brl(c.excedente_kg)}`;
    }
  } else { fretePeso = peso * c.excedente_kg; det = `${peso} kg × ${brl(c.excedente_kg)}`; }
  itens.push({ nome: 'Frete peso', valor: r2(fretePeso), detalhe: det });
  if (c.advalorem_pct) itens.push({ nome: 'Frete-valor (ad valorem)', valor: r2((valor * c.advalorem_pct) / 100), detalhe: `${c.advalorem_pct}% de ${brl(valor)}` });
  if (c.gris_pct) itens.push({ nome: 'GRIS', valor: r2((valor * c.gris_pct) / 100), detalhe: `${c.gris_pct}% de ${brl(valor)}` });
  if (c.pedagio_100kg) { const fr = Math.max(1, Math.ceil(peso / 100)); itens.push({ nome: 'Pedágio', valor: r2(fr * c.pedagio_100kg), detalhe: `${fr} × ${brl(c.pedagio_100kg)} (por 100 kg)` }); }
  c.taxas.forEach((t) => itens.push({ nome: t.nome, valor: r2(t.valor), detalhe: 'taxa fixa' }));
  let subtotal = r2(itens.reduce((s, i) => s + i.valor, 0));
  const minimoAplicado = c.minimo > subtotal;
  if (minimoAplicado) { itens.push({ nome: 'Ajuste ao frete mínimo', valor: r2(c.minimo - subtotal), detalhe: `mínimo ${brl(c.minimo)}` }); subtotal = c.minimo; }
  const total = c.icms_pct ? r2(subtotal / (1 - c.icms_pct / 100)) : subtotal;
  const icms = r2(total - subtotal);
  if (icms) itens.push({ nome: 'ICMS', valor: icms, detalhe: `${c.icms_pct}% por dentro` });
  return { itens, subtotal, minimoAplicado, icms, total };
}

/** Tabela que vale para a transportadora e UF (a da UF tem prioridade sobre "todas as UFs"). */
export function tabelaPara(tabelas: TabelaFrete[], transportadoraId: string | null | undefined, uf: string): TabelaFrete | undefined {
  if (!transportadoraId) return undefined;
  const t = String(transportadoraId);
  return tabelas.find((x) => x.ativo && x.transportadora_id === t && x.uf === uf) ?? tabelas.find((x) => x.ativo && x.transportadora_id === t && x.uf === '*');
}

/* ------------------------------------------------------------------ */
/* Auditoria: CTE cobrado × frete esperado pela tabela                  */
/* ------------------------------------------------------------------ */

export type SituacaoAuditoria = 'acima' | 'conforme' | 'abaixo' | 'sem_tabela' | 'sem_peso' | 'sem_nf';
export const SITUACAO_AUDITORIA: Record<SituacaoAuditoria, { label: string; tone: string; dica: string }> = {
  acima: { label: 'Acima da tabela', tone: 'red', dica: 'Cobrado mais do que a tabela permite — contestar com a transportadora.' },
  conforme: { label: 'Conforme', tone: 'green', dica: 'Dentro da tolerância da tabela.' },
  abaixo: { label: 'Abaixo da tabela', tone: 'blue', dica: 'Cobrado menos que a tabela (desconto ou tabela desatualizada).' },
  sem_tabela: { label: 'Sem tabela', tone: 'slate', dica: 'Cadastre a tabela de frete da transportadora (Transportadoras › tabela).' },
  sem_peso: { label: 'Sem peso', tone: 'purple', dica: 'Preencha o peso das NFs para calcular o frete esperado.' },
  sem_nf: { label: 'NF não encontrada', tone: 'amber', dica: 'As NFs do CTE não estão no Painel de Entregas.' },
};

export interface LinhaAuditoria {
  cte: Cte; transportadora: string; transportadoraId: string | null; uf: string;
  nfs: Entrega[]; peso: number; valorNf: number;
  esperado: Calculo | null; cobrado: number; diferenca: number | null; diferencaPct: number | null;
  situacao: SituacaoAuditoria;
  /** alguma NF do CTE também aparece em outro CTE (possível cobrança em dobro) */
  duplicada: boolean; nfsDuplicadas: string[];
}

/** Audita cada CTE: soma peso e valor das NFs e recalcula pela tabela da transportadora para a UF de destino. */
export function auditarCtes(ctes: Cte[], todosCtes: Cte[], entregas: Entrega[], tabelas: TabelaFrete[], tolPct: number): LinhaAuditoria[] {
  const calc = calcularIntegracao(todosCtes, entregas);
  const porId = new Map(entregas.map((e) => [String(e.id), e]));
  return ctes.map((cte) => {
    const r = calc.porCte.get(cte.id);
    const nfs = (r?.entregas ?? []).map((id) => porId.get(String(id))).filter((e): e is Entrega => !!e);
    const cobrado = Number(cte.valor_total_servico) || 0;
    const e0 = nfs[0];
    const uf = e0 ? (e0.uf_destino || e0.clientes?.uf || '') : '';
    const transportadoraId = e0?.transportadora_id ? String(e0.transportadora_id) : null;
    const transportadora = e0?.transportadoras?.nome ?? cte.razao_social_emitente ?? '—';
    const peso = nfs.reduce((s, e) => s + (Number(e.peso_kg) || 0), 0);
    const valorNf = nfs.reduce((s, e) => s + (Number(e.valor_nf) || 0), 0);
    const nfsDuplicadas = r?.emOutrosCtes ?? [];
    const base = { cte, transportadora, transportadoraId, uf, nfs, peso, valorNf, cobrado, duplicada: nfsDuplicadas.length > 0, nfsDuplicadas };
    if (!nfs.length) return { ...base, esperado: null, diferenca: null, diferencaPct: null, situacao: 'sem_nf' as const };
    const tab = tabelaPara(tabelas, transportadoraId, uf);
    if (!tab) return { ...base, esperado: null, diferenca: null, diferencaPct: null, situacao: 'sem_tabela' as const };
    if (peso <= 0) return { ...base, esperado: null, diferenca: null, diferencaPct: null, situacao: 'sem_peso' as const };
    const esperado = calcularFrete(tab.componentes, peso, valorNf);
    const diferenca = r2(cobrado - esperado.total);
    const diferencaPct = esperado.total > 0 ? (diferenca / esperado.total) * 100 : null;
    const limite = Math.max(1, (esperado.total * tolPct) / 100);
    const situacao: SituacaoAuditoria = diferenca > limite ? 'acima' : diferenca < -limite ? 'abaixo' : 'conforme';
    return { ...base, esperado, diferenca, diferencaPct, situacao };
  }).sort((a, b) => (b.diferenca ?? -Infinity) - (a.diferenca ?? -Infinity));
}
