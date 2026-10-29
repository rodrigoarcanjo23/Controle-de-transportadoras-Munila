// Leitura do XML da NF-e de SAÍDA (o mesmo arquivo que o ERP/Infarma exporta ou
// que o cliente recebe) para criar as entregas do Painel sem digitação.
import type { Cliente, Entrega, Transportadora } from '../types';

export interface NfeSaida {
  arquivo: string;
  chave: string; numero: string; serie: string; emissao: string;
  /** 1 = saída, 0 = entrada */
  tipo: string; natureza: string; modelo: string;
  emitCnpj: string;
  dest: { doc: string; nome: string; cidade: string; uf: string; fone: string; email: string };
  valor: number; volumes: number; pesoBruto: number; pesoLiquido: number;
  modFrete: string; transp: { doc: string; nome: string };
  /** arquivo de evento de cancelamento (procEventoNFe 110111) */
  cancelamento?: boolean;
}

const so = (s?: string | null) => (s ?? '').replace(/\D/g, '');
const num = (s?: string | null) => { const n = parseFloat((s ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
const primeiro = (el: Element | Document | undefined | null, tag: string) => el?.getElementsByTagName(tag)[0] ?? null;
const txt = (el: Element | Document | undefined | null, tag: string) => primeiro(el, tag)?.textContent?.trim() ?? '';

export const MOD_FRETE: Record<string, string> = {
  '0': 'CIF (por conta do emitente)', '1': 'FOB (por conta do destinatário)', '2': 'Por conta de terceiros',
  '3': 'Próprio do remetente', '4': 'Próprio do destinatário', '9': 'Sem frete',
};

export function lerNfeSaida(texto: string, arquivo: string): NfeSaida {
  const doc = new DOMParser().parseFromString(texto, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('arquivo não é um XML válido');

  // evento de cancelamento: só informa a chave cancelada
  const ev = primeiro(doc, 'infEvento');
  if (ev && txt(ev, 'tpEvento') === '110111') {
    const chave = txt(ev, 'chNFe');
    return { arquivo, chave, numero: chave.length === 44 ? String(Number(chave.slice(25, 34))) : '', serie: '', emissao: txt(ev, 'dhEvento').slice(0, 10), tipo: '', natureza: 'Cancelamento', modelo: '',
      emitCnpj: '', dest: { doc: '', nome: '', cidade: '', uf: '', fone: '', email: '' }, valor: 0, volumes: 0, pesoBruto: 0, pesoLiquido: 0, modFrete: '', transp: { doc: '', nome: '' }, cancelamento: true };
  }

  const inf = primeiro(doc, 'infNFe');
  if (!inf) throw new Error(primeiro(doc, 'infCte') ? 'é um CTE (importe em Registro de CTE)' : 'não é uma NF-e');
  const ide = primeiro(inf, 'ide'); const emit = primeiro(inf, 'emit'); const dest = primeiro(inf, 'dest');
  const ender = primeiro(dest, 'enderDest'); const tot = primeiro(inf, 'ICMSTot'); const transp = primeiro(inf, 'transp');
  const transporta = primeiro(transp, 'transporta');
  let volumes = 0; let pesoB = 0; let pesoL = 0;
  const vols = transp?.getElementsByTagName('vol') ?? [];
  for (let i = 0; i < vols.length; i++) { volumes += num(txt(vols[i], 'qVol')); pesoB += num(txt(vols[i], 'pesoB')); pesoL += num(txt(vols[i], 'pesoL')); }
  const chave = (inf.getAttribute('Id') ?? '').replace(/^NFe/i, '') || so(txt(doc, 'chNFe'));

  return {
    arquivo, chave,
    numero: String(Number(txt(ide, 'nNF')) || txt(ide, 'nNF')),
    serie: txt(ide, 'serie'),
    emissao: (txt(ide, 'dhEmi') || txt(ide, 'dEmi')).slice(0, 10),
    tipo: txt(ide, 'tpNF'), natureza: txt(ide, 'natOp'), modelo: txt(ide, 'mod'),
    emitCnpj: so(txt(emit, 'CNPJ')),
    dest: {
      doc: so(txt(dest, 'CNPJ') || txt(dest, 'CPF')), nome: txt(dest, 'xNome'),
      cidade: txt(ender, 'xMun'), uf: txt(ender, 'UF'), fone: so(txt(ender, 'fone')), email: txt(dest, 'email'),
    },
    valor: num(txt(tot, 'vNF')),
    volumes, pesoBruto: Math.round(pesoB * 1000) / 1000, pesoLiquido: Math.round(pesoL * 1000) / 1000,
    modFrete: txt(transp, 'modFrete'),
    transp: { doc: so(txt(transporta, 'CNPJ') || txt(transporta, 'CPF')), nome: txt(transporta, 'xNome') },
  };
}

const norm = (s?: string | null) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ')
  .replace(/\s+(LTDA|S A|SA|ME|EPP|EIRELI|MEI)\s*$/g, '').replace(/\s+/g, ' ').trim();

export function acharCliente(n: NfeSaida, clientes: Cliente[]): Cliente | undefined {
  if (n.dest.doc) { const c = clientes.find((x) => so(x.cnpj_cpf) === n.dest.doc); if (c) return c; }
  const nome = norm(n.dest.nome);
  return nome ? clientes.find((x) => norm(x.razao_social) === nome || norm(x.nome) === nome) : undefined;
}

export function acharTransportadora(n: NfeSaida, transps: Transportadora[]): Transportadora | undefined {
  if (n.transp.doc) { const t = transps.find((x) => so(x.cnpj_cpf) === n.transp.doc); if (t) return t; }
  const nome = norm(n.transp.nome);
  if (!nome) return undefined;
  return transps.find((x) => norm(x.razao_social) === nome || norm(x.nome) === nome)
    ?? transps.find((x) => norm(x.nome).length > 3 && nome.includes(norm(x.nome)));
}

/** NF já existe no Painel? (compara o número inteiro, inclusive em "17248 / 17252") */
export function nfExistente(numero: string, entregas: Entrega[]): Entrega | undefined {
  return entregas.find((e) => (e.nota_fiscal.match(/\d+/g) ?? []).some((x) => String(Number(x)) === numero));
}
