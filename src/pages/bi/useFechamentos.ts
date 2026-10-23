import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { registrarLog } from '../../lib/db';
import { fmtMes } from '../../lib/bi';
import type { Entrega } from '../../types';
import type { DadosBI } from './Secoes';

export interface Fechamento { id: string; mes: string; observacao?: string | null; fechado_por?: string | null; created_at: string }

/** Guarda só o essencial das NFs listadas (o resto dos números já está calculado). */
const enxuta = (e: Entrega) => ({
  id: e.id, nota_fiscal: e.nota_fiscal, status: e.status, peso_kg: e.peso_kg ?? null, data_previsao: e.data_previsao ?? null,
  clientes: e.clientes?.nome ? { nome: e.clientes.nome } : null,
}) as unknown as Entrega;

/** Foto do BI para guardar no banco. */
export function congelar(d: DadosBI): DadosBI {
  return {
    ...d,
    m: { ...d.m, pesosIgnorados: d.m.pesosIgnorados.map(enxuta), vencidasAbertas: d.m.vencidasAbertas.map(enxuta) },
    qualidade: d.qualidade.map((q) => ({ ...q, nfs: q.nfs.map(enxuta) })),
  };
}

/**
 * Fechamentos mensais: os números do BI de um mês ficam congelados no dia do
 * fechamento. Correções posteriores em NFs antigas não mudam o que foi
 * apresentado — e o painel mostra a diferença, se houver.
 */
export function useFechamentos() {
  const [lista, setLista] = useState<Fechamento[]>([]);
  const [disponivel, setDisponivel] = useState(true);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('fechamentos_mensais').select('id, mes, observacao, fechado_por, created_at').order('mes', { ascending: false });
    if (error) { setDisponivel(false); return; }   // tabela ainda não criada (SQL não rodado)
    setDisponivel(true);
    setLista((data ?? []) as Fechamento[]);
  }, []);
  // busca assíncrona: os setState ocorrem após o await
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar(); }, [carregar]);

  const abrir = useCallback(async (mes: string): Promise<DadosBI | null> => {
    const { data, error } = await supabase.from('fechamentos_mensais').select('dados').eq('mes', mes).maybeSingle();
    if (error || !data) return null;
    return data.dados as DadosBI;
  }, []);

  const fechar = useCallback(async (mes: string, dados: DadosBI, email: string) => {
    const { error } = await supabase.from('fechamentos_mensais').insert({ mes, dados: congelar(dados), fechado_por: email });
    if (error) throw error;
    await registrarLog('CRIOU', 'FECHAMENTO', `Fechou o mês ${fmtMes(mes)} no Painel de BI (${dados.m.notas} NFs, faturamento ${dados.m.faturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`);
    await carregar();
  }, [carregar]);

  const reabrir = useCallback(async (mes: string) => {
    const { error } = await supabase.from('fechamentos_mensais').delete().eq('mes', mes);
    if (error) throw error;
    await registrarLog('APAGOU', 'FECHAMENTO', `Reabriu o mês ${fmtMes(mes)} (fechamento excluído)`);
    await carregar();
  }, [carregar]);

  return { lista, disponivel, abrir, fechar, reabrir };
}
