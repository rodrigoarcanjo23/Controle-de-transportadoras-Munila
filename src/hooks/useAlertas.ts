import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { registrarLog } from '../lib/db';
import { lerConfigSLA, type ConfigSLA } from '../lib/sla';
import { CONFIG_ALERTAS_PADRAO, gerarAlertas, lerConfigAlertas, type ConfigAlertas, type FaturaAlerta } from '../lib/alertas';
import { useAppData } from '../state/context';

/**
 * Alertas do dia calculados com os dados já carregados no sistema.
 * `comIndicadores` também verifica se os Indicadores Diários de ontem foram lançados.
 */
export function useAlertas(comIndicadores = false) {
  const { entregas, devolucoes, metas, transportadoras } = useAppData();
  const [cfg, setCfg] = useState<ConfigAlertas>(CONFIG_ALERTAS_PADRAO);
  const [sla, setSla] = useState<ConfigSLA | undefined>(undefined);
  const [indicadores, setIndicadores] = useState<{ area: string; data: string }[] | undefined>(undefined);
  const [faturasRaw, setFaturasRaw] = useState<(Omit<FaturaAlerta, 'transportadora'> & { transportadora_id: string })[] | undefined>(undefined);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data: cfgs } = await supabase.from('configuracoes').select('chave, valor').in('chave', ['alertas', 'sla', 'prazo_coleta_dias']);
      const v = (k: string) => cfgs?.find((x) => x.chave === k)?.valor;
      if (vivo && v('alertas')) setCfg(lerConfigAlertas(v('alertas')));
      const col = Number(v('prazo_coleta_dias'));
      if (vivo) setSla(lerConfigSLA(v('sla'), Number.isFinite(col) ? col : undefined));
      // faturas de frete em aberto (se a tabela ainda não existe, o alerta é pulado)
      const { data: fat, error: ef } = await supabase.from('faturas_frete').select('numero, transportadora_id, vencimento, valor, status, updated_at')
        .in('status', ['recebida', 'conferida', 'contestada', 'aprovada']);
      if (vivo && !ef) setFaturasRaw((fat ?? []).map((f) => ({ ...f, valor: Number(f.valor) || 0, atualizada: f.updated_at as string })));
      if (comIndicadores) {
        const desde = new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);
        const { data: ind, error } = await supabase.from('indicadores_diarios').select('area, data').gte('data', desde);
        if (vivo && !error) setIndicadores(ind ?? []);
      }
    })();
    return () => { vivo = false; };
  }, [comIndicadores]);

  const faturas = useMemo(() => faturasRaw?.map((f) => ({ ...f, transportadora: transportadoras.find((t) => String(t.id) === String(f.transportadora_id))?.nome ?? '—' })), [faturasRaw, transportadoras]);
  const alertas = useMemo(() => gerarAlertas({ entregas, devolucoes, metas, indicadores, faturas, sla, cfg }), [entregas, devolucoes, metas, indicadores, faturas, sla, cfg]);

  const salvarConfig = useCallback(async (novo: ConfigAlertas) => {
    const { error } = await supabase.from('configuracoes').upsert({ chave: 'alertas', valor: novo }, { onConflict: 'chave' });
    if (error) throw error;
    setCfg(novo);
    registrarLog('EDITOU', 'ALERTAS', `Alterou a configuração dos alertas (${novo.ativo ? 'e-mail ligado' : 'e-mail desligado'}; destinatários: ${novo.emails.join(', ') || 'nenhum'})`);
  }, []);

  const criticos = alertas.filter((a) => a.nivel === 'critico').reduce((s, a) => s + a.itens.length, 0);
  return { alertas, cfg, salvarConfig, criticos };
}
