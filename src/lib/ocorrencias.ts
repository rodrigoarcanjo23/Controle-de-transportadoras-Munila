// Ocorrências de entrega (padrão simplificado, inspirado no OCOREN/PROCEDA).
// Mesmas regras usadas pelo portal do transportador (função portal_registrar no banco).
import type { Entrega } from '../types';

export type CodigoOcorrencia = 'coletado' | 'agendado' | 'entregue' | 'cliente_ausente' | 'recusa' | 'avaria' | 'endereco' | 'reentrega' | 'outro';

export const OCORRENCIAS: { codigo: CodigoOcorrencia; label: string; tone: string; dataLabel: string; pedePrevisao?: boolean; pedeCanhoto?: boolean }[] = [
  { codigo: 'coletado', label: 'Coletado / em trânsito', tone: 'blue', dataLabel: 'Data da coleta', pedePrevisao: true },
  { codigo: 'agendado', label: 'Entrega agendada', tone: 'purple', dataLabel: 'Data agendada' },
  { codigo: 'entregue', label: 'Entregue', tone: 'green', dataLabel: 'Data da entrega', pedeCanhoto: true },
  { codigo: 'cliente_ausente', label: 'Cliente ausente / fechado', tone: 'amber', dataLabel: 'Data da tentativa', pedePrevisao: true },
  { codigo: 'reentrega', label: 'Reentrega programada', tone: 'amber', dataLabel: 'Data', pedePrevisao: true },
  { codigo: 'endereco', label: 'Endereço não localizado', tone: 'orange', dataLabel: 'Data', pedePrevisao: true },
  { codigo: 'avaria', label: 'Avaria', tone: 'red', dataLabel: 'Data', pedePrevisao: true },
  { codigo: 'recusa', label: 'Recusado pelo cliente', tone: 'red', dataLabel: 'Data' },
  { codigo: 'outro', label: 'Outra ocorrência', tone: 'slate', dataLabel: 'Data', pedePrevisao: true },
];
export const ocorrenciaDe = (c: string) => OCORRENCIAS.find((o) => o.codigo === c);

/** O que muda na entrega ao registrar a ocorrência (igual ao portal). */
export function efeitoNaEntrega(e: Entrega, codigo: CodigoOcorrencia, data: string, novaPrevisao?: string | null): Partial<Entrega> {
  if (codigo === 'entregue') return { status: 'Entregue', data_entrega_agendamento: data };
  if (codigo === 'coletado') return { status: 'Em Transporte', data_coleta: e.data_coleta || data, data_previsao: novaPrevisao || e.data_previsao || null };
  if (codigo === 'agendado') return { status: 'Agendado', data_entrega_agendamento: data };
  return { status: 'Problema', data_previsao: novaPrevisao || e.data_previsao || null };
}

export interface Ocorrencia {
  id: string; entrega_id: string; codigo: string; descricao?: string | null; data_ocorrencia: string; nova_previsao?: string | null;
  observacao?: string | null; canhoto_path?: string | null; origem: 'portal' | 'interno'; autor?: string | null; created_at: string;
}

/** Nome de arquivo seguro para o canhoto. */
export const caminhoCanhoto = (pasta: string, entregaId: string, arquivo: File) => {
  const ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
  return `${pasta}/${entregaId}-${Date.now()}.${ext}`;
};

/** Reduz fotos grandes do celular antes de enviar (máx. 1600 px, JPEG). PDFs passam direto. */
export async function comprimirImagem(f: File): Promise<File> {
  if (!f.type.startsWith('image/') || f.size < 500_000) return f;
  try {
    const bmp = await createImageBitmap(f);
    const esc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(bmp.width * esc); cv.height = Math.round(bmp.height * esc);
    cv.getContext('2d')!.drawImage(bmp, 0, 0, cv.width, cv.height);
    const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/jpeg', 0.82));
    return blob ? new File([blob], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : f;
  } catch { return f; }
}
