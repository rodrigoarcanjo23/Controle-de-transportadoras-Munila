import { useEffect, useState } from 'react';
import { CalendarCheck, CircleCheck, Clock, FilePlus2, Pencil, Trash2, Truck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate, formatDateTimeBR, iniciais } from '../lib/format';
import { useAppData } from '../state/context';
import { Modal } from '../components/ui/Modal';
import { StatusBadge } from '../components/ui/basics';
import type { Entrega, LogAuditoria } from '../types';

/** Números de NF contidos no campo (ex.: "17248 / 17252" → ["17248", "17252"]). */
const numerosNF = (nf: string) => [...new Set(nf.match(/\d{3,}/g) ?? [])];

const ICONE: Record<string, typeof Pencil> = { CRIOU: FilePlus2, EDITOU: Pencil, APAGOU: Trash2 };

/**
 * Linha do tempo de uma entrega: as datas da operação (pedido → entrega) e
 * tudo o que foi feito no sistema com essa NF (quem criou, mudou status,
 * aplicou o frete do CTE…), a partir da Auditoria.
 */
export function ModalHistorico({ entrega, onClose }: { entrega: Entrega; onClose: () => void }) {
  const { perfis } = useAppData();
  const [logs, setLogs] = useState<LogAuditoria[] | null>(null);
  const [erro, setErro] = useState('');
  const nfs = numerosNF(entrega.nota_fiscal);

  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!nfs.length) { setLogs([]); return; }
      const { data, error } = await supabase.from('logs_auditoria').select('*')
        .in('modulo', ['ENTREGAS', 'DEVOLUCOES'])
        .or(nfs.map((n) => `detalhes.ilike.%${n}%`).join(','))
        .order('criado_em', { ascending: false }).limit(300);
      if (!vivo) return;
      if (error) { setErro(error.message); setLogs([]); return; }
      // confere o número inteiro (17248 não pode casar com 172480)
      const re = new RegExp(`(^|\\D)(${nfs.join('|')})(\\D|$)`);
      setLogs((data ?? []).filter((l: LogAuditoria) => re.test(l.detalhes)));
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrega.id]);

  const nome = (email: string) => perfis.find((p) => p.email?.toLowerCase() === email?.toLowerCase())?.nome ?? email;
  const etapas: [string, string | null | undefined, typeof Clock][] = [
    ['Pedido', entrega.data_entrada_pedido, FilePlus2],
    ['Faturamento', entrega.data_faturamento, CalendarCheck],
    ['Coleta', entrega.data_coleta, Truck],
    ['Previsão', entrega.data_previsao, Clock],
    [entrega.status === 'Entregue' ? 'Entrega' : 'Entrega/agend.', entrega.data_entrega_agendamento, CircleCheck],
  ];

  return (
    <Modal size="lg" onClose={onClose} title={`Histórico · NF ${entrega.nota_fiscal}`}
      subtitle={<>{entrega.clientes?.nome ?? '—'} · {entrega.transportadoras?.nome ?? 'sem transportadora'} · <StatusBadge status={entrega.status} /></>}
      footer={<button type="button" className="btn" onClick={onClose}>Fechar</button>}>
      <div className="hist">
        <div className="hist__etapas">
          {etapas.map(([l, d, Ic]) => (
            <div key={l} className={`hist__etapa ${d ? 'is-feita' : ''}`}>
              <span className="hist__etapa-ic"><Ic size={16} /></span>
              <strong>{l}</strong>
              <small>{d ? formatDate(d) : '—'}</small>
            </div>
          ))}
        </div>

        <h4 className="hist__tit">Alterações no sistema</h4>
        {logs === null ? <p className="muted">Carregando…</p>
          : erro ? <p className="text-red">Não foi possível carregar o histórico: {erro}</p>
          : !logs.length ? <p className="muted">Nenhum registro na auditoria para esta NF. (Alterações feitas antes da auditoria existir não aparecem.)</p>
          : (
            <ol className="hist__lista">
              {logs.map((l) => {
                const Ic = ICONE[l.acao] ?? Pencil;
                return (
                  <li key={l.id} className={`hist__item hist__item--${String(l.acao).toLowerCase()}`}>
                    <span className="hist__ic"><Ic size={14} /></span>
                    <div>
                      <div className="hist__meta">
                        <span className="avatar hist__av">{iniciais(nome(l.usuario_email))}</span>
                        <strong>{nome(l.usuario_email)}</strong>
                        <span className="muted">{formatDateTimeBR(l.criado_em)}</span>
                      </div>
                      <p>{l.detalhes}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
      </div>
    </Modal>
  );
}
