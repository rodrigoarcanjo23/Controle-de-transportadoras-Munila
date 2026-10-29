// Cadastro de produtos: o que falta para o Simulador de frete ser preciso,
// montagem do registro e leitura da planilha de importação.
import type { Produto } from '../types';
import { medidasProduto } from './cotacao';
import { parseDecimalBR, toNumber } from './format';

/** Campos que o simulador usa. Os três primeiros são obrigatórios para a cubagem/peso. */
export function pendencias(p: Produto): string[] {
  const f: string[] = [];
  if (!(toNumber(p.unidades_por_caixa) > 0)) f.push('unidades por caixa');
  if (!(toNumber(p.peso_caixa_kg) > 0)) f.push('peso da caixa');
  if (!medidasProduto(p)) f.push('medidas');
  if (!(toNumber(p.preco_unitario) > 0)) f.push('preço');
  return f;
}
/** Completo para o frete = un/cx, peso e medidas (o preço só sugere o valor da mercadoria). */
export const completoParaFrete = (p: Produto) => pendencias(p).filter((x) => x !== 'preço').length === 0;

export interface FormProduto {
  codigo: string; ean: string; nome: string; unidades: string; pesoCaixa: string; pesoUnit: string;
  comp: string; larg: string; alt: string; preco: string; ativo: boolean; observacao: string;
}
export const FORM_VAZIO: FormProduto = { codigo: '', ean: '', nome: '', unidades: '', pesoCaixa: '', pesoUnit: '', comp: '', larg: '', alt: '', preco: '', ativo: true, observacao: '' };

const dec = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(Number(v)) || Number(v) === 0 ? '' : String(v).replace('.', ','));

export function formDe(p: Produto): FormProduto {
  const d = medidasProduto(p);
  return {
    codigo: p.codigo ?? '', ean: p.ean ?? '', nome: p.nome ?? '', unidades: dec(p.unidades_por_caixa), pesoCaixa: dec(p.peso_caixa_kg), pesoUnit: dec(p.peso_unitario_kg),
    comp: d ? dec(d[0]) : '', larg: d ? dec(d[1]) : '', alt: d ? dec(d[2]) : '', preco: dec(p.preco_unitario), ativo: p.ativo !== false, observacao: p.observacao ?? '',
  };
}

const num = (s: string) => { const n = parseDecimalBR(s); return n !== null && n > 0 ? n : null; };
const fmtCm = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

/** Registro completo para o banco. */
export function registroCompleto(f: FormProduto) {
  const c = num(f.comp); const l = num(f.larg); const a = num(f.alt);
  const base = {
    codigo: f.codigo.trim() || null,
    nome: f.nome.trim().toUpperCase(),
    unidades_por_caixa: Math.max(1, Math.round(num(f.unidades) ?? 1)),
    peso_caixa_kg: num(f.pesoCaixa) ?? 0,
    // texto antigo continua preenchido (compatibilidade com telas/relatórios antigos)
    medidas_cm: c && l && a ? `${fmtCm(c)}x${fmtCm(l)}x${fmtCm(a)}` : null,
  };
  return {
    ...base, ean: f.ean.replace(/\D/g, '') || null, comprimento_cm: c, largura_cm: l, altura_cm: a,
    peso_unitario_kg: num(f.pesoUnit), preco_unitario: num(f.preco), ativo: f.ativo, observacao: f.observacao.trim() || null,
  };
}

/** `completo=false` → só as colunas antigas (o banco ainda não rodou produtos.sql). */
export function registroDe(f: FormProduto, completo: boolean) {
  const r = registroCompleto(f);
  if (completo) return r;
  const { codigo, nome, unidades_por_caixa, peso_caixa_kg, medidas_cm } = r;
  return { codigo, nome, unidades_por_caixa, peso_caixa_kg, medidas_cm };
}

/** Problemas que impedem salvar (ou que valem um alerta). */
export function validar(f: FormProduto): { erros: string[]; avisos: string[] } {
  const erros: string[] = []; const avisos: string[] = [];
  if (!f.nome.trim()) erros.push('Informe o nome do produto.');
  const dims = [f.comp, f.larg, f.alt].map(num);
  const preenchidas = dims.filter((x) => x !== null).length;
  if (preenchidas > 0 && preenchidas < 3) erros.push('Preencha as três medidas da caixa (ou nenhuma).');
  if (dims.some((x) => x !== null && x > 300)) avisos.push('Alguma medida passa de 3 m — confira se está em centímetros.');
  const un = num(f.unidades) ?? 1; const pc = num(f.pesoCaixa); const pu = num(f.pesoUnit);
  if (pc && pu && pu * un > pc + 0.0005) erros.push(`Unidades × peso da unidade (${(pu * un).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg) passa do peso da caixa.`);
  if (pc && pc > 1000) avisos.push('Peso da caixa acima de 1.000 kg — confira a unidade (kg).');
  if (f.ean && !/^\d{8}$|^\d{12,14}$/.test(f.ean.replace(/\D/g, ''))) avisos.push('EAN/GTIN normalmente tem 8, 12, 13 ou 14 dígitos.');
  return { erros, avisos };
}

/* ------------------------------------------------------------------ */
/* Planilha (CSV)                                                       */
/* ------------------------------------------------------------------ */
export const CABECALHO_CSV = ['Código', 'Nome', 'EAN', 'Unidades por caixa', 'Peso da caixa (kg)', 'Peso da unidade (kg)', 'Comprimento (cm)', 'Largura (cm)', 'Altura (cm)', 'Preço unitário (R$)', 'Ativo'];

export function linhaCsv(p: Produto): (string | number | null)[] {
  const f = formDe(p);
  return [f.codigo, f.nome, f.ean, f.unidades, f.pesoCaixa, f.pesoUnit, f.comp, f.larg, f.alt, f.preco, f.ativo ? 'SIM' : 'NÃO'];
}

/** Uma linha da planilha → formulário (mesma ordem do modelo). */
export function formDaLinha(c: string[]): FormProduto | null {
  const [codigo = '', nome = '', ean = '', unidades = '', pesoCaixa = '', pesoUnit = '', comp = '', larg = '', alt = '', preco = '', ativo = ''] = c;
  if (!nome.trim()) return null;
  return {
    codigo: codigo.trim(), nome, ean, unidades, pesoCaixa, pesoUnit, comp, larg, alt, preco: preco.replace(/R\$\s*/i, ''),
    ativo: !/^(n|nao|não|0|false|inativo)$/i.test(ativo.trim()), observacao: '',
  };
}

/** Acha o produto já cadastrado pelo código (sem diferenciar maiúsculas) ou, sem código, pelo nome. */
export function produtoExistente(produtos: Produto[], f: Pick<FormProduto, 'codigo' | 'nome'>): Produto | undefined {
  const cod = f.codigo.trim().toLowerCase();
  if (cod) return produtos.find((p) => (p.codigo ?? '').trim().toLowerCase() === cod);
  const nome = f.nome.trim().toUpperCase();
  return produtos.find((p) => !(p.codigo ?? '').trim() && (p.nome ?? '').trim().toUpperCase() === nome);
}
