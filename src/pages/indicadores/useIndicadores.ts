import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fetchAll, registrarLog } from '../../lib/db';
import { AREA, AREAS, fdmy, type AreaId, type Dia, type Lancamento, type Nota } from './config';

export type EstadoBase = 'loading' | 'ok' | 'sem_tabela' | 'erro';

/** Tabela ainda não criada no Supabase? (o SQL de supabase/indicadores_diarios.sql não foi rodado) */
function faltaTabela(err: unknown) {
  const e = err as { code?: string; message?: string } | null;
  return !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|could not find the table/i.test(e.message ?? ''));
}

export function useIndicadores() {
  const [lancs, setLancs] = useState<Lancamento[]>([]);
  const [estado, setEstado] = useState<EstadoBase>('loading');
  const [prazo, setPrazoState] = useState(1);

  const carregar = useCallback(async () => {
    try {
      const rows = await fetchAll<Lancamento>((f, t) =>
        supabase.from('indicadores_diarios').select('id, area, data, valores, notas, atualizado_por, updated_at').order('data').range(f, t));
      setLancs(rows);
      const { data: cfg } = await supabase.from('configuracoes').select('valor').eq('chave', 'prazo_coleta_dias').maybeSingle();
      const v = Number(cfg?.valor);
      if (Number.isFinite(v) && v >= 0 && v <= 10) setPrazoState(Math.round(v));
      setEstado('ok');
    } catch (err) {
      console.error(err);
      setEstado(faltaTabela(err) ? 'sem_tabela' : 'erro');
    }
  }, []);

  // busca assíncrona: os setState ocorrem após o await
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar(); }, [carregar]);

  /** store[area][data] → lançamento */
  const store = useMemo(() => {
    const s = Object.fromEntries(AREAS.map((a) => [a.id, {} as Record<string, Lancamento>])) as Record<AreaId, Record<string, Lancamento>>;
    for (const l of lancs) if (s[l.area]) s[l.area][l.data] = l;
    return s;
  }, [lancs]);

  /** Dias lançados de uma área dentro do período (e dos dias da semana escolhidos). */
  const dias = useCallback((area: AreaId, de: string, ate: string, dows?: number[]): Dia[] => {
    const ds = dows ? new Set(dows) : null;
    return Object.values(store[area])
      .filter((l) => l.data >= de && l.data <= ate && (!ds || ds.has(new Date(l.data + 'T12:00:00Z').getUTCDay())))
      .sort((a, b) => a.data.localeCompare(b.data))
      .map((l) => ({ d: l.data, v: l.valores ?? {}, notas: Array.isArray(l.notas) ? l.notas : [] }));
  }, [store]);

  const salvar = useCallback(async (area: AreaId, data: string, valores: Record<string, number | null>, notas: Nota[], email: string, detalhe?: string) => {
    const existia = !!store[area][data];
    const { data: row, error } = await supabase.from('indicadores_diarios')
      .upsert({ area, data, valores, notas, atualizado_por: email }, { onConflict: 'area,data' })
      .select('id, area, data, valores, notas, atualizado_por, updated_at').single();
    if (error) throw error;
    setLancs((l) => [...l.filter((x) => !(x.area === area && x.data === data)), row as Lancamento]);
    registrarLog(existia ? 'EDITOU' : 'CRIOU', 'INDICADORES', detalhe ?? `${existia ? 'Atualizou' : 'Lançou'} ${AREA[area].nome} de ${fdmy(data)}`);
  }, [store]);

  const excluir = useCallback(async (area: AreaId, data: string) => {
    const { error } = await supabase.from('indicadores_diarios').delete().eq('area', area).eq('data', data);
    if (error) throw error;
    setLancs((l) => l.filter((x) => !(x.area === area && x.data === data)));
    registrarLog('APAGOU', 'INDICADORES', `Excluiu o lançamento de ${AREA[area].nome} de ${fdmy(data)}`);
  }, []);

  const setPrazo = useCallback(async (dias: number) => {
    const anterior = prazo;
    setPrazoState(dias);
    const { error } = await supabase.from('configuracoes').upsert({ chave: 'prazo_coleta_dias', valor: dias }, { onConflict: 'chave' });
    if (error) { setPrazoState(anterior); throw error; }
    registrarLog('EDITOU', 'INDICADORES', `Alterou o prazo de coleta para D+${dias}`);
  }, [prazo]);

  /** Grava vários dias de uma vez (importação de CSV). */
  const importar = useCallback(async (regs: Lancamento[], email: string, detalhe: string) => {
    const gravados: Lancamento[] = [];
    for (let i = 0; i < regs.length; i += 200) {
      const lote = regs.slice(i, i + 200).map((r) => ({ area: r.area, data: r.data, valores: r.valores, notas: r.notas, atualizado_por: email }));
      const { data, error } = await supabase.from('indicadores_diarios').upsert(lote, { onConflict: 'area,data' })
        .select('id, area, data, valores, notas, atualizado_por, updated_at');
      if (error) throw error;
      gravados.push(...((data ?? []) as Lancamento[]));
    }
    const chave = (l: Lancamento) => `${l.area}|${l.data}`;
    const novos = new Map(gravados.map((g) => [chave(g), g]));
    setLancs((l) => [...l.filter((x) => !novos.has(chave(x))), ...novos.values()]);
    registrarLog('CRIOU', 'INDICADORES', detalhe);
    return gravados.length;
  }, []);

  return { estado, store, dias, salvar, excluir, importar, prazo, setPrazo, recarregar: carregar };
}
export type IndicadoresApi = ReturnType<typeof useIndicadores>;
