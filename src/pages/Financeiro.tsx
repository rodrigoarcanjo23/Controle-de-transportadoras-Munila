import { useMemo, useState } from 'react';
import { DollarSign, Download, Percent, TrendingDown, TrendingUp, Truck } from 'lucide-react';
import { useAppData } from '../state/context';
import { useFeedback } from '../feedback/context';
import { formatMoney, formatPercent, hasValue, matchesSearch, percentual, toNumber } from '../lib/format';
import { downloadCsv, csvNum } from '../lib/csv';
import { Badge, KpiCard, PageHeader, SearchInput } from '../components/ui/basics';
import { DataTable, type Column } from '../components/ui/DataTable';
import type { Entrega } from '../types';

const impacto = (e: Entrega) => {
  const real = toNumber(e.valor_frete_real);
  return percentual(real > 0 ? real : toNumber(e.valor_frete), toNumber(e.valor_nf));
};

export default function Financeiro() {
  const { entregas, loading } = useAppData();
  const { toast } = useFeedback();
  const [busca, setBusca] = useState('');
  const [soPendentes, setSoPendentes] = useState(false);

  const filtradas = useMemo(() => entregas.filter((e) =>
    matchesSearch(busca, e.clientes?.nome, e.nota_fiscal) && (!soPendentes || !hasValue(e.valor_frete_real))), [entregas, busca, soPendentes]);

  const t = useMemo(() => {
    let fat = 0, real = 0, cot = 0;
    filtradas.forEach((e) => { fat += toNumber(e.valor_nf); real += toNumber(e.valor_frete_real); cot += toNumber(e.valor_frete); });
    return { fat, real, cot, impacto: percentual(real, fat), desvio: cot - real };
  }, [filtradas]);

  const pendentesReal = useMemo(() => entregas.filter((e) => !hasValue(e.valor_frete_real)).length, [entregas]);

  function exportar() {
    if (!filtradas.length) { toast({ kind: 'warning', title: 'Não há dados para exportar.' }); return; }
    downloadCsv('MunilaLog_Financeiro',
      ['Cliente', 'Nº NF', 'Valor NF (R$)', 'Frete Cotado (R$)', 'Frete Real (R$)', 'Impacto %', 'Desvio (R$)'],
      filtradas.map((e) => [e.clientes?.nome ?? '-', e.nota_fiscal, csvNum(e.valor_nf), csvNum(e.valor_frete), csvNum(e.valor_frete_real, '-'),
        formatPercent(impacto(e)), hasValue(e.valor_frete_real) ? csvNum((toNumber(e.valor_frete) - toNumber(e.valor_frete_real)).toFixed(2)) : '-']));
  }

  const cols: Column<Entrega>[] = [
    { key: 'nf', header: 'Nº NF', render: (e) => <strong>NF {e.nota_fiscal}</strong>, sortValue: (e) => Number(e.nota_fiscal) || e.nota_fiscal, mobile: 'title' },
    { key: 'cliente', header: 'Cliente', render: (e) => e.clientes?.nome ?? '-', sortValue: (e) => e.clientes?.nome, mobile: 'subtitle', className: 'strong' },
    { key: 'nfv', header: 'Valor NF', render: (e) => formatMoney(e.valor_nf), sortValue: (e) => toNumber(e.valor_nf), align: 'right', className: 'num strong' },
    { key: 'cot', header: 'Frete cotado', render: (e) => <span className="muted">{formatMoney(e.valor_frete)}</span>, sortValue: (e) => toNumber(e.valor_frete), align: 'right', className: 'num' },
    { key: 'real', header: 'Frete real', render: (e) => (hasValue(e.valor_frete_real) ? formatMoney(e.valor_frete_real) : '-'), sortValue: (e) => toNumber(e.valor_frete_real), align: 'right', className: 'num strong text-orange' },
    { key: 'imp', header: 'Impacto %', render: (e) => formatPercent(impacto(e)), sortValue: impacto, align: 'center', className: 'num strong text-brand' },
    {
      key: 'desvio', header: 'Lucro/prejuízo frete', label: 'Desvio', align: 'center', mobile: 'badge',
      sortValue: (e) => (hasValue(e.valor_frete_real) ? toNumber(e.valor_frete) - toNumber(e.valor_frete_real) : null),
      render: (e) => {
        if (!hasValue(e.valor_frete_real)) return <Badge tone="slate">Aguardando real</Badge>;
        const d = toNumber(e.valor_frete) - toNumber(e.valor_frete_real);
        return <Badge tone={d >= 0 ? 'green' : 'red'}>{d >= 0 ? '+' : '−'} {formatMoney(Math.abs(d))}</Badge>;
      },
    },
  ];

  return (
    <div className="page">
      <PageHeader icon={<DollarSign size={22} />} title="Gestão Financeira" subtitle="Custos de frete, desvios de cotação e impacto sobre a receita"
        actions={<button className="btn btn-success-outline" onClick={exportar}><Download size={16} /> Exportar</button>} />

      <div className="kpi-grid">
        <KpiCard label="Faturamento auditado" value={formatMoney(t.fat)} icon={<DollarSign size={16} />} tone="blue" />
        <KpiCard label="Custo frete (real)" value={formatMoney(t.real)} valueClass="text-orange" icon={<Truck size={16} />} tone="orange" />
        <KpiCard label="Impacto frete / receita" value={formatPercent(t.impacto)} valueClass="text-brand" icon={<Percent size={16} />} tone="brand" />
        <KpiCard label="Desvio (cotado × real)" value={`${t.desvio >= 0 ? '+' : '−'} ${formatMoney(Math.abs(t.desvio))}`}
          valueClass={t.desvio >= 0 ? 'text-green' : 'text-red'} icon={t.desvio >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          tone={t.desvio >= 0 ? 'green' : 'red'} accent={t.desvio >= 0 ? 'var(--green-solid)' : 'var(--red-solid)'}
          hint={t.desvio >= 0 ? 'Economia em relação ao cotado' : 'Gasto acima do cotado'} />
      </div>

      <div className="toolbar no-print">
        <SearchInput className="toolbar__search" value={busca} onChange={setBusca} placeholder="Buscar cliente ou NF…" />
        <button className={`chip ${soPendentes ? 'chip--on' : ''}`} onClick={() => setSoPendentes((v) => !v)} aria-pressed={soPendentes}>
          Só aguardando frete real ({pendentesReal})
        </button>
      </div>

      <div className="card table-card">
        <DataTable rows={filtradas} columns={cols} rowKey={(e) => e.id} loading={loading} fill />
      </div>
    </div>
  );
}
