import { splitCsvLine } from '../../lib/csv';
import { AREA, AREAS, isN, limparNota, type AreaId, type Lancamento, type Nota } from './config';
import { valoresFinais } from './calculos';

/**
 * Importação dos CSVs exportados pelo "Painel Logístico Munila" (HTML antigo)
 * ou por esta própria tela. Reconhece sozinho o tipo de arquivo pelo cabeçalho:
 *  - Base diária de uma área ("Data";"Fornecedores recebidos";…)
 *  - Lista de NFs recebidas  ("Data";"Fornecedor";"Nº NF";…)
 *  - Lista de NFs expedidas  ("Data";"Cliente";"Nº pedido";"Nº NF";…)
 */

export interface ArquivoLido {
  nome: string;
  area: AreaId;
  tipo: 'base' | 'nfs';
  /** por data ISO */
  dias: Map<string, { valores?: Record<string, number | null>; notas?: Nota[] }>;
  linhas: number;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function dataISO(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

function numero(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return isN(n) ? n : null;
}

export function lerCsvIndicadores(nome: string, texto: string): ArquivoLido {
  const linhas = texto.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (linhas.length < 1) throw new Error(`${nome}: arquivo vazio.`);
  const sep = linhas[0].includes(';') ? ';' : ',';
  const cab = splitCsvLine(linhas[0], sep).map(norm);
  const corpo = linhas.slice(1).map((l) => splitCsvLine(l, sep));
  if (!cab[0]?.startsWith('data')) throw new Error(`${nome}: a primeira coluna deveria ser "Data".`);

  // 1) Lista de NFs (Recebimento ou Expedição)
  for (const a of AREAS) {
    const N = a.notas;
    if (!N) continue;
    const idx = N.campos.map((c) => cab.indexOf(norm(c.l)));
    const obrig = N.req.every((k) => idx[N.campos.findIndex((c) => c.k === k)] >= 0);
    if (!obrig) continue;
    const dias: ArquivoLido['dias'] = new Map();
    corpo.forEach((cols, i) => {
      const d = dataISO(cols[0] ?? '');
      if (!d) throw new Error(`${nome}, linha ${i + 2}: data inválida "${cols[0]}".`);
      const n: Nota = {};
      N.campos.forEach((c, j) => {
        const raw = idx[j] >= 0 ? (cols[idx[j]] ?? '').trim() : '';
        if (c.t === 'num') n[c.k] = numero(raw);
        else if (c.t === 'date') n[c.k] = raw ? dataISO(raw) ?? '' : '';
        else if (c.t === 'sel' && c.opts) {
          // aceita o rótulo ("Coletado", "Avaria") ou a chave ("coletado")
          const o = c.opts.find(([k, l]) => k && (norm(l) === norm(raw) || k === norm(raw)));
          n[c.k] = o ? o[0] : c.k === 'uf' ? raw.toUpperCase() : '';
        } else n[c.k] = raw;
      });
      const dia = dias.get(d) ?? { notas: [] };
      dia.notas!.push(limparNota(N, n));
      dias.set(d, dia);
    });
    return { nome, area: a.id, tipo: 'nfs', dias, linhas: corpo.length };
  }

  // 2) Base diária: a área cujos campos aparecem no cabeçalho
  let melhor: { area: AreaId; hits: number } | null = null;
  for (const a of AREAS) {
    const hits = a.todos.filter((c) => cab.includes(norm(c.l))).length;
    if (hits >= Math.min(2, a.campos.length) && (!melhor || hits > melhor.hits)) melhor = { area: a.id, hits };
  }
  if (!melhor) throw new Error(`${nome}: não reconheci as colunas. Use o CSV exportado pelo painel ("Exportar CSV" ou "Exportar NFs").`);
  const a = AREA[melhor.area];
  const dias: ArquivoLido['dias'] = new Map();
  const iEx = cab.indexOf('exemplo');
  let linhasValidas = 0;
  corpo.forEach((cols, i) => {
    if (iEx >= 0 && norm(cols[iEx] ?? '') === 'sim') return; // ignora dados de exemplo do painel antigo
    const d = dataISO(cols[0] ?? '');
    if (!d) throw new Error(`${nome}, linha ${i + 2}: data inválida "${cols[0]}".`);
    const v: Record<string, number | null> = {};
    a.todos.forEach((c) => { const j = cab.indexOf(norm(c.l)); v[c.k] = j >= 0 ? numero(cols[j] ?? '') : null; });
    dias.set(d, { valores: v });
    linhasValidas++;
  });
  return { nome, area: a.id, tipo: 'base', dias, linhas: linhasValidas };
}

export interface PlanoImportacao {
  registros: Lancamento[];
  resumo: { area: AreaId; dias: number; novos: number; mesclados: number; nfsNovas: number; nfsIgnoradas: number }[];
}

/**
 * Junta os arquivos lidos com o que já existe no banco:
 *  - NFs já lançadas (mesma chave) são mantidas; só as novas entram;
 *  - números da base só preenchem campos que estão vazios no sistema;
 *  - os totais calculados pela lista de NFs são refeitos.
 */
export function planejarImportacao(arqs: ArquivoLido[], store: Record<AreaId, Record<string, Lancamento>>, prazo: number): PlanoImportacao {
  const acum = new Map<string, { area: AreaId; data: string; valores: Record<string, number | null>; notas: Nota[]; existia: boolean; mudou: boolean; nfsNovas: number; nfsIgn: number }>();
  const pegar = (area: AreaId, data: string) => {
    const k = `${area}|${data}`;
    let x = acum.get(k);
    if (!x) {
      const ex = store[area][data];
      x = { area, data, valores: { ...(ex?.valores ?? {}) }, notas: [...(ex?.notas ?? [])], existia: !!ex, mudou: !ex, nfsNovas: 0, nfsIgn: 0 };
      acum.set(k, x);
    }
    return x;
  };

  // bases primeiro, NFs depois (as NFs recalculam os totais)
  for (const arq of [...arqs].sort((p, q) => (p.tipo === q.tipo ? 0 : p.tipo === 'base' ? -1 : 1))) {
    const N = AREA[arq.area].notas;
    for (const [data, dia] of arq.dias) {
      const x = pegar(arq.area, data);
      if (dia.valores) for (const [k, v] of Object.entries(dia.valores)) if (v != null && !isN(x.valores[k])) { x.valores[k] = v; x.mudou = true; }
      if (dia.notas && N) {
        const chaves = new Set(x.notas.map((n) => N.chave(limparNota(N, n))));
        for (const n of dia.notas) {
          const ch = N.chave(n);
          if (chaves.has(ch)) { x.nfsIgn++; continue; }
          chaves.add(ch); x.notas.push(n); x.nfsNovas++; x.mudou = true;
        }
      }
    }
  }

  const registros: Lancamento[] = [];
  const res = new Map<AreaId, PlanoImportacao['resumo'][number]>();
  for (const x of acum.values()) {
    if (x.mudou) registros.push({ area: x.area, data: x.data, valores: valoresFinais(x.area, x.valores, x.notas, x.data, prazo), notas: x.notas });
    const r = res.get(x.area) ?? { area: x.area, dias: 0, novos: 0, mesclados: 0, nfsNovas: 0, nfsIgnoradas: 0 };
    r.dias++; if (x.existia) r.mesclados++; else r.novos++;
    r.nfsNovas += x.nfsNovas; r.nfsIgnoradas += x.nfsIgn;
    res.set(x.area, r);
  }
  return { registros: registros.sort((a, b) => a.data.localeCompare(b.data)), resumo: [...res.values()] };
}
