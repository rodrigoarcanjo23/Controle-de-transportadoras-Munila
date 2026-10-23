import type { Cliente } from '../types';
import { formatCnpj } from './format';

function parseXml(texto: string): Document {
  const doc = new DOMParser().parseFromString(texto, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('XML inválido');
  return doc;
}

const tag = (parent: Document | Element, nome: string) =>
  parent.getElementsByTagName(nome)[0]?.textContent ?? '';

export function lerArquivoTexto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/** Extrai os números de NF de uma lista de chaves (44 dígitos) ou NFs digitadas. */
export function obterListaNFs(chavesStr?: string | null): string[] {
  if (!chavesStr) return [];
  const nfs = chavesStr
    .split(/,| \/ |\//)
    .map((raw) => {
      const chave = raw.replace(/\D/g, '');
      if (chave.length === 44) return Number(chave.substring(25, 34)).toString();
      if (chave.length > 0) return Number(chave).toString();
      return '';
    })
    .filter(Boolean);
  return Array.from(new Set(nfs));
}

export const nfsDasChaves = (chaves?: string | null) => {
  const nfs = obterListaNFs(chaves);
  return nfs.length ? nfs.join(' / ') : '-';
};

/** Variações de busca: "16464" e "000016464". */
export const variacoesNF = (nfs: string[]) =>
  nfs.flatMap((nf) => {
    const n = Number(nf).toString();
    return [n, n.padStart(9, '0')];
  });

export interface CteXml {
  numero_documento: string;
  chave_acesso: string[];
  razao_social_emitente: string;
  cnpj_emitente: string;
  cfop: string;
  valor_total_servico: string;
  data_emissao: string;
  observacao: string;
}

export function parseCteXml(texto: string): CteXml {
  const doc = parseXml(texto);
  const emit = doc.getElementsByTagName('emit')[0];
  const cnpjRaw = emit ? tag(emit, 'CNPJ') : '';
  const razao = emit ? tag(emit, 'xNome') : '';

  const chaves: string[] = [];
  const nfeNodes = doc.getElementsByTagName('infNFe');
  for (let i = 0; i < nfeNodes.length; i++) {
    const ch = nfeNodes[i].getElementsByTagName('chave')[0]?.textContent;
    if (ch) chaves.push(ch);
  }
  if (!chaves.length) {
    const chNFe = tag(doc, 'chNFe');
    const chCTe = tag(doc, 'chCTe');
    if (chNFe) chaves.push(chNFe);
    else if (chCTe) chaves.push(chCTe);
  }

  return {
    numero_documento: tag(doc, 'nCT') || tag(doc, 'nNF'),
    chave_acesso: chaves.length ? chaves : [''],
    razao_social_emitente: razao,
    cnpj_emitente: cnpjRaw.length === 14 ? formatCnpj(cnpjRaw) : cnpjRaw,
    cfop: tag(doc, 'CFOP'),
    valor_total_servico: tag(doc, 'vTPrest') || tag(doc, 'vNF') || tag(doc, 'vProd'),
    data_emissao: (tag(doc, 'dhEmi') || '').split('T')[0],
    observacao: tag(doc, 'xObs') || tag(doc, 'infCpl'),
  };
}

export interface DevolucaoXml {
  data_emissao: string;
  notas_fiscais: string;
  nf_venda: string;
  valor_total_nf: string;
  volume: string;
  peso_kg: string;
  motivo: string;
  cnpj_emitente: string;
  cliente?: Cliente;
}

export function parseNfeDevolucaoXml(texto: string, clientes: Cliente[]): DevolucaoXml {
  const doc = parseXml(texto);

  let nfVenda = '';
  const ref = doc.getElementsByTagName('refNFe')[0]?.textContent ?? '';
  if (ref.length === 44) nfVenda = Number(ref.substring(25, 34)).toString();

  const total = doc.getElementsByTagName('total')[0];
  const transp = doc.getElementsByTagName('transp')[0];
  const emit = doc.getElementsByTagName('emit')[0];
  const cnpj = emit ? tag(emit, 'CNPJ') : '';
  const limpa = (s: string) => s.replace(/\D/g, '');
  const cliente = cnpj ? clientes.find((c) => limpa(c.cnpj_cpf || '') === limpa(cnpj)) : undefined;

  return {
    data_emissao: (tag(doc, 'dhEmi') || '').split('T')[0],
    notas_fiscais: tag(doc, 'nNF'),
    nf_venda: nfVenda,
    valor_total_nf: total ? tag(total, 'vNF') : '',
    volume: transp ? tag(transp, 'qVol') : '',
    peso_kg: transp ? tag(transp, 'pesoB') : '',
    motivo: tag(doc, 'natOp'),
    cnpj_emitente: cnpj,
    cliente,
  };
}
