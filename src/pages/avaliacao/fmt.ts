import { CONCEITO, conceitoDe } from '../../lib/avaliacao';

const COR: Record<string, string> = { green: 'var(--green-solid)', blue: 'var(--brand)', amber: 'var(--amber-solid)', red: 'var(--red-solid)', slate: 'var(--border-strong)' };
export const corNota = (n: number | null) => COR[n === null ? 'slate' : CONCEITO[conceitoDe(n)!].tone];
export const fmtNota = (n: number | null) => (n === null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
