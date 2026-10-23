import { ISO, STATUS_EXP, fdmy, todayISO } from './config';
import { valoresFinais } from './calculos';
import type { IndicadoresApi } from './useIndicadores';
import { useAppData } from '../../state/context';
import { useFeedback } from '../../feedback/context';
import { mensagemErro } from '../../lib/db';

/** Troca o status de uma NF da Expedição direto nas listas (recalcula os totais do dia). */
export function useMudarStatusExp(api: IndicadoresApi) {
  const { email } = useAppData();
  const { toast } = useFeedback();
  return async (d: string, i: number, v: string) => {
    const l = api.store.expedicao[d];
    if (!l || !l.notas?.[i]) return;
    const notas = l.notas.map((n, j) => {
      if (j !== i) return n;
      const dt = typeof n.dt_col === 'string' && ISO.test(n.dt_col) ? n.dt_col : todayISO();
      return { ...n, status: v, dt_col: v === 'coletado' ? dt : '' };
    });
    try {
      await api.salvar('expedicao', d, valoresFinais('expedicao', l.valores ?? {}, notas, d, api.prazo), notas, email,
        `Alterou o status da NF ${l.notas[i].nf} (pedido de ${fdmy(d)}) para ${STATUS_EXP.find((s) => s[0] === v)?.[1] ?? 'sem status'}`);
    } catch (err) {
      toast({ kind: 'error', title: 'Não foi possível mudar o status', text: mensagemErro(err) });
    }
  };
}

