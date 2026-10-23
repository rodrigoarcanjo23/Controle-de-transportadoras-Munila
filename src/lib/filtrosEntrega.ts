import type { Entrega, Transportadora } from '../types';
import { REGIOES, MODAIS } from './constants';
import { formatDate, hasValue, matchesSearch, percentFreteEntrega, toNumber } from './format';

export interface FiltrosEntrega {
  busca: string;
  dataInicio: string;
  dataFim: string;
  transportadora: string;
  modal: string;
  status: string[];
  regiao: string;
  uf: string;
  valorNfMin: string;
  valorNfMax: string;
  percFreteMin: string;
  percFreteMax: string;
  freteVazio: boolean;
  freteConfirmado: boolean;
  comAgendamento: boolean;
  semAgendamento: boolean;
  comFreteCotado: boolean;
  comFreteReal: boolean;
  semDataEntrega: boolean;
  /** lista fixa de entregas (ex.: vindas de um alerta) */
  nfsIds: string[];
  /** nome do filtro acima, exibido no chip */
  nfsRotulo: string;
}

export const FILTROS_VAZIOS: FiltrosEntrega = {
  busca: '', dataInicio: '', dataFim: '', transportadora: '', modal: '', status: [],
  regiao: '', uf: '', valorNfMin: '', valorNfMax: '', percFreteMin: '', percFreteMax: '',
  freteVazio: false, freteConfirmado: false, comAgendamento: false, semAgendamento: false,
  comFreteCotado: false, comFreteReal: false, semDataEntrega: false,
  nfsIds: [], nfsRotulo: '',
};

export const FLAGS: { key: keyof FiltrosEntrega; label: string }[] = [
  { key: 'freteVazio', label: 'Fretes zerados' },
  { key: 'freteConfirmado', label: 'Frete confirmado' },
  { key: 'comAgendamento', label: 'Com agendamento' },
  { key: 'semAgendamento', label: 'Sem agendamento' },
  { key: 'comFreteCotado', label: 'Com frete cotado' },
  { key: 'comFreteReal', label: 'Com frete real' },
  { key: 'semDataEntrega', label: 'Sem data de entrega' },
];

export const ufDestino = (e: Entrega) => e.uf_destino || e.clientes?.uf || '';
export const cidadeDestino = (e: Entrega) => e.cidade_destino || e.clientes?.cidade || '';
export const modalDe = (e: Entrega) => e.modal_frete || e.transportadoras?.modal_padrao || '';

export function filtrarEntregas(entregas: Entrega[], f: FiltrosEntrega): Entrega[] {
  const nfMin = f.valorNfMin ? Number(f.valorNfMin) : null;
  const nfMax = f.valorNfMax ? Number(f.valorNfMax) : null;
  const pMin = f.percFreteMin ? Number(f.percFreteMin) : null;
  const pMax = f.percFreteMax ? Number(f.percFreteMax) : null;
  const ufsRegiao = f.regiao ? REGIOES[f.regiao] ?? [] : null;
  const soIds = f.nfsIds?.length ? new Set(f.nfsIds) : null;

  return entregas
    .filter((e) => {
      if (soIds && !soIds.has(e.id)) return false;
      if (f.busca && !matchesSearch(f.busca, e.nota_fiscal, e.clientes?.nome, e.transportadoras?.nome, e.status, cidadeDestino(e))) return false;
      if (f.dataInicio && (e.data_faturamento ?? '') < f.dataInicio) return false;
      if (f.dataFim && (e.data_faturamento ?? '') > f.dataFim) return false;
      if (f.transportadora && e.transportadora_id !== f.transportadora) return false;
      if (f.modal && e.modal_frete !== f.modal && e.transportadoras?.modal_padrao !== f.modal) return false;
      if (f.status.length && !f.status.includes(e.status)) return false;
      if (f.freteVazio && (e.valor_frete_real || e.valor_frete)) return false;
      if (f.freteConfirmado && e.frete_confirmado !== true) return false;
      if (f.comAgendamento && e.tem_agendamento !== true) return false;
      if (f.semAgendamento && e.tem_agendamento) return false;
      if (f.comFreteCotado && !(toNumber(e.valor_frete) > 0)) return false;
      if (f.comFreteReal && !(toNumber(e.valor_frete_real) > 0)) return false;
      const uf = ufDestino(e);
      if (f.uf && uf !== f.uf) return false;
      if (ufsRegiao && !ufsRegiao.includes(uf)) return false;
      if (f.semDataEntrega && e.data_entrega_agendamento) return false;
      const nf = toNumber(e.valor_nf);
      if (nfMin !== null && nf < nfMin) return false;
      if (nfMax !== null && nf > nfMax) return false;
      if (pMin !== null || pMax !== null) {
        const p = percentFreteEntrega(e);
        if (pMin !== null && p < pMin) return false;
        if (pMax !== null && p > pMax) return false;
      }
      return true;
    })
    .sort((a, b) =>
      new Date(b.data_faturamento || b.created_at || 0).getTime() -
      new Date(a.data_faturamento || a.created_at || 0).getTime());
}

/** Lista de "chips" com os filtros ativos — cada um sabe se remover. */
export function filtrosAtivos(f: FiltrosEntrega, transportadoras: Transportadora[]) {
  const chips: { id: string; label: string; clear: Partial<FiltrosEntrega> }[] = [];
  if (f.nfsIds?.length) chips.push({ id: 'alerta', label: `${f.nfsRotulo || 'Seleção'} · ${f.nfsIds.length} NF${f.nfsIds.length > 1 ? 's' : ''}`, clear: { nfsIds: [], nfsRotulo: '' } });
  if (f.dataInicio || f.dataFim) {
    chips.push({
      id: 'periodo',
      label: `Faturamento: ${f.dataInicio ? formatDate(f.dataInicio) : '…'} → ${f.dataFim ? formatDate(f.dataFim) : '…'}`,
      clear: { dataInicio: '', dataFim: '' },
    });
  }
  if (f.transportadora) {
    chips.push({ id: 'transp', label: transportadoras.find((t) => t.id === f.transportadora)?.nome ?? 'Transportadora', clear: { transportadora: '' } });
  }
  if (f.modal) chips.push({ id: 'modal', label: `Modal: ${MODAIS.find((m) => m.value === f.modal)?.label ?? f.modal}`, clear: { modal: '' } });
  if (f.regiao) chips.push({ id: 'regiao', label: `Região: ${f.regiao}`, clear: { regiao: '' } });
  if (f.uf) chips.push({ id: 'uf', label: `UF: ${f.uf}`, clear: { uf: '' } });
  if (f.valorNfMin || f.valorNfMax) chips.push({ id: 'nf', label: `Valor NF: ${f.valorNfMin || '0'} – ${f.valorNfMax || '∞'}`, clear: { valorNfMin: '', valorNfMax: '' } });
  if (f.percFreteMin || f.percFreteMax) chips.push({ id: 'perc', label: `% Frete: ${f.percFreteMin || '0'} – ${f.percFreteMax || '∞'}`, clear: { percFreteMin: '', percFreteMax: '' } });
  f.status.forEach((s) => chips.push({ id: `st-${s}`, label: s, clear: { status: f.status.filter((x) => x !== s) } }));
  FLAGS.forEach(({ key, label }) => { if (f[key]) chips.push({ id: key, label, clear: { [key]: false } }); });
  return chips;
}

export { hasValue };
