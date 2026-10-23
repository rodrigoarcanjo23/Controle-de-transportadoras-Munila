import { useMemo, useRef, useState } from 'react';
import {
  ArrowRightLeft, ChartColumn, Columns3, Copy, Download, FileText, Hash, Package, Pencil, Plus, RotateCw,
  Rows3, Scale, SlidersHorizontal, Target, Trash2, LayoutDashboard, SearchX,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { registrarLog, mensagemErro } from '../lib/db';
import { STATUS_ENTREGA, toneOf } from '../lib/constants';
import {
  diffDias, fmtDias, formatDate, formatDecimal, formatInt, formatMoney, formatPercent, freteEfetivo,
  hasValue, percentFreteEntrega, percentual, toNumber,
} from '../lib/format';
import { FILTROS_VAZIOS, cidadeDestino, filtrarEntregas, filtrosAtivos, modalDe, ufDestino } from '../lib/filtrosEntrega';
import { downloadCsv, csvNum } from '../lib/csv';
import { loadPrefRaw, savePref } from '../lib/storage';
import { useAppData } from '../state/context';
import { useFeedback } from '../feedback/context';
import { useHotkey } from '../hooks/useHotkey';
import { Badge, EmptyState, KpiCard, PageHeader, SearchInput, StatusBadge } from '../components/ui/basics';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Dropdown } from '../components/ui/Dropdown';
import { ModalEntrega } from '../modals/ModalEntrega';
import { FiltrosPanel } from './dashboard/FiltrosPanel';
import type { Entrega } from '../types';

const OCULTAS_PADRAO: string[] = [];

export default function Dashboard() {
  const { entregas, transportadoras, loading, isAdmin, filtros, setFiltros, setEntregas, recarregarEntregas, atualizadoEm } = useAppData();
  const { toast, confirm } = useFeedback();
  const buscaRef = useRef<HTMLInputElement>(null);

  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [modal, setModal] = useState<{ entrega?: Entrega; modelo?: Partial<Entrega> } | null>(null);
  const [ocultas, setOcultas] = useState<string[]>(() => loadPrefRaw('colunasOcultas', OCULTAS_PADRAO));
  const [compacto, setCompacto] = useState<boolean>(() => loadPrefRaw('tabelaCompacta', false));
  const [verKpis, setVerKpis] = useState<boolean>(() => loadPrefRaw('verIndicadores', true));
  const [atualizando, setAtualizando] = useState(false);

  useHotkey('/', () => buscaRef.current?.focus());
  useHotkey('n', () => setModal({}), isAdmin);

  const filtradas = useMemo(() => filtrarEntregas(entregas, filtros), [entregas, filtros]);
  const chips = filtrosAtivos(filtros, transportadoras);

  const kpis = useMemo(() => {
    let nf = 0, cot = 0, real = 0, efetivo = 0, vol = 0, peso = 0;
    for (const e of filtradas) {
      nf += toNumber(e.valor_nf); cot += toNumber(e.valor_frete); real += toNumber(e.valor_frete_real);
      efetivo += freteEfetivo(e); vol += toNumber(e.volume); peso += toNumber(e.peso_kg);
    }
    return { nf, cot, real, medio: percentual(efetivo, nf), vol, peso };
  }, [filtradas]);

  const toggleColuna = (key: string) => {
    const next = ocultas.includes(key) ? ocultas.filter((k) => k !== key) : [...ocultas, key];
    setOcultas(next); savePref('colunasOcultas', next);
  };

  async function excluir(e: Entrega) {
    if (!isAdmin) return;
    const ok = await confirm({ title: `Excluir a entrega NF ${e.nota_fiscal}?`, text: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', danger: true });
    if (!ok) return;
    const { error } = await supabase.from('entregas').delete().eq('id', e.id);
    if (error) { toast({ kind: 'error', title: 'Não foi possível excluir', text: mensagemErro(error) }); return; }
    setEntregas((l) => l.filter((x) => x.id !== e.id));
    await registrarLog('APAGOU', 'ENTREGAS', `Apagou a Entrega com Nota Fiscal: ${e.nota_fiscal}`);
    toast({ kind: 'success', title: `Entrega NF ${e.nota_fiscal} excluída` });
  }

  /** Troca rápida de status direto na tabela. */
  async function mudarStatus(e: Entrega, status: string) {
    const anterior = e.status;
    setEntregas((l) => l.map((x) => (x.id === e.id ? { ...x, status } : x)));
    const { error } = await supabase.from('entregas').update({ status }).eq('id', e.id);
    if (error) {
      setEntregas((l) => l.map((x) => (x.id === e.id ? { ...x, status: anterior } : x)));
      toast({ kind: 'error', title: 'Status não alterado', text: mensagemErro(error) });
      return;
    }
    await registrarLog('EDITOU', 'ENTREGAS', `Alterou o status da NF ${e.nota_fiscal}: ${anterior} → ${status}`);
    toast({ kind: 'success', title: `NF ${e.nota_fiscal}: ${status}` });
  }

  function duplicar(e: Entrega) {
    const { id: _id, nota_fiscal: _nf, created_at: _c, clientes: _cl, transportadoras: _t, ...resto } = e;
    void _id; void _nf; void _c; void _cl; void _t;
    setModal({ modelo: { ...resto, valor_frete_real: null, frete_confirmado: false, data_entrega_agendamento: null, data_coleta: null, status: 'Pendente' } });
  }

  async function atualizar() {
    setAtualizando(true);
    await recarregarEntregas();
    setAtualizando(false);
    toast({ kind: 'success', title: 'Dados atualizados' });
  }

  function exportar() {
    if (!filtradas.length) { toast({ kind: 'warning', title: 'Não há dados para exportar.' }); return; }
    const cab = ['Entrada Pedido', 'Data Fat.', 'Coleta', 'Cliente', 'Cidade', 'UF', 'Volume (Cx)', 'Peso (Kg)', 'Nº NF', 'Valor NF',
      'Transportadora', 'Modal', 'Frete Cotado (R$)', 'Frete Real (R$)', '% Frete Real', 'Agendamento', 'Previsão', 'Dt Entrega',
      'Dias Pedido -> Fat', 'Dias Pedido -> Coleta', 'Dias Coleta -> Entrega', 'GAP Total (Dias)', 'Status', 'Frete Confirmado', 'Observações'];
    const linhas = filtradas.map((e) => {
      const gap = diffDias(e.data_entrada_pedido, e.data_entrega_agendamento);
      return [
        formatDate(e.data_entrada_pedido), formatDate(e.data_faturamento), formatDate(e.data_coleta), e.clientes?.nome || '-',
        cidadeDestino(e) || '-', ufDestino(e) || '-', e.volume || e.volume_peso || '-', csvNum(e.peso_kg, '-'), e.nota_fiscal,
        csvNum(e.valor_nf), e.transportadoras?.nome || '-', modalDe(e) || '-', csvNum(e.valor_frete), csvNum(e.valor_frete_real),
        formatPercent(percentFreteEntrega(e)), e.tem_agendamento ? 'SIM' : 'NÃO', formatDate(e.data_previsao), formatDate(e.data_entrega_agendamento),
        diffDias(e.data_entrada_pedido, e.data_faturamento) ?? '-', diffDias(e.data_entrada_pedido, e.data_coleta) ?? '-',
        diffDias(e.data_coleta, e.data_entrega_agendamento) ?? '-', gap === null ? '-' : Math.abs(gap),
        e.status, e.frete_confirmado ? 'SIM' : 'NÃO', e.observacoes || '-',
      ];
    });
    downloadCsv('MunilaLog_Exportacao', cab, linhas);
    toast({ kind: 'success', title: `${linhas.length} entregas exportadas` });
  }

  const colunas: Column<Entrega>[] = [
    {
      // coluna fixa à esquerda: mantém a referência (NF + cliente) enquanto rola para o lado
      key: 'nf', header: 'NF / Cliente', label: 'NF / Cliente', mobile: 'title', hideable: false,
      sortValue: (e) => Number(String(e.nota_fiscal).split(/\D/)[0]) || e.nota_fiscal,
      render: (e) => (
        <div className="cell-id">
          <span className="cell-id__nf">NF {e.nota_fiscal}</span>
          <span className="cell-id__sub" title={e.clientes?.nome ?? ''}>{e.clientes?.nome || '-'}</span>
        </div>
      ),
    },
    { key: 'entrada', header: 'Entrada pedido', label: 'Entrada pedido', render: (e) => formatDate(e.data_entrada_pedido), sortValue: (e) => e.data_entrada_pedido, className: 'hl-green strong', thClassName: 'hl-green' },
    { key: 'fat', header: 'Data fat.', label: 'Faturamento', render: (e) => formatDate(e.data_faturamento), sortValue: (e) => e.data_faturamento },
    { key: 'coleta', header: 'Coleta', render: (e) => formatDate(e.data_coleta), sortValue: (e) => e.data_coleta, mobile: 'hide' },
    { key: 'cidade', header: 'Cidade', render: (e) => cidadeDestino(e) || '-', sortValue: (e) => cidadeDestino(e), label: 'Destino' },
    { key: 'uf', header: 'UF', render: (e) => ufDestino(e) || '-', sortValue: (e) => ufDestino(e), className: 'strong' },
    { key: 'volume', header: 'Volume', render: (e) => (e.volume ? `${e.volume} cx` : '-'), sortValue: (e) => toNumber(e.volume), align: 'right', className: 'num', mobile: 'hide' },
    { key: 'peso', header: 'Peso (kg)', render: (e) => (e.peso_kg ? `${formatDecimal(e.peso_kg)} kg` : '-'), sortValue: (e) => toNumber(e.peso_kg), align: 'right', className: 'num', mobile: 'hide' },
    { key: 'valorNf', header: 'Valor NF', render: (e) => formatMoney(e.valor_nf), sortValue: (e) => toNumber(e.valor_nf), align: 'right', className: 'num' },
    { key: 'transp', header: 'Transportadora', render: (e) => e.transportadoras?.nome || '-', sortValue: (e) => e.transportadoras?.nome },
    { key: 'modal', header: 'Modal', render: (e) => modalDe(e) || '-', mobile: 'hide' },
    { key: 'cotado', header: 'Frete cotado', render: (e) => <span className="muted">{formatMoney(e.valor_frete)}</span>, sortValue: (e) => toNumber(e.valor_frete), align: 'right', className: 'num' },
    {
      key: 'real', header: 'Frete real', render: (e) => (hasValue(e.valor_frete_real) ? <>{formatMoney(e.valor_frete_real)}{e.frete_confirmado && ' ✓'}</> : '-'),
      sortValue: (e) => toNumber(e.valor_frete_real), align: 'right', className: (e) => (e.frete_confirmado ? 'num cell-ok' : 'num'), thClassName: 'hl-green',
    },
    {
      key: 'perc', header: '% Frete', render: (e) => formatPercent(percentFreteEntrega(e)), sortValue: (e) => percentFreteEntrega(e), align: 'right',
      className: (e) => (e.frete_confirmado ? 'num cell-ok' : 'num strong text-brand'),
    },
    { key: 'agend', header: 'Agendamento', label: 'Agendamento', render: (e) => (e.tem_agendamento ? <Badge tone="green" square>SIM</Badge> : <Badge tone="slate" square>NÃO</Badge>), align: 'center', mobile: 'hide' },
    { key: 'prev', header: 'Previsão', render: (e) => formatDate(e.data_previsao), sortValue: (e) => e.data_previsao },
    { key: 'entrega', header: 'Dt entrega', label: 'Entrega', render: (e) => formatDate(e.data_entrega_agendamento), sortValue: (e) => e.data_entrega_agendamento },
    { key: 'pedFat', header: 'Ped → Fat', title: 'Dias da entrada do pedido até o faturamento', render: (e) => fmtDias(diffDias(e.data_entrada_pedido, e.data_faturamento)), sortValue: (e) => diffDias(e.data_entrada_pedido, e.data_faturamento), align: 'center', className: 'hl-blue num', thClassName: 'hl-blue', mobile: 'hide' },
    { key: 'pedCol', header: 'Ped → Col', title: 'Dias da entrada do pedido até a coleta', render: (e) => fmtDias(diffDias(e.data_entrada_pedido, e.data_coleta)), sortValue: (e) => diffDias(e.data_entrada_pedido, e.data_coleta), align: 'center', className: 'hl-blue num', thClassName: 'hl-blue', mobile: 'hide' },
    { key: 'colEnt', header: 'Col → Ent', title: 'Dias da coleta até a entrega final', render: (e) => fmtDias(diffDias(e.data_coleta, e.data_entrega_agendamento)), sortValue: (e) => diffDias(e.data_coleta, e.data_entrega_agendamento), align: 'center', className: 'hl-blue num', thClassName: 'hl-blue', mobile: 'hide' },
    {
      key: 'gap', header: 'GAP total', label: 'GAP total', title: 'Tempo total da entrada do pedido até a entrega',
      render: (e) => { const d = diffDias(e.data_entrada_pedido, e.data_entrega_agendamento); return d === null ? '-' : `${Math.abs(d)} dias`; },
      sortValue: (e) => { const d = diffDias(e.data_entrada_pedido, e.data_entrega_agendamento); return d === null ? null : Math.abs(d); },
      align: 'center', className: 'hl-orange num', thClassName: 'hl-orange',
    },
    {
      key: 'status', header: 'Status', mobile: 'badge', hideable: false, sortValue: (e) => e.status,
      render: (e) => (isAdmin ? (
        <select className={`status-select tone-${toneOf(e.status)}`} value={e.status} onChange={(ev) => mudarStatus(e, ev.target.value)}
          onClick={(ev) => ev.stopPropagation()} title="Alterar status" aria-label={`Status da NF ${e.nota_fiscal}`}>
          {STATUS_ENTREGA.map((s) => <option key={s} value={s}>{s}</option>)}
          {!STATUS_ENTREGA.includes(e.status as never) && <option value={e.status}>{e.status}</option>}
        </select>
      ) : <StatusBadge status={e.status} />),
    },
    { key: 'obs', header: 'Observações', render: (e) => <span title={e.observacoes || ''}>{e.observacoes || '-'}</span>, className: 'ellipsis muted', mobile: 'full' },
  ];

  const hideable = colunas.filter((c) => c.hideable !== false);

  return (
    <div className="page page--fill">
      <PageHeader
        icon={<LayoutDashboard size={22} />}
        title="Acompanhamento Logístico"
        subtitle={atualizadoEm ? `Gerenciamento de entregas · atualizado às ${atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Gerenciamento de entregas'}
        actions={
          <>
            <button className="btn" onClick={atualizar} disabled={atualizando} title="Recarregar entregas">
              <RotateCw size={16} className={atualizando ? 'spin' : ''} /><span className="hide-mobile">Atualizar</span>
            </button>
            <button className="btn btn-success-outline" onClick={exportar}><Download size={16} /> Exportar</button>
            {isAdmin && (
              <button className="btn btn-primary" onClick={() => setModal({})} title="Nova entrega (atalho: N)">
                <Plus size={16} /> Nova entrega
              </button>
            )}
          </>
        }
      />

      <div className="toolbar no-print">
        <SearchInput className="toolbar__search" inputRef={buscaRef} value={filtros.busca} shortcut="/"
          onChange={(v) => setFiltros((f) => ({ ...f, busca: v }))} placeholder="Buscar NF, cliente, cidade, transportadora…" />
        <button className={`btn ${mostrarFiltros ? 'btn-primary' : ''}`} onClick={() => setMostrarFiltros((v) => !v)} aria-expanded={mostrarFiltros}>
          <SlidersHorizontal size={16} /> Filtros {chips.length > 0 && <span className="count" style={mostrarFiltros ? { background: '#fff', color: 'var(--brand)' } : undefined}>{chips.length}</span>}
        </button>
        <div className="toolbar__spacer hide-mobile" />
        <button className={`btn hide-mobile ${!verKpis ? 'btn-primary' : ''}`} onClick={() => { setVerKpis(!verKpis); savePref('verIndicadores', !verKpis); }}
          title={verKpis ? 'Ocultar os indicadores para ver mais linhas da tabela' : 'Mostrar os indicadores'}>
          <ChartColumn size={16} /> {verKpis ? 'Ocultar indicadores' : 'Mostrar indicadores'}
        </button>
        <button className="btn hide-mobile" onClick={() => { setCompacto(!compacto); savePref('tabelaCompacta', !compacto); }} title="Alternar densidade da tabela">
          <Rows3 size={16} /> {compacto ? 'Confortável' : 'Compacta'}
        </button>
        <Dropdown trigger={(open, toggle) => (
          <button className={`btn hide-mobile ${open ? 'btn-primary' : ''}`} onClick={toggle}><Columns3 size={16} /> Colunas{ocultas.length > 0 && <span className="count">{hideable.length - ocultas.length}</span>}</button>
        )}>
          <div className="dropdown__head">
            Colunas visíveis
            <button className="btn btn-sm btn-ghost" onClick={() => { setOcultas([]); savePref('colunasOcultas', []); }}>Mostrar todas</button>
          </div>
          {hideable.map((c) => (
            <label key={c.key} className="dropdown__item">
              <input type="checkbox" checked={!ocultas.includes(c.key)} onChange={() => toggleColuna(c.key)} />
              {c.label ?? c.header}
            </label>
          ))}
        </Dropdown>
      </div>

      {mostrarFiltros && <FiltrosPanel filtros={filtros} setFiltros={setFiltros} transportadoras={transportadoras} />}

      {chips.length > 0 && (
        <div className="chips no-print" aria-label="Filtros ativos">
          {chips.map((c) => (
            <span key={c.id} className="chip chip--removable">
              {c.label}
              <button onClick={() => setFiltros((f) => ({ ...f, ...c.clear }))} aria-label={`Remover filtro ${c.label}`}>×</button>
            </span>
          ))}
          <button className="chip" onClick={() => setFiltros((f) => ({ ...FILTROS_VAZIOS, busca: f.busca }))}>
            Limpar tudo
          </button>
        </div>
      )}

      {verKpis && <div className="kpi-grid">
        <KpiCard label="Número de carga" icon={<Hash size={16} />} tone="indigo" value={formatInt(filtradas.length)} unit=" NFs" hint="Notas encontradas" />
        <KpiCard label="Valor total NFs" icon={<FileText size={16} />} tone="blue" value={formatMoney(kpis.nf)} hint="Soma do período filtrado" />
        <KpiCard label="Comparativo frete" icon={<ArrowRightLeft size={16} />} tone="purple">
          <div className="kpi__rows">
            <div className="kpi__row"><span>Cotado</span><strong>{formatMoney(kpis.cot)}</strong></div>
            <div className="kpi__row"><span title="Frete real (CTE)">Real</span><strong className="text-green">{formatMoney(kpis.real)}</strong></div>
          </div>
        </KpiCard>
        <KpiCard label="% Frete médio" icon={<Target size={16} />} tone="brand" value={formatPercent(kpis.medio)} valueClass="text-brand" hint="Frete ÷ valor das NFs" />
        <KpiCard label="Volume total" icon={<Package size={16} />} tone="purple" value={formatInt(kpis.vol)} unit=" cx" />
        <KpiCard label="Peso total" icon={<Scale size={16} />} tone="amber" value={formatDecimal(kpis.peso)} unit=" kg" />
      </div>}

      <div className="card table-card">
        <DataTable
          rows={filtradas}
          columns={colunas}
          rowKey={(e) => e.id}
          hidden={ocultas}
          loading={loading}
          compact={compacto}
          fill
          minWidth={2000}
          stickyFirst
          navGroups={[
            { label: 'Datas do pedido', keys: ['entrada', 'fat', 'coleta'] },
            { label: 'Destino & carga', keys: ['cidade', 'uf', 'volume', 'peso'] },
            { label: 'Valores & frete', keys: ['valorNf', 'transp', 'modal', 'cotado', 'real', 'perc'] },
            { label: 'Prazos', keys: ['agend', 'prev', 'entrega', 'pedFat', 'pedCol', 'colEnt', 'gap'] },
            { label: 'Status & obs.', keys: ['status', 'obs'] },
          ]}
          onRowClick={isAdmin ? (e) => setModal({ entrega: e }) : undefined}
          empty={
            <EmptyState icon={<SearchX size={36} />} title="Nenhuma entrega encontrada"
              text={chips.length || filtros.busca ? 'Tente remover alguns filtros ou ajustar a busca.' : 'Cadastre a primeira entrega para começar.'}
              action={(chips.length > 0 || filtros.busca) ? <button className="btn" onClick={() => setFiltros(FILTROS_VAZIOS)}>Limpar busca e filtros</button> : undefined} />
          }
          actions={isAdmin ? (e) => (
            <>
              <button className="icon-btn icon-btn--sm" onClick={() => setModal({ entrega: e })} title="Editar (ou duplo clique na linha)"><Pencil size={16} /></button>
              <button className="icon-btn icon-btn--sm" onClick={() => duplicar(e)} title="Duplicar para nova NF"><Copy size={16} /></button>
              <button className="icon-btn icon-btn--sm icon-btn--danger" onClick={() => excluir(e)} title="Excluir"><Trash2 size={16} /></button>
            </>
          ) : undefined}
        />
      </div>

      {modal && <ModalEntrega entrega={modal.entrega} modelo={modal.modelo} onClose={() => setModal(null)} />}
    </div>
  );
}
