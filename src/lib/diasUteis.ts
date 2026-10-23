// Dias úteis (segunda a sexta, sem feriados nacionais). Datas sempre em 'YYYY-MM-DD'
// e contas em UTC para não depender do fuso do computador.

const d2n = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const n2d = (n: number) => new Date(n).toISOString().slice(0, 10);
const DIA = 864e5;

/** Domingo de Páscoa (algoritmo de Meeus). */
function pascoa(ano: number): number {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(ano, mes - 1, dia);
}

const cache = new Map<number, Set<string>>();
/** Feriados nacionais (inclui Carnaval, Sexta-feira Santa e Corpus Christi, em que transportadoras costumam parar). */
export function feriados(ano: number): Set<string> {
  let s = cache.get(ano);
  if (s) return s;
  const p = pascoa(ano);
  s = new Set([
    `${ano}-01-01`, `${ano}-04-21`, `${ano}-05-01`, `${ano}-09-07`, `${ano}-10-12`, `${ano}-11-02`, `${ano}-11-15`, `${ano}-11-20`, `${ano}-12-25`,
    n2d(p - 48 * DIA), n2d(p - 47 * DIA), n2d(p - 2 * DIA), n2d(p + 60 * DIA),
  ]);
  cache.set(ano, s);
  return s;
}

export function ehDiaUtil(iso: string): boolean {
  const w = new Date(d2n(iso)).getUTCDay();
  return w !== 0 && w !== 6 && !feriados(+iso.slice(0, 4)).has(iso);
}

/** Soma N dias úteis a uma data (N = 0 devolve o próprio dia, ou o próximo útil). */
export function somarDiasUteis(iso: string, n: number): string {
  let x = d2n(iso);
  if (n <= 0) { while (!ehDiaUtil(n2d(x))) x += DIA; return n2d(x); }
  let faltam = n;
  while (faltam > 0) { x += DIA; if (ehDiaUtil(n2d(x))) faltam--; }
  return n2d(x);
}

/** Dias úteis de `de` (exclusive) até `ate` (inclusive). Negativo se `ate` < `de`. */
export function diasUteisEntre(de: string, ate: string): number {
  if (de === ate) return 0;
  const sinal = de < ate ? 1 : -1;
  let a = sinal > 0 ? d2n(de) : d2n(ate);
  const b = sinal > 0 ? d2n(ate) : d2n(de);
  let n = 0;
  // pula semanas inteiras rapidamente (5 dias úteis cada, descontando feriados depois)
  while (b - a > 14 * DIA) {
    for (let k = 1; k <= 7; k++) if (ehDiaUtil(n2d(a + k * DIA))) n++;
    a += 7 * DIA;
  }
  while (a < b) { a += DIA; if (ehDiaUtil(n2d(a))) n++; }
  return sinal * n;
}
