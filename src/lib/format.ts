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

/**
 * Data/hora de auditoria. O banco grava em UTC sem sufixo de fuso; aqui o
 * valor é interpretado como UTC e exibido no horário de Brasília — funciona
 * em qualquer computador, inclusive com horário de verão ou fuso diferente.
 */
export function formatDateTimeBR(d?: string | null): string {
  if (!d) return '-';
  const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(d);
  const dt = new Date(hasTz ? d : `${d.replace(' ', 'T')}Z`);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
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
