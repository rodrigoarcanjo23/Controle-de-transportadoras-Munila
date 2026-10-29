// Simulador de frete (cotação): monta a carga (caixas, peso real, cubagem, peso
// taxado) e compara as transportadoras para o destino — pela tabela de frete
// cadastrada ou, sem tabela, pelo custo real histórico da rota (CTEs).
import type { Entrega, MetaFrete, Produto, Transportadora } from '../types';
import { calcularFrete, tabelaPara, type Calculo, type TabelaFrete } from './tabelaFrete';
import { historicoRota, type Aprendizado } from './sla';
import { somarDiasUteis } from './diasUteis';
import { ufDestino } from './filtrosEntrega';
import { hasValue, toNumber } from './format';

/** Fatores de cubagem usuais (kg por m³). */
export const FATORES_CUBAGEM = [
  { valor: 300, label: 'Rodoviário — 300 kg/m³ (padrão)' },
  { valor: 250, label: 'Rodoviário fracionado — 250 kg/m³' },
  { valor: 200, label: 'Rodoviário fracionado — 200 kg/m³' },
  { valor: 166.7, label: 'Aéreo — 166,7 kg/m³ (6.000 cm³/kg)' },
];

/** "30x20x15", "30 x 20 x 15 cm", "0,30 x 0,20 x 0,15 m" → dimensões em cm. */
export function lerMedidas(txt?: string | null): [number, number, number] | null {
  if (!txt) return null;
  const n = (txt.match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => Number(x.replace(',', '.'))).filter((x) => x > 0);
  if (n.length < 3) return null;
  let [a, b, c] = n;
  // em metros (todas < 3) → converte para cm
  if (a < 3 && b < 3 && c < 3) { a *= 100; b *= 100; c *= 100; }
  return [a, b, c];
}

export interface ItemCarga {
  id: string;
  /** produto do catálogo (calcula caixas pela quantidade em unidades) */
  produtoId?: string;
  unidades?: number;
  /** volume avulso */
  descricao?: string; caixas?: number; pesoCaixa?: number; medidas?: string;
}
export interface LinhaCarga { item: ItemCarga; nome: string; caixas: number; peso: number; m3: number | null; medidas: string; sobra: number }
export interface Carga { linhas: LinhaCarga[]; caixas: number; pesoReal: number; m3: number; semMedidas: number; pesoCubado: number; pesoTaxado: number; usaCubado: boolean }

export function calcularCarga(itens: ItemCarga[], produtos: Produto[], fator: number): Carga {
  const linhas: LinhaCarga[] = itens.map((it) => {
    const p = it.produtoId ? produtos.find((x) => String(x.id) === String(it.produtoId)) : undefined;
    let caixas: number; let peso: number; let medidas: string; let nome = it.descricao || 'Volume avulso'; let sobra = 0;
    if (p) {
      nome = `${p.codigo ? `${p.codigo} — ` : ''}${p.nome}`;
      const un = Math.max(0, Math.round(it.unidades ?? 0));
      const porCx = Math.max(1, toNumber(p.unidades_por_caixa));
      caixas = un ? Math.ceil(un / porCx) : 0;
      sobra = un % porCx ? porCx - (un % porCx) : 0;
      peso = caixas * toNumber(p.peso_caixa_kg);
      medidas = p.medidas_cm ?? '';
    } else {
      caixas = Math.max(0, Math.round(it.caixas ?? 0));
      peso = caixas * Math.max(0, it.pesoCaixa ?? 0);
      medidas = it.medidas ?? '';
    }
    const d = lerMedidas(medidas);
    const m3 = d ? (d[0] * d[1] * d[2] / 1_000_000) * caixas : null;
    return { item: it, nome, caixas, peso: Math.round(peso * 1000) / 1000, m3, medidas, sobra };
  });
  const caixas = linhas.reduce((s, l) => s + l.caixas, 0);
  const pesoReal = Math.round(linhas.reduce((s, l) => s + l.peso, 0) * 100) / 100;
  const m3 = Math.round(linhas.reduce((s, l) => s + (l.m3 ?? 0), 0) * 10000) / 10000;
  const semMedidas = linhas.filter((l) => l.caixas > 0 && l.m3 === null).length;
  const pesoCubado = Math.round(m3 * fator * 100) / 100;
  const pesoTaxado = Math.max(pesoReal, pesoCubado);
  return { linhas, caixas, pesoReal, m3, semMedidas, pesoCubado, pesoTaxado, usaCubado: pesoCubado > pesoReal };
}

/** Texto para a coluna VOL/PESO da NF-e (mesmo formato de antes). */
export const textoVolPeso = (c: Carga) => `${c.caixas}CX ${c.pesoReal.toFixed(2)}KG`;

/* ------------------------------------------------------------------ */
/* Custo real histórico da rota (sem tabela de frete)                   */
/* ------------------------------------------------------------------ */
export interface CustoHistorico { n: number; rsKg: number; p25: number; p75: number; pctNf: number; minimo: number }
const quant = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };

/** R$/kg real (CTE) das NFs dos últimos 12 meses da transportadora para a UF. */
export function custoHistorico(entregas: Entrega[], transportadoraId: string, uf: string, hoje: string): CustoHistorico | null {
  const desde = `${+hoje.slice(0, 4) - 1}${hoje.slice(4)}`;
  const xs: number[] = []; const pcts: number[] = []; const fretes: number[] = [];
  for (const e of entregas) {
    if (String(e.transportadora_id ?? '') !== transportadoraId || ufDestino(e) !== uf) continue;
    if (!hasValue(e.valor_frete_real) || !e.data_faturamento || e.data_faturamento < desde) continue;
    const kg = toNumber(e.peso_kg); const fr = toNumber(e.valor_frete_real);
    if (kg <= 0 || fr <= 0 || kg > 20000) continue;
    xs.push(fr / kg); fretes.push(fr);
    if (toNumber(e.valor_nf) > 0) pcts.push((fr / toNumber(e.valor_nf)) * 100);
  }
  if (xs.length < 3) return null;
  return { n: xs.length, rsKg: quant(xs, 0.5), p25: quant(xs, 0.25), p75: quant(xs, 0.75), pctNf: pcts.length ? quant(pcts, 0.5) : 0, minimo: quant(fretes, 0.1) };
}

/* ------------------------------------------------------------------ */
/* Cotação                                                              */
/* ------------------------------------------------------------------ */
export type FonteCusto = 'tabela' | 'historico';
export interface OpcaoCotacao {
  t: Transportadora;
  custo: number; fonte: FonteCusto; detalheCusto: string;
  calc?: Calculo; faixa?: [number, number];
  pct: number | null;
  prazo: number | null; fontePrazo: string; previsao: string | null;
  pontualidade: number | null; amostraPrazo: number;
  meta: number | null; dentroMeta: boolean | null;
  score: number;
}

export interface EntradaCotacao {
  carga: Carga; valorNf: number; uf: string; clienteId?: string;
  transportadoras: Transportadora[]; tabelas: TabelaFrete[]; entregas: Entrega[]; metas: MetaFrete[];
  apr: Aprendizado; coletaDias: number; hoje: string;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function cotar(x: EntradaCotacao): OpcaoCotacao[] {
  const peso = x.carga.pesoTaxado;
  if (!x.uf || peso <= 0) return [];
  const saida = somarDiasUteis(x.hoje, Math.max(1, x.coletaDias));
  const out: OpcaoCotacao[] = [];
  for (const t of x.transportadoras) {
    const id = String(t.id);
    const tab = tabelaPara(x.tabelas, id, x.uf);
    let custo: number; let fonte: FonteCusto; let detalheCusto: string; let calc: Calculo | undefined; let faixa: [number, number] | undefined;
    if (tab) {
      calc = calcularFrete(tab.componentes, peso, x.valorNf);
      custo = calc.total; fonte = 'tabela';
      detalheCusto = `Tabela ${tab.uf === '*' ? 'geral' : tab.uf}${calc.minimoAplicado ? ' · frete mínimo' : ''}`;
    } else {
      const h = custoHistorico(x.entregas, id, x.uf, x.hoje);
      if (!h) continue;
      custo = Math.max(h.minimo, h.rsKg * peso); fonte = 'historico';
      faixa = [Math.max(h.minimo, h.p25 * peso), Math.max(h.minimo, h.p75 * peso)];
      detalheCusto = `Estimativa pelo custo real de ${h.n} NF(s) para ${x.uf} (${brl(h.rsKg)}/kg)`;
    }
    custo = Math.round(custo * 100) / 100;
    // prazo: contratado na tabela › histórico real da rota
    const fakeE = { transportadoras: { nome: t.nome }, uf_destino: x.uf } as unknown as Entrega;
    const hist = historicoRota(fakeE, x.apr);
    const prazo = tab?.componentes.prazo_dias ?? hist?.p80 ?? null;
    const fontePrazo = tab?.componentes.prazo_dias ? 'contratado' : hist ? `80% das ${hist.n} entregas` : '';
    const pontualidade = hist && hist.comPrevisao >= 3 ? Math.round((hist.noPrazo / hist.comPrevisao) * 100) : null;
    const metaRow = x.clienteId ? x.metas.find((m) => String(m.cliente_id) === String(x.clienteId) && String(m.transportadora_id) === id) : undefined;
    const meta = metaRow ? toNumber(metaRow.meta_percentual) : null;
    const pct = x.valorNf > 0 ? (custo / x.valorNf) * 100 : null;
    out.push({
      t, custo, fonte, detalheCusto, calc, faixa, pct,
      prazo, fontePrazo, previsao: prazo !== null ? somarDiasUteis(saida, prazo) : null,
      pontualidade, amostraPrazo: hist?.n ?? 0,
      meta, dentroMeta: meta !== null && pct !== null ? pct <= meta : null, score: 0,
    });
  }
  // custo-benefício: custo (60%), prazo (25%) e pontualidade histórica (15%), normalizados entre as opções
  const minC = Math.min(...out.map((o) => o.custo)); const prazos = out.map((o) => o.prazo).filter((p): p is number => p !== null);
  const minP = prazos.length ? Math.min(...prazos) : null;
  for (const o of out) {
    const sc = minC > 0 ? minC / o.custo : 1;
    const sp = o.prazo !== null && minP ? minP / o.prazo : 0.7;
    const sq = o.pontualidade !== null ? o.pontualidade / 100 : 0.7;
    o.score = Math.round((sc * 0.6 + sp * 0.25 + sq * 0.15) * 100);
  }
  return out.sort((a, b) => a.custo - b.custo);
}

/** Resumo da cotação em texto (copiar / WhatsApp). */
export function textoCotacao(ops: OpcaoCotacao[], carga: Carga, valorNf: number, destino: string): string {
  const dt = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');
  return [
    `*Cotação de frete — ${destino}*`,
    `${carga.caixas} volume(s) · ${carga.pesoReal.toLocaleString('pt-BR')} kg${carga.m3 ? ` · ${carga.m3.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} m³` : ''} · peso taxado ${carga.pesoTaxado.toLocaleString('pt-BR')} kg${valorNf ? ` · mercadoria ${brl(valorNf)}` : ''}`,
    '',
    ...ops.map((o, i) => `${i + 1}. ${o.t.nome}: ${brl(o.custo)}${o.pct !== null ? ` (${o.pct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%)` : ''} · ${o.prazo !== null ? `${o.prazo} d.u. (entrega ~${dt(o.previsao)})` : 'prazo a confirmar'}${o.fonte === 'historico' ? ' · estimativa' : ''}`),
  ].join('\n');
}
