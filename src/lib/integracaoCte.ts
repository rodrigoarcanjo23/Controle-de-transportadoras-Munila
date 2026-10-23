import type { Cte, Entrega } from '../types';
import { hasValue, toNumber } from './format';

/**
 * Integração CTE → Painel de Entregas.
 *
 * Problema antigo: a busca comparava o número da NF do CTE com o campo
 * "nota_fiscal" da entrega de forma EXATA. Entregas com várias NFs
 * ("17248 / 17252") nunca batiam com "17248" nem com "17252", então o frete
 * real dessas cargas nunca era preenchido.
 *
 * Agora os dois lados são quebrados em números individuais e comparados um a
 * um, independentemente de barra, vírgula, espaço ou zeros à esquerda.
 */

const normNF = (n: string) => String(Number(n));

/** Números de NF de um texto qualquer: "17248 / 17252", "17248,17252", "000017248", chave de 44 dígitos… */
export function extrairNFs(texto?: string | null): string[] {
  if (!texto) return [];
  const out: string[] = [];
  for (const parte of String(texto).split(/[,;/\n|]+/)) {
    const digitos = parte.replace(/\D/g, '');
    if (!digitos) continue;
    if (digitos.length === 44) { out.push(normNF(digitos.substring(25, 34))); continue; }
    // "17204 17195" ou "17204 e 17195" → números separados
    for (const g of parte.match(/\d+/g) ?? []) {
      if (g.length === 44) out.push(normNF(g.substring(25, 34)));
      else if (g.length <= 12) out.push(normNF(g));
    }
  }
  return Array.from(new Set(out.filter((n) => n !== '0' && n !== 'NaN')));
}

export interface ResultadoCte {
  nfs: string[];            // NFs do CTE
  encontradas: string[];    // NFs achadas no Painel
  faltando: string[];       // NFs que não existem no Painel
  entregas: string[];       // ids das entregas afetadas
  emOutrosCtes: string[];   // NFs que também aparecem em outro CTE (valores somados)
  rateioPorNF: number;
}

export interface CalculoIntegracao {
  /** frete real calculado por entrega (soma de todos os CTEs que a cobrem) */
  porEntrega: Map<string, number>;
  porCte: Map<string, ResultadoCte>;
  /** NFs presentes em mais de um CTE */
  nfsRepetidas: string[];
}

/**
 * Calcula o frete real de cada entrega a partir de TODOS os CTEs.
 * Regra (a mesma de antes): o valor do CTE é dividido igualmente entre as NFs
 * dele; cada entrega recebe a parte de cada NF sua coberta pelo CTE.
 * Ex.: CTE de R$ 300 com NFs 17248 e 17252 → R$ 150 por NF → a entrega
 * "17248 / 17252" recebe R$ 300. Se uma entrega for coberta por mais de um
 * CTE (ex.: CTE complementar), os valores são somados.
 */
export function calcularIntegracao(ctes: Cte[], entregas: Entrega[]): CalculoIntegracao {
  const indice = new Map<string, Entrega[]>();
  for (const e of entregas) {
    for (const nf of extrairNFs(e.nota_fiscal)) {
      const lista = indice.get(nf);
      if (lista) lista.push(e); else indice.set(nf, [e]);
    }
  }

  const porEntrega = new Map<string, number>();
  const porCte = new Map<string, ResultadoCte>();
  const ctesPorNF = new Map<string, number>();
  for (const cte of ctes) for (const nf of extrairNFs(cte.chave_acesso)) ctesPorNF.set(nf, (ctesPorNF.get(nf) ?? 0) + 1);

  for (const cte of ctes) {
    const nfs = extrairNFs(cte.chave_acesso);
    const rateio = nfs.length ? toNumber(cte.valor_total_servico) / nfs.length : 0;
    const encontradas: string[] = []; const faltando: string[] = []; const afetadas = new Set<string>();
    for (const nf of nfs) {
      const es = indice.get(nf);
      if (!es?.length) { faltando.push(nf); continue; }
      encontradas.push(nf);
      for (const e of es) {
        porEntrega.set(e.id, (porEntrega.get(e.id) ?? 0) + rateio);
        afetadas.add(e.id);
      }
    }
    porCte.set(cte.id, { nfs, encontradas, faltando, entregas: [...afetadas], rateioPorNF: rateio, emOutrosCtes: nfs.filter((n) => (ctesPorNF.get(n) ?? 0) > 1) });
  }

  for (const [id, v] of porEntrega) porEntrega.set(id, Math.round(v * 100) / 100);
  return { porEntrega, porCte, nfsRepetidas: [...ctesPorNF].filter(([, n]) => n > 1).map(([nf]) => nf) };
}

/** Entregas cujo frete real/confirmação precisam ser gravados no banco. */
export function atualizacoesPendentes(calc: CalculoIntegracao, entregas: Entrega[], somenteIds?: Set<string>) {
  const mapa = new Map(entregas.map((e) => [e.id, e]));
  const out: { id: string; nota_fiscal: string; valor: number }[] = [];
  for (const [id, valor] of calc.porEntrega) {
    if (somenteIds && !somenteIds.has(id)) continue;
    const e = mapa.get(id);
    if (!e) continue;
    const atual = hasValue(e.valor_frete_real) ? toNumber(e.valor_frete_real) : null;
    if (atual === null || Math.abs(atual - valor) > 0.009 || !e.frete_confirmado) {
      out.push({ id, nota_fiscal: e.nota_fiscal, valor });
    }
  }
  return out;
}
