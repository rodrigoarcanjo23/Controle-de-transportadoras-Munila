import { useCallback, useEffect, useState } from 'react';
import { Eraser, RotateCw, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { mensagemErro } from '../lib/db';
import { MODULOS_LOG } from '../lib/constants';
import { formatDateTimeBR, matchesSearch } from '../lib/format';
import { useFeedback } from '../feedback/context';
import { Badge, FilterCard, Field, PageHeader, SearchInput } from '../components/ui/basics';
import { DataTable, type Column } from '../components/ui/DataTable';
import type { LogAuditoria } from '../types';

const POR_PAGINA = 30;

export default function Auditoria() {
  const { toast } = useFeedback();
  const [logs, setLogs] = useState<LogAuditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMais, setLoadingMais] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [temMais, setTemMais] = useState(true);
  const [busca, setBusca] = useState('');
  const [modulo, setModulo] = useState('');
  const [acao, setAcao] = useState('');

  const buscar = useCallback(async (pag: number, reset: boolean) => {
    try {
      let q = supabase.from('logs_auditoria').select('*');
      if (acao) q = q.eq('acao', acao);
      if (modulo) q = q.eq('modulo', modulo);
      const from = (pag - 1) * POR_PAGINA;
      const { data, error } = await q.order('criado_em', { ascending: false }).range(from, from + POR_PAGINA - 1);
      if (error) throw error;
      const rows = data ?? [];
      setLogs((prev) => (reset ? rows : [...prev, ...rows]));
      setTemMais(rows.length === POR_PAGINA);
    } catch (err) {
      toast({ kind: 'error', title: 'Erro ao buscar registros', text: mensagemErro(err) });
    } finally { setLoading(false); setLoadingMais(false); }
  }, [acao, modulo, toast]);

  // busca assíncrona: os setState acontecem depois do await (falso positivo da regra)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { buscar(1, true); }, [buscar]);

  const carregarMais = () => { const p = pagina + 1; setPagina(p); setLoadingMais(true); buscar(p, false); };
  const recarregar = () => { setPagina(1); setLoading(true); buscar(1, true); };
  /** troca de filtro: volta para a página 1 (o efeito acima busca de novo) */
  const filtrar = (fn: () => void) => { fn(); setPagina(1); setLoading(true); };
  const filtrados = logs.filter((l) => matchesSearch(busca, l.usuario_email, l.detalhes));

  const cols: Column<LogAuditoria>[] = [
    { key: 'data', header: 'Data e hora', render: (l) => formatDateTimeBR(l.criado_em), className: 'num', mobile: 'subtitle' },
    { key: 'user', header: 'Usuário', render: (l) => l.usuario_email, className: 'strong', mobile: 'title' },
    { key: 'acao', header: 'Ação', render: (l) => <Badge square>{l.acao}</Badge>, mobile: 'badge' },
    { key: 'mod', header: 'Módulo', render: (l) => <span className="strong text-brand">{MODULOS_LOG.find((m) => m.value === l.modulo)?.label ?? l.modulo}</span> },
    { key: 'det', header: 'Detalhes da alteração', render: (l) => l.detalhes, className: 'wrap', mobile: 'full' },
  ];

  return (
    <div className="page">
      <PageHeader icon={<ShieldAlert size={22} />} title="Auditoria do Sistema" subtitle="Ações e alterações realizadas pelos usuários (horário de Brasília)"
        actions={<button className="btn" onClick={recarregar}><RotateCw size={16} className={loading ? 'spin' : ''} /> Atualizar</button>} />

      <FilterCard ativos={[busca, modulo, acao].filter(Boolean).length} minCol={190}>
          <Field label="Buscar (e-mail ou detalhes)" className="span-2"><SearchInput value={busca} onChange={setBusca} placeholder="Pesquisar nos registros carregados…" /></Field>
          <Field label="Módulo">
            <select className="select" value={modulo} onChange={(e) => filtrar(() => setModulo(e.target.value))}>
              <option value="">Todos os módulos</option>
              {MODULOS_LOG.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Field>
          <Field label="Ação">
            <select className="select" value={acao} onChange={(e) => filtrar(() => setAcao(e.target.value))}>
              <option value="">Todas as ações</option>
              <option value="CRIOU">Criou</option><option value="EDITOU">Editou</option><option value="APAGOU">Apagou</option>
            </select>
          </Field>
          {(busca || modulo || acao) && <button className="btn btn-danger-outline" onClick={() => { setBusca(''); if (modulo || acao) filtrar(() => { setModulo(''); setAcao(''); }); }}><Eraser size={16} /> Limpar</button>}
      </FilterCard>

      <div className="card table-card">
        <DataTable rows={filtrados} columns={cols} rowKey={(l) => l.id} loading={loading} pageSize={1000} />
        {!loading && temMais && logs.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 14, borderTop: '1px solid var(--border)' }}>
            <button className="btn" onClick={carregarMais} disabled={loadingMais}>
              <RotateCw size={16} className={loadingMais ? 'spin' : ''} /> {loadingMais ? 'Carregando…' : 'Carregar registros mais antigos'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
