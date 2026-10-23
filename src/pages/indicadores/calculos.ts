import { AREA, isN, limparNota, type AreaId, type Dia, type Nota, type NfExp } from './config';

/**
 * Junta os valores digitados com os totais calculados pela lista de NFs.
 * Com NFs na lista, os campos calculáveis (ex.: NFs recebidas, volumes) vêm da
 * lista; campos internos (lead_sum/lead_n) também. Sem NFs, ficam como digitados.
 */
export function valoresFinais(area: AreaId, base: Record<string, number | null>, notas: Nota[], data: string, prazo: number) {
  const N = AREA[area].notas;
  const out: Record<string, number | null> = { ...base };
  if (!N) return out;
  const rows = notas.map((n) => limparNota(N, n));
  const t = N.totais(rows, data, prazo);
  const campos = new Set(AREA[area].todos.map((c) => c.k));
  for (const k of Object.keys(t)) {
    if (campos.has(k)) { if (rows.length) out[k] = t[k]; }
    else out[k] = rows.length ? t[k] : null;
  }
  return out;
}

/** Todas as NFs da Expedição no período (com a data do pedido e a posição na lista). */
export function nfsExpedicao(dias: Dia[]): NfExp[] {
  const N = AREA.expedicao.notas!;
  const out: NfExp[] = [];
  dias.forEach((e) => e.notas.forEach((n, i) => { if (n && typeof n === 'object') out.push({ ...limparNota(N, n), _d: e.d, _i: i }); }));
  return out;
}

export const numOuNulo = (s: string): number | null => {
  if (s.trim() === '') return null;
  const n = Number(s.replace(',', '.'));
  return isN(n) ? n : null;
};
