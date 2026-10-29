// Leitura do código de barras do DANFE (chave de acesso da NF-e, 44 dígitos)
// ou de um número de NF digitado/lido por leitor USB.
import type { Entrega } from '../types';

export interface LeituraNF { nf: string; chave?: string; cnpjEmitente?: string }

/** Chave NF-e: cUF(2) AAMM(4) CNPJ(14) modelo(2) série(3) nNF(9) tpEmis(1) cNF(8) DV(1). */
export function lerCodigo(texto: string): LeituraNF | null {
  const so = texto.replace(/\D/g, '');
  const m = so.match(/\d{44}/);
  if (m) {
    const chave = m[0];
    const modelo = chave.slice(20, 22);
    if (modelo === '55' || modelo === '65') return { nf: String(Number(chave.slice(25, 34))), chave, cnpjEmitente: chave.slice(6, 20) };
  }
  if (so.length >= 3 && so.length <= 9) return { nf: String(Number(so)) };
  return null;
}

/** Encontra a entrega pelo número (aceita entregas com várias NFs, ex.: "17248 / 17252"). */
export function acharEntrega<T extends Pick<Entrega, 'nota_fiscal'>>(lista: T[], nf: string): T | undefined {
  return lista.find((e) => (e.nota_fiscal.match(/\d+/g) ?? []).some((n) => String(Number(n)) === nf));
}
