import { supabase } from './supabase';
import type { AcaoLog, ModuloLog } from '../types';

/** Selects com relacionamentos usados em vários lugares. */
export const SELECT_ENTREGA =
  '*, clientes (nome, cidade, uf, telefone, email, exige_agendamento), transportadoras (nome, modal_padrao, telefone, email)';
export const SELECT_DEVOLUCAO = '*, clientes (nome, cnpj_cpf), transportadoras (nome)';
export const SELECT_META = '*, clientes (nome), transportadoras (nome)';

const PAGE = 1000;

/**
 * Busca TODAS as linhas de uma consulta em blocos de 1000.
 * O Supabase devolve no máximo 1000 linhas por requisição; sem isso, a
 * partir da 1001ª entrega os registros sumiam silenciosamente das telas.
 */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

let emailAtual = '';
export const setAuditUser = (email: string) => { emailAtual = email; };

/** Registra uma ação na trilha de auditoria (falhas não interrompem o fluxo). */
export async function registrarLog(acao: AcaoLog, modulo: ModuloLog, detalhes: string) {
  if (!emailAtual) return;
  try {
    await supabase.from('logs_auditoria').insert([{ usuario_email: emailAtual, acao, modulo, detalhes }]);
  } catch (err) {
    console.error('Erro ao registrar log de auditoria:', err);
  }
}

/** Mensagem legível a partir de um erro do Supabase. */
export function mensagemErro(err: unknown, padrao = 'Ocorreu um erro inesperado.'): string {
  if (err && typeof err === 'object') {
    const e = err as { code?: string; message?: string };
    if (e.code === '23503') return 'Este registro está vinculado a outros dados e não pode ser excluído.';
    if (e.code === '23505') return 'Já existe um registro com esses dados.';
    if (e.code === '42501') return 'Sem permissão para esta operação.';
    if (e.message) return e.message;
  }
  return padrao;
}
