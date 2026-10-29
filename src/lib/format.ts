import type { Entrega, Num } from '../types';

const DIA_MS = 1000 * 60 * 60 * 24;

/** Converte 'YYYY-MM-DD' em Date ao meio-dia (evita erro de fuso). */
export function parseISODate(d?: string | null): Date | null {
  if (!d) return null;
  const dt = new Date(d.length <= 10 ? `${d}T12:00:00` : d);
  return isNaN(dt.getTime()) ? null : dt;
}

export function formatDate(d?: string | null): string {
  const dt = parseISODate(d);
  return dt ? dt.toLocaleDateString('pt-BR') : '-';
}

/** Fuso de referência do sistema (Fortaleza-CE: UTC−3, sem horário de verão). */
export const FUSO = 'America/Fortaleza';

/**
 * Converte um carimbo de data/hora do banco em Date. Valores sem sufixo de fuso
 * são tratados como UTC (padrão do Postgres/Supabase).
 */
export function parseCarimbo(d?: string | null): Date | null {
  if (!d) return null;
  const hasTz = /([zZ]|[+-]\d{2}(:?\d{2})?)$/.test(d);
  const dt = new Date(hasTz ? d : `${d.replace(' ', 'T')}Z`);
  return isNaN(dt.getTime()) ? null : dt;
}

/** Data/hora no horário de Fortaleza — igual em qualquer computador ou celular. */
export function formatDateTimeBR(d?: string | null): string {
  const dt = parseCarimbo(d);
  if (!dt) return d ? d : '-';
  return dt.toLocaleString('pt-BR', { timeZone: FUSO });
}

/** Só a hora (HH:MM:SS) no horário de Fortaleza. */
export function formatHora(d?: string | null, segundos = true): string {
  const dt = parseCarimbo(d);
  return dt ? dt.toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', ...(segundos ? { second: '2-digit' } : {}) }) : '-';
}

/** Dia (YYYY-MM-DD) de um carimbo no horário de Fortaleza. */
export function diaLocal(d?: string | Date | null): string {
  const dt = d instanceof Date ? d : parseCarimbo(d);
  return dt ? dt.toLocaleDateString('en-CA', { timeZone: FUSO }) : '';
}

/** "agora", "há 5 min", "há 3 h", "ontem", "há 4 dias". */
export function tempoRelativo(d?: string | null, agora: Date = new Date()): string {
  const dt = parseCarimbo(d);
  if (!dt) return '';
  const s = Math.round((agora.getTime() - dt.getTime()) / 1000);
  if (s < -120) return ''; // no futuro: relógio do registro errado
  if (s < 45) return 'agora';
  if (s < 3600) return `há ${Math.max(1, Math.round(s / 60))} min`;
  if (diaLocal(dt) === diaLocal(agora)) return `há ${Math.round(s / 3600)} h`;
  const dias = Math.round((Date.parse(diaLocal(agora)) - Date.parse(diaLocal(dt))) / 864e5);
  return dias === 1 ? 'ontem' : `há ${dias} dias`;
}

export function toNumber(v: Num): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return isNaN(n) ? 0 : n;
}

export function hasValue(v: Num): boolean {
  return v !== null && v !== undefined && v !== '';
}

const moneyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const decFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const intFmt = new Intl.NumberFormat('pt-BR');

export const formatMoney = (v: Num) => moneyFmt.format(toNumber(v));
export const formatDecimal = (v: Num) => decFmt.format(toNumber(v));
export const formatInt = (v: Num) => intFmt.format(toNumber(v));

/** Valor compacto para eixos de gráfico: R$ 12k, R$ 1,2 mi */
export function formatMoneyShort(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${v.toFixed(0)}`;
}

/** Aceita "1.234,56", "1234,56" e "1234.56". Retorna null se vazio/inválido. */
export function parseDecimalBR(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  let s = v.trim();
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/** Número → texto com vírgula para inputs decimais. */
export function toInputDecimal(v: Num): string {
  if (!hasValue(v)) return '';
  return String(v).replace('.', ',');
}

/** Mantém apenas dígitos e uma vírgula (máscara leve dos inputs de valor). */
export function maskDecimal(raw: string): string {
  let valor = raw.replace(/[^\d,]/g, '');
  const partes = valor.split(',');
  if (partes.length > 2) valor = partes[0] + ',' + partes.slice(1).join('');
  return valor;
}

/** Diferença em dias entre duas datas ISO (pode ser negativa). */
export function diffDias(de?: string | null, ate?: string | null): number | null {
  const d1 = parseISODate(de);
  const d2 = parseISODate(ate);
  if (!d1 || !d2) return null;
  return Math.ceil((d2.getTime() - d1.getTime()) / DIA_MS);
}

export function diasDesde(d?: string | null): number | null {
  const dt = parseISODate(d);
  if (!dt) return null;
  return Math.ceil((Date.now() - dt.getTime()) / DIA_MS);
}

export const fmtDias = (n: number | null, sufixo = 'd') => (n === null ? '-' : `${n} ${sufixo}`);

/** Frete considerado nas contas: o real (CTE) quando existe; senão o cotado. */
export function freteEfetivo(e: Pick<Entrega, 'valor_frete' | 'valor_frete_real'>): number {
  return hasValue(e.valor_frete_real) ? toNumber(e.valor_frete_real) : toNumber(e.valor_frete);
}

export function percentual(parte: number, total: number): number {
  return total > 0 ? (parte / total) * 100 : 0;
}

export function formatPercent(v: number, casas = 2): string {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

export function percentFreteEntrega(e: Entrega): number {
  return percentual(freteEfetivo(e), toNumber(e.valor_nf));
}

/** Busca sem acentos e sem diferenciar maiúsculas. */
export function normalize(s: unknown): string {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function matchesSearch(termo: string, ...campos: unknown[]): boolean {
  const t = normalize(termo).trim();
  if (!t) return true;
  return campos.some((c) => normalize(c).includes(t));
}

export function formatCnpj(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return raw;
}

export function hojeISO(): string {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function iniciais(nome?: string | null): string {
  if (!nome) return '?';
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}
