// Indicadores Diários do armazém — definição das áreas, campos, indicadores e
// regras de cálculo. Portado do "Painel Logístico Munila" (HTML) mantendo as
// mesmas fórmulas e nomes, agora gravando no Supabase.

export type Fmt = 'int' | 'pct' | 'brl' | 'dec';

export interface Campo { k: string; l: string; h?: string; dec?: number; opt?: boolean }
export interface Kpi {
  id: string; l: string; t: 'soma' | 'razao' | 'ultimo';
  c?: string[]; n?: string[]; dn?: string[];
  f: Fmt; u?: string; m?: 'maior' | 'menor' | null; d: string;
}
export interface CampoNota {
  k: string; l: string; t: 'text' | 'num' | 'sel' | 'date'; sp: number;
  opts?: [string, string][]; sug?: boolean; num?: boolean; ph?: string; transp?: boolean;
}
export type Nota = Record<string, string | number | null>;
export interface NotasCfg {
  tit: string; dica: string; auto: string; campos: CampoNota[]; req: string[];
  chave: (n: Nota) => string; dup: (n: Nota) => string;
  totais: (rows: Nota[], dataPedido: string, prazoDias: number) => Record<string, number>;
  tabTit: string; busca: string; arq: string; resumo?: string; porUF?: boolean;
}
export interface Area {
  id: AreaId; cod: string; nome: string; campos: Campo[];
  extra?: { t: string; campos: Campo[] };
  checks: [string, string, string][]; kpis: Kpi[];
  notas?: NotasCfg; todos: Campo[]; dataLabel: string;
}
export type AreaId = 'recebimento' | 'armazenagem' | 'expedicao' | 'coleta' | 'devolucoes';

/** Um lançamento diário (uma linha da tabela indicadores_diarios). */
export interface Lancamento {
  id?: string; area: AreaId; data: string;
  valores: Record<string, number | null>;
  notas: Nota[];
  atualizado_por?: string | null; updated_at?: string;
}

/* ---------------- Datas (UTC, sem problema de fuso) ---------------- */
const pad = (n: number) => String(n).padStart(2, '0');
export const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const toD = (s: string) => { const p = s.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); };
const toS = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const addD = (s: string, n: number) => { const d = toD(s); d.setUTCDate(d.getUTCDate() + n); return toS(d); };
export const nDays = (a: string, b: string) => Math.round((toD(b).getTime() - toD(a).getTime()) / 864e5) + 1;
export const dow = (s: string) => toD(s).getUTCDay();
export const diasEntre = (a: string, b: string) => Math.round((toD(b).getTime() - toD(a).getTime()) / 864e5);
export const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const fdm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
export const fdmy = (s: string) => `${fdm(s)}/${s.slice(0, 4)}`;
export const fmes = (s: string) => `${MES[+s.slice(5, 7) - 1]}/${s.slice(2, 4)}`;

function addBiz(d: string, n: number) {
  let x = d;
  for (let i = 0; i < n; i++) { x = addD(x, 1); while (dow(x) === 0 || dow(x) === 6) x = addD(x, 1); }
  return x;
}
/** Prazo de coleta = data do pedido + N dias úteis. */
export const prazoData = (d: string, prazoDias: number) => addBiz(d, prazoDias);

/* ---------------- Formatação ---------------- */
const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const nf2 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const isN = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
export const fmtInt = (v: number) => nf0.format(v);
export const fmt1 = (v: number) => nf1.format(v);

export function fmt(v: number | null | undefined, f: Fmt, u?: string): string {
  if (v == null || !isFinite(v)) return '—';
  if (f === 'pct') return nf1.format(v) + '%';
  if (f === 'brl') return brl.format(v);
  if (f === 'dec') return nf1.format(v) + (u ? ' ' + u : '');
  return nf0.format(v) + (u ? ' ' + u : '');
}
export function fmtAx(v: number, f: Fmt, step: number) {
  if (f === 'pct') return (step < 1 ? nf1 : nf0).format(v) + '%';
  if (f === 'brl') return v >= 1000 ? 'R$ ' + nf1.format(v / 1000).replace(',0', '') + ' mil' : 'R$ ' + nf0.format(v);
  return (step < 1 ? nf1 : nf0).format(v);
}

/* ---------------- Áreas ---------------- */
export const DIVS: [string, string][] = [['', 'Sem divergência'], ['falta', 'Falta'], ['sobra', 'Sobra'], ['avaria', 'Avaria'], ['lote', 'Lote'], ['qtd', 'Quantidade']];
export const STATUS_EXP: [string, string][] = [['', 'Status'], ['separacao', 'Em separação'], ['separado', 'Separado'], ['cotado', 'Frete cotado'], ['coletado', 'Coletado']];
export const TRANSP_PADRAO = ['Braspress', 'Jamef', 'Intercargas', 'RV Cargas', 'TM Cargas', 'Gbex', 'Kllog', 'STA', 'Termaco', 'LATAM', 'Transporte próprio'];
const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const numv = (v: unknown) => (isN(v) ? v : 0);

const NOTAS: Partial<Record<AreaId, NotasCfg>> = {
  recebimento: {
    tit: 'Notas fiscais do dia', dica: 'Liste fornecedor e número de cada NF. Os totais abaixo passam a ser calculados pela lista.',
    auto: 'Totais calculados a partir das NFs listadas.',
    campos: [
      { k: 'forn', l: 'Fornecedor', t: 'text', sp: 3, sug: true },
      { k: 'nf', l: 'Nº NF', t: 'text', sp: 1, num: true },
      { k: 'vol', l: 'Volumes', t: 'num', sp: 1 },
      { k: 'div', l: 'Divergência', t: 'sel', sp: 2, opts: DIVS },
    ],
    req: ['forn', 'nf'],
    chave: (r) => String(r.forn ?? '').toLowerCase() + '|' + r.nf,
    dup: (r) => `A NF ${r.nf} de ${r.forn}`,
    totais: (rows) => {
      const t: Record<string, number> = {
        fornecedores: new Set(rows.map((n) => String(n.forn ?? '').toLowerCase()).filter(Boolean)).size,
        nfs: rows.length,
        volumes: rows.reduce((x, n) => x + numv(n.vol), 0),
        nfs_div: rows.filter((n) => n.div).length,
      };
      DIVS.slice(1).forEach(([k]) => { t['div_' + k] = rows.filter((n) => n.div === k).length; });
      return t;
    },
    tabTit: 'Notas recebidas no período', busca: 'Buscar fornecedor ou nº da NF', arq: 'nfs-recebidas',
  },
  expedicao: {
    tit: 'Notas fiscais expedidas',
    dica: 'Lance as NFs dos pedidos feitos nesta data. Ao marcar o status Coletado, a data da coleta é preenchida e os pedidos expedidos e no prazo são calculados sozinhos.',
    auto: 'Notas faturadas, volumes, pedidos expedidos e no prazo calculados a partir das NFs listadas.',
    campos: [
      { k: 'cliente', l: 'Cliente', t: 'text', sp: 3, sug: true },
      { k: 'pedido', l: 'Nº pedido', t: 'text', sp: 2, num: true },
      { k: 'nf', l: 'Nº NF', t: 'text', sp: 2, num: true },
      { k: 'vol', l: 'Total de volumes', ph: 'Volumes', t: 'num', sp: 2 },
      { k: 'transp', l: 'Transportadora', t: 'sel', sp: 2, transp: true },
      { k: 'cidade', l: 'Cidade', t: 'text', sp: 3, sug: true },
      { k: 'uf', l: 'UF', t: 'sel', sp: 1, opts: [['', 'UF'] as [string, string]].concat(UFS.map((u) => [u, u] as [string, string])) },
      { k: 'status', l: 'Status', t: 'sel', sp: 2, opts: STATUS_EXP },
      { k: 'dt_col', l: 'Data da coleta', t: 'date', sp: 2 },
    ],
    resumo: 'status', porUF: true,
    req: ['cliente', 'nf', 'cidade', 'uf'],
    chave: (r) => String(r.nf), dup: (r) => `A NF ${r.nf}`,
    totais: (rows, d, prazoDias) => {
      const col = rows.filter((n) => n.status === 'coletado');
      const pz = ISO.test(d || '') ? prazoData(d, prazoDias) : null;
      const cd = col.filter((n) => ISO.test(String(n.dt_col || '')) && ISO.test(d || ''));
      return {
        notas_fat: rows.length,
        vol_exp: rows.reduce((x, n) => x + numv(n.vol), 0),
        ped_exp: col.length,
        ped_prazo: col.filter((n) => pz && (!n.dt_col || String(n.dt_col) <= pz)).length,
        lead_sum: cd.reduce((x, n) => x + Math.max(0, diasEntre(d, String(n.dt_col))), 0),
        lead_n: cd.length,
      };
    },
    tabTit: 'Notas expedidas no período', busca: 'Buscar cliente, pedido, NF, cidade ou transportadora', arq: 'nfs-expedidas',
  },
};

const AREAS_BASE: Omit<Area, 'todos' | 'notas' | 'dataLabel'>[] = [
  {
    id: 'recebimento', cod: 'REC', nome: 'Recebimento',
    campos: [
      { k: 'fornecedores', l: 'Fornecedores recebidos' },
      { k: 'nfs', l: 'NFs recebidas' },
      { k: 'volumes', l: 'Volumes recebidos' },
      { k: 'nfs_div', l: 'NFs com divergência', h: 'Com falta, sobra, avaria, lote ou quantidade divergente' },
    ],
    extra: { t: 'Divergências por tipo (opcional)', campos: [{ k: 'div_falta', l: 'Falta' }, { k: 'div_sobra', l: 'Sobra' }, { k: 'div_avaria', l: 'Avaria' }, { k: 'div_lote', l: 'Lote' }, { k: 'div_qtd', l: 'Quantidade' }] },
    checks: [['nfs_div', 'nfs', 'NFs com divergência não pode ser maior que NFs recebidas.']],
    kpis: [
      { id: 'fornecedores', l: 'Fornecedores recebidos', t: 'soma', c: ['fornecedores'], f: 'int', d: 'Soma dos fornecedores recebidos em cada dia do período.' },
      { id: 'nfs', l: 'NF recebidas', t: 'soma', c: ['nfs'], f: 'int', d: 'Notas fiscais de entrada recebidas.' },
      { id: 'volumes', l: 'Volumes recebidos', t: 'soma', c: ['volumes'], f: 'int', d: 'Volumes descarregados e conferidos.' },
      { id: 'idx_div', l: 'Índice de divergências no recebimento', t: 'razao', n: ['nfs_div'], dn: ['nfs'], f: 'pct', m: 'menor', d: 'NFs com falta, sobra, avaria, lote ou quantidade divergente ÷ NFs recebidas.' },
    ],
  },
  {
    id: 'armazenagem', cod: 'ARM', nome: 'Armazenagem',
    campos: [
      { k: 'pos_total', l: 'Posições disponíveis', h: 'Total de endereços de armazenagem' },
      { k: 'pos_ocup', l: 'Posições ocupadas' },
      { k: 'end_aud', l: 'Endereços auditados', h: 'Conferidos no inventário rotativo do dia' },
      { k: 'end_ok', l: 'Endereços corretos', h: 'Produto, lote e quantidade iguais ao sistema' },
    ],
    checks: [['pos_ocup', 'pos_total', 'Posições ocupadas não pode ser maior que as disponíveis.'], ['end_ok', 'end_aud', 'Endereços corretos não pode ser maior que os auditados.']],
    kpis: [
      { id: 'ocupacao', l: 'Índice de ocupação', t: 'razao', n: ['pos_ocup'], dn: ['pos_total'], f: 'pct', m: null, d: 'Posições ocupadas ÷ posições disponíveis, ponderado pelos dias lançados.' },
      { id: 'acuracidade', l: 'Acuracidade de endereço', t: 'razao', n: ['end_ok'], dn: ['end_aud'], f: 'pct', m: 'maior', d: 'Endereços corretos ÷ endereços auditados.' },
    ],
  },
  {
    id: 'expedicao', cod: 'EXP', nome: 'Expedição/Separação',
    campos: [
      { k: 'notas_fat', l: 'Notas faturadas' },
      { k: 'vol_exp', l: 'Volumes expedidos', h: 'Soma dos volumes das NFs listadas' },
      { k: 'ped_exp', l: 'Pedidos expedidos', h: 'Com NFs na lista: NFs com status Coletado' },
      { k: 'ped_prazo', l: 'Pedidos expedidos no prazo', h: 'Com NFs na lista: coletadas até o prazo de coleta' },
    ],
    checks: [['ped_prazo', 'ped_exp', 'Pedidos no prazo não pode ser maior que pedidos expedidos.']],
    kpis: [
      { id: 'notas', l: 'Notas faturadas', t: 'soma', c: ['notas_fat'], f: 'int', d: 'Notas fiscais de saída faturadas.' },
      { id: 'volumes', l: 'Volumes expedidos', t: 'soma', c: ['vol_exp'], f: 'int', d: 'Soma dos volumes das NFs expedidas.' },
      { id: 'prazo', l: 'Pedidos expedidos no prazo', t: 'razao', n: ['ped_prazo'], dn: ['ped_exp'], f: 'pct', m: 'maior', d: 'NFs coletadas até o prazo de coleta ÷ NFs coletadas.' },
      { id: 'lead', l: 'Tempo do pedido até a coleta', t: 'razao', n: ['lead_sum'], dn: ['lead_n'], f: 'dec', u: 'dias', m: 'menor', d: 'Média de dias corridos entre a data do pedido e a data da coleta, nas NFs coletadas.' },
    ],
  },
  {
    id: 'coleta', cod: 'COL', nome: 'Coleta de transportadoras',
    campos: [
      { k: 'col_ag', l: 'Coletas agendadas' },
      { k: 'col_prazo', l: 'Coletas no prazo', h: 'Transportadora coletou na data e janela combinadas' },
      { k: 'aguardando', l: 'Pedidos aguardando coleta', h: 'Posição no fim do dia' },
    ],
    checks: [['col_prazo', 'col_ag', 'Coletas no prazo não pode ser maior que coletas agendadas.']],
    kpis: [
      { id: 'prazo', l: 'Coletas no prazo', t: 'razao', n: ['col_prazo'], dn: ['col_ag'], f: 'pct', m: 'maior', d: 'Coletas feitas no prazo ÷ coletas agendadas.' },
      { id: 'aguardando', l: 'Pedidos aguardando coleta', t: 'ultimo', c: ['aguardando'], f: 'int', m: 'menor', d: 'Pedidos prontos esperando a transportadora no último dia lançado.' },
    ],
  },
  {
    id: 'devolucoes', cod: 'DEV', nome: 'Devoluções e ocorrências',
    campos: [
      { k: 'ped_ent', l: 'Pedidos entregues', h: 'Base de cálculo dos índices' },
      { k: 'ped_dev', l: 'Pedidos devolvidos', h: 'Com NFD emitida' },
      { k: 'oc_avaria', l: 'Ocorrências de avaria' },
      { k: 'oc_falta', l: 'Ocorrências de falta' },
      { k: 'custo_dev', l: 'Custo das devoluções (R$)', h: 'Frete de retorno, reentrega e mercadoria perdida', dec: 2 },
    ],
    checks: [['ped_dev', 'ped_ent', 'Pedidos devolvidos não pode ser maior que pedidos entregues.']],
    kpis: [
      { id: 'idx_dev', l: 'Índice de devoluções', t: 'razao', n: ['ped_dev'], dn: ['ped_ent'], f: 'pct', m: 'menor', d: 'Pedidos devolvidos ÷ pedidos entregues.' },
      { id: 'idx_af', l: 'Índice de avarias e faltas', t: 'razao', n: ['oc_avaria', 'oc_falta'], dn: ['ped_ent'], f: 'pct', m: 'menor', d: '(Ocorrências de avaria + falta) ÷ pedidos entregues.' },
      { id: 'custo', l: 'Custo das devoluções', t: 'soma', c: ['custo_dev'], f: 'brl', m: 'menor', d: 'Frete de retorno, reentrega e mercadoria perdida.' },
    ],
  },
];

export const AREAS: Area[] = AREAS_BASE.map((a) => ({
  ...a,
  notas: NOTAS[a.id],
  todos: a.campos.concat(a.extra ? a.extra.campos : []),
  dataLabel: a.id === 'expedicao' ? 'Data do pedido' : 'Data',
}));
export const AREA: Record<AreaId, Area> = Object.fromEntries(AREAS.map((a) => [a.id, a])) as Record<AreaId, Area>;
export const kpiDe = (a: AreaId, id: string) => AREA[a].kpis.find((k) => k.id === id)!;

/** Cartões da Visão geral: um indicador principal por área. */
export const HOME: [AreaId, string][] = [['recebimento', 'fornecedores'], ['armazenagem', 'ocupacao'], ['expedicao', 'notas'], ['coleta', 'prazo'], ['devolucoes', 'idx_dev']];

export const ACOMP = {
  transp: { cod: 'TRP', nome: 'Por transportadora', tit: 'Acompanhamento por transportadora' },
  clientes: { cod: 'CLI', nome: 'Por cliente', tit: 'Acompanhamento por cliente' },
} as const;
export type AcompId = keyof typeof ACOMP;
export type Pagina = 'geral' | AreaId | AcompId;
export const PAGINAS: Pagina[] = ['geral', ...AREAS.map((a) => a.id), 'transp', 'clientes'];

/* ---------------- Cálculo dos indicadores ---------------- */
export interface Dia { d: string; v: Record<string, number | null>; notas: Nota[] }

const sum = (es: Dia[], ks: string[]) => { let s = 0; for (const e of es) for (const k of ks) s += numv(e.v[k]); return s; };

export function calc(k: Kpi, es: Dia[]): number | null {
  if (!es.length) return null;
  if (k.t === 'soma') return sum(es, k.c!);
  if (k.t === 'razao') { const d = sum(es, k.dn!); if (!d) return null; const n = sum(es, k.n!); return k.f === 'pct' ? (n / d) * 100 : n / d; }
  if (k.t === 'ultimo') { for (let i = es.length - 1; i >= 0; i--) { const v = es[i].v[k.c![0]]; if (isN(v)) return v; } return null; }
  return null;
}
export const somaCampos = sum;

export function delta(k: Kpi, cur: number | null, prev: number | null): { txt: string; c: '' | 'good' | 'bad' } | null {
  if (cur == null || prev == null) return null;
  const d = cur - prev; let txt: string;
  if (k.f === 'pct') txt = (d > 0 ? '+' : d < 0 ? '−' : '±') + nf1.format(Math.abs(d)) + ' p.p.';
  else if (k.t === 'ultimo') txt = (d > 0 ? '+' : d < 0 ? '−' : '±') + fmt(Math.abs(d), k.f, '');
  else { if (!prev) return null; const r = (d / prev) * 100; txt = (r > 0 ? '+' : r < 0 ? '−' : '±') + nf1.format(Math.abs(r)) + '%'; }
  let c: '' | 'good' | 'bad' = '';
  if (k.m && d !== 0) c = (k.m === 'maior') === (d > 0) ? 'good' : 'bad';
  return { txt, c };
}

/* ---------------- Filtros de período ---------------- */
export interface Filtros { periodo: string; de: string | null; ate: string | null; grupo: 'auto' | 'dia' | 'semana' | 'mes'; dows: number[]; comp: boolean }
export const FILTROS_PADRAO: Filtros = { periodo: '30d', de: null, ate: null, grupo: 'auto', dows: [0, 1, 2, 3, 4, 5, 6], comp: true };
export const PERIODOS: [string, string][] = [
  ['hoje', 'Hoje'], ['7d', 'Últimos 7 dias'], ['30d', 'Últimos 30 dias'], ['mes', 'Este mês'], ['mes_ant', 'Mês anterior'],
  ['90d', 'Últimos 90 dias'], ['ano', 'Este ano'], ['custom', 'Personalizado'],
];

function rangeFor(p: string): [string, string] | null {
  const t = todayISO();
  switch (p) {
    case 'hoje': return [t, t];
    case '7d': return [addD(t, -6), t];
    case '30d': return [addD(t, -29), t];
    case '90d': return [addD(t, -89), t];
    case 'mes': return [t.slice(0, 8) + '01', t];
    case 'mes_ant': { const f = t.slice(0, 8) + '01'; const e = addD(f, -1); return [e.slice(0, 8) + '01', e]; }
    case 'ano': return [t.slice(0, 4) + '-01-01', t];
  }
  return null;
}
export interface Periodo { de: string; ate: string; n: number; pde: string; pate: string }
export function periodo(F: Filtros): Periodo {
  let r = F.periodo !== 'custom' ? rangeFor(F.periodo) : null;
  if (!r) {
    let de = ISO.test(F.de || '') ? F.de! : addD(todayISO(), -29);
    let ate = ISO.test(F.ate || '') ? F.ate! : todayISO();
    if (de > ate) [de, ate] = [ate, de];
    r = [de, ate];
  }
  const n = nDays(r[0], r[1]); const pAte = addD(r[0], -1);
  return { de: r[0], ate: r[1], n, pde: addD(pAte, -(n - 1)), pate: pAte };
}
export const grupoDe = (F: Filtros, n: number) => (F.grupo !== 'auto' ? F.grupo : n <= 31 ? 'dia' : n <= 120 ? 'semana' : 'mes');

export interface Bucket { de: string; ate: string; lbl: string; tt: string }
export function buckets(de: string, ate: string, g: string): Bucket[] {
  const out: Bucket[] = [];
  if (g === 'dia') { for (let s = de; s <= ate; s = addD(s, 1)) out.push({ de: s, ate: s, lbl: fdm(s), tt: DOW[dow(s)] + ', ' + fdmy(s) }); }
  else if (g === 'semana') {
    for (let s = addD(de, -((dow(de) + 6) % 7)); s <= ate; s = addD(s, 7)) {
      const e = addD(s, 6); out.push({ de: s < de ? de : s, ate: e > ate ? ate : e, lbl: fdm(s), tt: `Semana de ${fdm(s)} a ${fdm(e)}` });
    }
  } else {
    let y = +de.slice(0, 4), m = +de.slice(5, 7);
    for (;;) {
      const s = `${y}-${pad(m)}-01`; if (s > ate) break;
      const nx = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`; const e = addD(nx, -1);
      out.push({ de: s < de ? de : s, ate: e > ate ? ate : e, lbl: fmes(s), tt: fmes(s) });
      m++; if (m > 12) { m = 1; y++; }
    }
  }
  return out;
}
export const serie = (k: Kpi, es: Dia[], bks: Bucket[]) => bks.map((b) => calc(k, es.filter((e) => e.d >= b.de && e.d <= b.ate)));

/* ---------------- Acompanhamento da expedição ---------------- */
export type Situacao = 'col_ok' | 'col_atr' | 'pen' | 'atr';
export const SITL: Record<Situacao, [string, string]> = {
  col_ok: ['Coletada no prazo', 'ok'], col_atr: ['Coletada com atraso', 'warn'], pen: ['Pendente', 'pen'], atr: ['Atrasada', 'bad'],
};
export interface NfExp extends Nota { _d: string; _i: number }
export function situacao(n: NfExp, prazoDias: number): Situacao {
  const pz = prazoData(n._d, prazoDias);
  if (n.status === 'coletado') return n.dt_col && String(n.dt_col) > pz ? 'col_atr' : 'col_ok';
  return todayISO() > pz ? 'atr' : 'pen';
}

/** Limpa uma NF vinda do banco para o formato esperado pelos campos. */
export function limparNota(cfg: NotasCfg, n: Nota): Nota {
  const o: Nota = {};
  cfg.campos.forEach((c) => { const v = n[c.k]; o[c.k] = c.t === 'num' ? (isN(v) ? v : null) : v == null || typeof v === 'object' ? '' : String(v); });
  return o;
}
