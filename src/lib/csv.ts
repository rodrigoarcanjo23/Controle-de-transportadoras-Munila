/**
 * Gera e baixa um CSV compatível com o Excel em português (separador ";",
 * BOM UTF-8). Usa Blob — o método antigo (data:URI + encodeURI) cortava o
 * arquivo quando algum texto tinha "#".
 */
export function downloadCsv(nomeBase: string, cabecalho: string[], linhas: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const conteudo = [cabecalho, ...linhas].map((l) => l.map(esc).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nomeBase}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Número no formato brasileiro para planilha (vírgula decimal). */
export const csvNum = (v: unknown, fallback = '0,00') =>
  v === null || v === undefined || v === '' ? fallback : String(v).replace('.', ',');

/** Divide uma linha CSV respeitando aspas. Aceita "," ou ";" como separador. */
export function splitCsvLine(linha: string, sep: ',' | ';'): string[] {
  const re = sep === ',' ? /,(?=(?:(?:[^"]*"){2})*[^"]*$)/ : /;(?=(?:(?:[^"]*"){2})*[^"]*$)/;
  return linha.split(re).map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
}
