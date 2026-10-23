import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { registrarLog } from '../lib/db';
import { CONFIG_ALERTAS_PADRAO, gerarAlertas, lerConfigAlertas, type ConfigAlertas } from '../lib/alertas';
import { useAppData } from '../state/context';

/**
 * Alertas do dia calculados com os dados já carregados no sistema.
 * `comIndicadores` também verifica se os Indicadores Diários de ontem foram lançados.
 */
export function useAlertas(comIndicadores = false) {
  const { entregas, devolucoes, metas } = useAppData();
  const [cfg, setCfg] = useState<ConfigAlertas>(CONFIG_ALERTAS_PADRAO);
  const [indicadores, setIndicadores] = useState<{ area: string; data: string }[] | undefined>(undefined);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.from('configuracoes').select('valor').eq('chave', 'alertas').maybeSingle();
      if (vivo && data) setCfg(lerConfigAlertas(data.valor));
      if (comIndicadores) {
        const desde = new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);
        const { data: ind, error } = await supabase.from('indicadores_diarios').select('area, data').gte('data', desde);
        if (vivo && !error) setIndicadores(ind ?? []);
      }
    })();
    return () => { vivo = false; };
  }, [comIndicadores]);

  const alertas = useMemo(() => gerarAlertas({ entregas, devolucoes, metas, indicadores, cfg }), [entregas, devolucoes, metas, indicadores, cfg]);

  const salvarConfig = useCallback(async (novo: ConfigAlertas) => {
    const { error } = await supabase.from('configuracoes').upsert({ chave: 'alertas', valor: novo }, { onConflict: 'chave' });
    if (error) throw error;
    setCfg(novo);
    registrarLog('EDITOU', 'ALERTAS', `Alterou a configuração dos alertas (${novo.ativo ? 'e-mail ligado' : 'e-mail desligado'}; destinatários: ${novo.emails.join(', ') || 'nenhum'})`);
  }, []);

  const criticos = alertas.filter((a) => a.nivel === 'critico').reduce((s, a) => s + a.itens.length, 0);
  return { alertas, cfg, salvarConfig, criticos };
}
