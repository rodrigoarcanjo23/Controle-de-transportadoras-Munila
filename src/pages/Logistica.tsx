import { useMemo, useState } from 'react';
import { CircleCheck, Clock, Download, Map, Package, TriangleAlert, Truck } from 'lucide-react';
import { useAppData } from '../state/context';
import { useFeedback } from '../feedback/context';
import { SLA_ALERTA_DIAS, SLA_CRITICO_DIAS, type Tone } from '../lib/constants';
import { diffDias, diasDesde, formatDate, formatMoney, matchesSearch, toNumber } from '../lib/format';
import { cidadeDestino, ufDestino } from '../lib/filtrosEntrega';
import { downloadCsv } from '../lib/csv';
import { Badge, KpiCard, PageHeader, SearchInput, StatusBadge } from '../components/ui/basics';
import { DataTable, type Column } from '../components/ui/DataTable';
import type { Entrega } from '../types';

type Tipo = 'concluido' | 'critico' | 'alerta' | 'normal' | 'sem_data';
interface Linha extends Entrega { sla: { dias: number | null; tipo: Tipo } }

function calcularSLA(e: Entrega): Linha['sla'] {
  if (!e.data_faturamento) return { dias: null, tipo: 'sem_data' };
  if (e.status === 'Entregue' && e.data_entrega_agendamento) {
    return { dias: diffDias(e.data_faturamento, e.data_entrega_agendamento), tipo: 'concluido' };
  }
  const d = diasDesde(e.data_faturamento) ?? 0;
  return { dias: d, tipo: d > SLA_CRITICO_DIAS ? 'critico' : d > SLA_ALERTA_DIAS ? 'alerta' : 'normal' };
}

const SLA_UI: Record<Tipo, { tone: Tone; icon: typeof Truck; label: (d: number | null) => string }> = {
  concluido: { tone: 'green', icon: CircleCheck, label: (d) => `${d} dias totais` },
  critico: { tone: 'red', icon: TriangleAlert, label: (d) => `${d} dias rodando` },
  alerta: { tone: 'amber', icon: Clock, label: (d) => `${d} dias rodando` },
  normal: { tone: 'slate', icon: Truck, label: (d) => `${d} dias rodando` },
  sem_data: { tone: 'slate', icon: Package, label: () => '-' },
};

export default function Logistica() {
  const { entregas, loading } = useAppData();
  const { toast } = useFeedback();
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState<Tipo | ''>('');

  const linhas = useMemo<Linha[]>(() => entregas
    .map((e) => ({ ...e, sla: calcularSLA(e) }))
    .sort((a, b) => {
      if (a.sla.dias === null) return 1;
      if (b.sla.dias === null) return -1;
      if (a.status !== 'Entregue' && b.status === 'Entregue') return -1;
      if (a.status === 'Entregue' && b.status !== 'Entregue') return 1;
      return (b.sla.dias ?? 0) - (a.sla.dias ?? 0);
    }), [entregas]);

  const contagem = useMemo(() => {
    const c: Record<Tipo, number> = { concluido: 0, critico: 0, alerta: 0, normal: 0, sem_data: 0 };
    linhas.forEach((l) => { c[l.sla.tipo]++; });
    return c;
  }, [linhas]);

  const filtradas = useMemo(() => linhas.filter((e) =>
    matchesSearch(busca, e.clientes?.nome, e.nota_fiscal, e.status, cidadeDestino(e)) && (!tipo || e.sla.tipo === tipo)), [linhas, busca, tipo]);

  function exportar() {
    if (!filtradas.length) { toast({ kind: 'warning', title: 'Não há dados para exportar.' }); return; }
    downloadCsv('MunilaLog_SLA', ['Cliente', 'Destino', 'Nº NF', 'Valor NF', 'Data Fat.', 'Status', 'Dias', 'Situação SLA'],
      filtradas.map((e) => [e.clientes?.nome ?? '-', `${cidadeDestino(e)} - ${ufDestino(e)}`, e.nota_fiscal, String(toNumber(e.valor_nf)).replace('.', ','),
        formatDate(e.data_faturamento), e.status, e.sla.dias ?? '-', e.sla.tipo]));
  }

  const cols: Column<Linha>[] = [
    {
      key: 'cliente', header: 'Cliente / destino', mobile: 'subtitle', sortValue: (e) => e.clientes?.nome,
      render: (e) => (<div><div className="strong" style={{ color: 'var(--text)' }}>{e.clientes?.nome ?? '-'}</div><div className="muted" style={{ fontSize: '0.75rem' }}>{cidadeDestino(e)} - {ufDestino(e)}</div></div>),
    },
    { key: 'nf', header: 'Nº NF', render: (e) => <strong>NF {e.nota_fiscal}</strong>, mobile: 'title', sortValue: (e) => Number(e.nota_fiscal) || e.nota_fiscal },
    { key: 'valor', header: 'Valor NF', render: (e) => formatMoney(e.valor_nf), sortValue: (e) => toNumber(e.valor_nf), align: 'right', className: 'num strong text-green' },
    { key: 'fat', header: 'Data fat.', render: (e) => formatDate(e.data_faturamento), sortValue: (e) => e.data_faturamento },
    { key: 'status', header: 'Status operacional', render: (e) => <StatusBadge status={e.status} />, align: 'center', sortValue: (e) => e.status },
    {
      key: 'sla', header: 'Envelhecimento (SLA)', label: 'SLA', align: 'center', thClassName: 'hl-blue', mobile: 'badge', sortValue: (e) => e.sla.dias,
      render: (e) => { const u = SLA_UI[e.sla.tipo]; const I = u.icon; return <Badge tone={u.tone} square><I size={13} /> {u.label(e.sla.dias)}</Badge>; },
    },
  ];

  const filtroKpi = (t: Tipo) => () => setTipo((x) => (x === t ? '' : t));

  return (
    <div className="page">
      <PageHeader icon={<Map size={22} />} title="Central de Logística & SLA" subtitle={`Envelhecimento da carga desde o faturamento · alerta > ${SLA_ALERTA_DIAS} dias · crítico > ${SLA_CRITICO_DIAS} dias`}
        actions={<button className="btn btn-success-outline" onClick={exportar}><Download size={16} /> Exportar</button>} />

      <div className="kpi-grid">
        <KpiCard label="Críticas" value={contagem.critico} icon={<TriangleAlert size={16} />} tone="red" valueClass="text-red" onClick={filtroKpi('critico')} active={tipo === 'critico'} hint="Clique para filtrar" />
        <KpiCard label="Em alerta" value={contagem.alerta} icon={<Clock size={16} />} tone="amber" onClick={filtroKpi('alerta')} active={tipo === 'alerta'} hint="Clique para filtrar" />
        <KpiCard label="No prazo" value={contagem.normal} icon={<Truck size={16} />} tone="slate" onClick={filtroKpi('normal')} active={tipo === 'normal'} hint="Clique para filtrar" />
        <KpiCard label="Concluídas" value={contagem.concluido} icon={<CircleCheck size={16} />} tone="green" valueClass="text-green" onClick={filtroKpi('concluido')} active={tipo === 'concluido'} hint="Clique para filtrar" />
      </div>

      <div className="toolbar no-print">
        <SearchInput className="toolbar__search" value={busca} onChange={setBusca} placeholder="Buscar cliente, NF, cidade ou status…" />
        {tipo && <span className="chip chip--removable">SLA: {tipo.replace('_', ' ')} <button onClick={() => setTipo('')} aria-label="Remover filtro">×</button></span>}
      </div>

      <div className="card table-card">
        <DataTable rows={filtradas} columns={cols} rowKey={(e) => e.id} loading={loading} fill />
      </div>
    </div>
  );
}
