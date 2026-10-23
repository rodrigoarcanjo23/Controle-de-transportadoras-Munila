import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Award, Calendar, ChartPie, Clock, DollarSign, Download, MapPin, Percent, TrendingUp, Truck } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAppData } from '../state/context';
import { useFeedback } from '../feedback/context';
import { useChartTheme } from '../hooks/useChartTheme';
import { FILTROS_VAZIOS, ufDestino } from '../lib/filtrosEntrega';
import { GRUPO_CRITICO, GRUPO_EM_ANDAMENTO, REGIOES } from '../lib/constants';
import { diffDias, formatMoney, formatMoneyShort, formatPercent, percentual, toNumber } from '../lib/format';
import { EmptyState, KpiCard, PageHeader } from '../components/ui/basics';
import { PageLoader } from '../components/layout/PageLoader';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmtMes = (yyyyMM: string) => { const [a, m] = yyyyMM.split('-'); return `${MESES[parseInt(m) - 1]}/${a}`; };
/** Custo usado no BI: frete real quando > 0, senão o cotado (regra original do BI). */
const custoBI = (e: { valor_frete_real?: unknown; valor_frete?: unknown }) => {
  const real = toNumber(e.valor_frete_real as never);
  return real > 0 ? real : toNumber(e.valor_frete as never);
};

export default function Analise() {
  const { entregas, loading, setFiltros } = useAppData();
  const { toast } = useFeedback();
  const navigate = useNavigate();
  const c = useChartTheme();
  const painelRef = useRef<HTMLDivElement>(null);

  const [periodo, setPeriodo] = useState('tudo');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [mes, setMes] = useState('');
  const [regiao, setRegiao] = useState('');
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const meses = useMemo(() => {
    const s = new Set<string>();
    entregas.forEach((e) => { if (e.data_faturamento) s.add(e.data_faturamento.substring(0, 7)); });
    return Array.from(s).sort().reverse();
  }, [entregas]);

  const filtradas = useMemo(() => entregas.filter((e) => {
    if (!e.data_faturamento) return false;
    if (regiao && !REGIOES[regiao]?.includes(ufDestino(e))) return false;
    if (periodo === 'mes') return !mes || e.data_faturamento.substring(0, 7) === mes;
    if (periodo === 'personalizado') {
      if (dataInicio && e.data_faturamento < dataInicio) return false;
      if (dataFim && e.data_faturamento > dataFim) return false;
      return true;
    }
    if (periodo === 'tudo') return true;
    const d = new Date(e.data_faturamento + 'T12:00:00');
    const lim = new Date(); lim.setHours(0, 0, 0, 0);
    if (periodo === '30dias') lim.setDate(lim.getDate() - 30);
    if (periodo === '90dias') lim.setDate(lim.getDate() - 90);
    if (periodo === 'esteAno') lim.setMonth(0, 1);
    return d >= lim;
  }), [entregas, periodo, dataInicio, dataFim, mes, regiao]);

  const stats = useMemo(() => {
    const total = filtradas.length;
    if (!total) return null;
    const entregues = filtradas.filter((e) => e.status === 'Entregue').length;
    const atrasadas = filtradas.filter((e) => e.status === 'Atrasado').length;
    const emAndamento = filtradas.filter((e) => !['Entregue', 'Atrasado', 'Devolução', 'Recusa'].includes(e.status)).length;

    const transp: Record<string, { name: string; Quantidade: number; Custo: number; Faturamento: number }> = {};
    const cli: Record<string, { name: string; Valor: number; Notas: number }> = {};
    const tl: Record<string, { iso: string; name: string; Faturamento: number; Frete: number }> = {};
    const est: Record<string, { faturamento: number; custo: number }> = {};
    let fat = 0, custo = 0, gap = 0, nGap = 0;

    for (const e of filtradas) {
      const v = toNumber(e.valor_nf); const k = custoBI(e);
      fat += v; custo += k;
      const tn = e.transportadoras?.nome || 'Não informada';
      (transp[tn] ??= { name: tn, Quantidade: 0, Custo: 0, Faturamento: 0 });
      transp[tn].Quantidade++; transp[tn].Custo += k; transp[tn].Faturamento += v;
      const cn = e.clientes?.nome || 'Cliente desconhecido';
      (cli[cn] ??= { name: cn, Valor: 0, Notas: 0 });
      cli[cn].Valor += v; cli[cn].Notas++;
      const uf = ufDestino(e) || 'ND';
      (est[uf] ??= { faturamento: 0, custo: 0 });
      est[uf].faturamento += v; est[uf].custo += k;
      const iso = e.data_faturamento!;
      (tl[iso] ??= { iso, name: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`, Faturamento: 0, Frete: 0 });
      tl[iso].Faturamento += v; tl[iso].Frete += k;
      const g = diffDias(e.data_entrada_pedido, e.data_entrega_agendamento);
      if (g !== null) { gap += g; nGap++; }
    }

    return {
      total, entregues, atrasadas, emAndamento,
      percentEntregue: percentual(entregues, total),
      faturamento: fat, custo, freteMedio: percentual(custo, fat),
      topTransp: Object.values(transp).sort((a, b) => b.Custo - a.Custo).slice(0, 10),
      eficiencia: Object.values(transp).filter((t) => t.Faturamento > 0 && t.Custo > 0)
        .map((t) => ({ name: t.name, percentual: +((t.Custo / t.Faturamento) * 100).toFixed(2), custo: t.Custo, faturamento: t.Faturamento }))
        .sort((a, b) => a.percentual - b.percentual).slice(0, 10),
      topClientes: Object.values(cli).sort((a, b) => b.Valor - a.Valor).slice(0, 10),
      timeline: Object.values(tl).sort((a, b) => a.iso.localeCompare(b.iso)),
      porEstado: Object.entries(est).map(([uf, x]) => ({
        uf, faturamento: x.faturamento, custo: x.custo, percentual: +percentual(x.custo, x.faturamento).toFixed(2),
      })).sort((a, b) => b.faturamento - a.faturamento),
      mediaGap: nGap ? (gap / nGap).toFixed(1).replace('.', ',') : '-',
    };
  }, [filtradas]);

  const abrirNoPainel = (status: string[]) => {
    setFiltros({ ...FILTROS_VAZIOS, status });
    navigate('/dashboard');
  };

  async function exportarPDF() {
    if (!painelRef.current) return;
    setGerandoPdf(true);
    try {
      // bibliotecas pesadas carregadas apenas quando necessárias
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
      const canvas = await html2canvas(painelRef.current, { scale: 2, useCORS: true, backgroundColor: c.bg });
      const w = 210; const h = (canvas.height * w) / canvas.width;
      const pdf = new jsPDF('p', 'mm', [w, h]);
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
      pdf.save(`Relatorio_BI_${regiao || 'Geral'}_MunilaLog.pdf`);
      toast({ kind: 'success', title: 'PDF gerado' });
    } catch (err) {
      console.error(err);
      toast({ kind: 'error', title: 'Não foi possível gerar o PDF', text: 'Tente novamente.' });
    } finally {
      setGerandoPdf(false);
    }
  }

  if (loading && !entregas.length) return <PageLoader />;

  const axisTick = { fill: c.axis, fontSize: 11 };
  const barList = (data: object[], key: string, color: string, fmt: (v: number, p: Record<string, number>) => [string, string]) => (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={c.grid} />
        <XAxis type="number" hide />
        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={axisTick} width={130}
          tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 17) + '…' : v)} />
        <Tooltip contentStyle={c.tooltip} cursor={{ fill: c.cursor }}
          formatter={(v, _n, p) => fmt(Number(v), (p as { payload: Record<string, number> }).payload)} />
        <Bar isAnimationActive={false} dataKey={key} fill={color} radius={[0, 5, 5, 0]} barSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <div className="page">
      <PageHeader icon={<ChartPie size={22} />} title="Painel de Inteligência" subtitle="Análise executiva da operação logística"
        actions={
          <button className="btn btn-primary" onClick={exportarPDF} disabled={gerandoPdf || !stats}>
            <Download size={16} /> {gerandoPdf ? 'Gerando PDF…' : 'Exportar PDF'}
          </button>
        } />

      <div className="card card-pad no-print" style={{ padding: 14 }}>
        <div className="form-grid form-grid--auto" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', alignItems: 'end' }}>
          <div className="field">
            <label><MapPin size={14} /> Região</label>
            <select className="select" value={regiao} onChange={(e) => setRegiao(e.target.value)}>
              <option value="">Todas (Brasil)</option>
              {Object.keys(REGIOES).map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="field">
            <label><Calendar size={14} /> Período</label>
            <select className="select" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
              <option value="tudo">Todo o histórico</option>
              <option value="30dias">Últimos 30 dias</option>
              <option value="90dias">Últimos 3 meses</option>
              <option value="esteAno">Este ano</option>
              <option value="mes">Mês específico…</option>
              <option value="personalizado">Personalizado…</option>
            </select>
          </div>
          {periodo === 'mes' && (
            <div className="field">
              <label>Mês</label>
              <select className="select" value={mes} onChange={(e) => setMes(e.target.value)}>
                <option value="">Selecione o mês…</option>
                {meses.map((m) => <option key={m} value={m}>{fmtMes(m)}</option>)}
              </select>
            </div>
          )}
          {periodo === 'personalizado' && (
            <>
              <div className="field"><label>De</label><input type="date" className="input" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} /></div>
              <div className="field"><label>Até</label><input type="date" className="input" value={dataFim} onChange={(e) => setDataFim(e.target.value)} /></div>
            </>
          )}
        </div>
      </div>

      {!stats ? (
        <div className="card"><EmptyState title="Sem dados para este filtro" text="Nenhum dado financeiro ou de entrega encontrado para o período/região selecionados." /></div>
      ) : (
        <div ref={painelRef} style={{ display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--bg)' }}>
          <div className="kpi-grid">
            <KpiCard label="Faturamento (período)" value={formatMoney(stats.faturamento)} hint={`${stats.total.toLocaleString('pt-BR')} notas`} icon={<DollarSign size={16} />} tone="blue" />
            <KpiCard label="Custo logístico" value={formatMoney(stats.custo)} valueClass="text-orange" icon={<Truck size={16} />} tone="orange" />
            <KpiCard label="Impacto frete médio" value={formatPercent(stats.freteMedio)} valueClass="text-brand" icon={<Percent size={16} />} tone="brand" />
            <KpiCard label="Taxa de sucesso" value={formatPercent(stats.percentEntregue, 1)} valueClass="text-green" icon={<Award size={16} />} tone="green" accent="var(--green-solid)" hint={`${stats.entregues} entregues`} />
          </div>

          <div className="card chart-card">
            <h3><TrendingUp size={18} color={c.purple} /> Evolução faturamento × frete</h3>
            <div className="chart-scroll">
              <div style={{ minWidth: Math.max(640, stats.timeline.length * 40), height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.timeline} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gFat" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={c.blue} stopOpacity={0.3} /><stop offset="95%" stopColor={c.blue} stopOpacity={0} /></linearGradient>
                      <linearGradient id="gFrete" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={c.orange} stopOpacity={0.3} /><stop offset="95%" stopColor={c.orange} stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.grid} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axisTick} dy={8} minTickGap={24} />
                    <YAxis yAxisId="l" axisLine={false} tickLine={false} tick={axisTick} tickFormatter={formatMoneyShort} width={64} />
                    <YAxis yAxisId="r" orientation="right" axisLine={false} tickLine={false} tick={axisTick} tickFormatter={formatMoneyShort} width={64} />
                    <Tooltip contentStyle={c.tooltip} formatter={(v, n) => [formatMoney(Number(v)), n]} />
                    <Legend verticalAlign="top" height={32} iconType="circle" />
                    <Area isAnimationActive={false} yAxisId="l" type="linear" dataKey="Faturamento" stroke={c.blue} strokeWidth={2.5} fill="url(#gFat)" dot={false} activeDot={{ r: 5 }} />
                    <Area isAnimationActive={false} yAxisId="r" type="linear" dataKey="Frete" stroke={c.orange} strokeWidth={2.5} fill="url(#gFrete)" dot={false} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="chart-grid">
            <div className="card chart-card" style={{ height: 420 }}>
              <h3><DollarSign size={18} color={c.green} /> Top 10 clientes (receita)</h3>
              <div style={{ flex: 1, minHeight: 0 }}>{barList(stats.topClientes, 'Valor', c.green, (v) => [formatMoney(v), 'Faturamento'])}</div>
            </div>
            <div className="card chart-card" style={{ height: 420 }}>
              <h3><Truck size={18} color={c.purple} /> Top 10 transportadoras (custo)</h3>
              <div style={{ flex: 1, minHeight: 0 }}>{barList(stats.topTransp, 'Custo', c.purple, (v) => [formatMoney(v), 'Custo logístico'])}</div>
            </div>
            <div className="card chart-card" style={{ height: 420 }}>
              <h3><Award size={18} color={c.amber} /> Transportadoras mais eficientes</h3>
              <div style={{ flex: 1, minHeight: 0 }}>{barList(stats.eficiencia, 'percentual', c.amber,
                (v, p) => [`${formatPercent(v)} (Frete ${formatMoney(p.custo)} · NF ${formatMoney(p.faturamento)})`, 'Custo-benefício'])}</div>
            </div>
          </div>

          {!regiao && (
            <div className="card chart-card">
              <h3><Percent size={18} color={c.red} /> Receita × custo logístico por estado</h3>
              <p className="muted" style={{ marginTop: -6, marginBottom: 10, fontSize: '0.84rem' }}>Proporção do frete sobre o faturamento em cada UF de destino.</p>
              <div className="chart-scroll">
                <div style={{ minWidth: Math.max(640, stats.porEstado.length * 56), height: 340 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={stats.porEstado} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.grid} />
                      <XAxis dataKey="uf" axisLine={false} tickLine={false} tick={{ ...axisTick, fontWeight: 700 }} dy={8} />
                      <YAxis yAxisId="l" axisLine={false} tickLine={false} tick={axisTick} tickFormatter={formatMoneyShort} width={64} />
                      <YAxis yAxisId="r" orientation="right" axisLine={false} tickLine={false} tick={{ ...axisTick, fill: c.red }} tickFormatter={(v) => `${v}%`} width={44} />
                      <Tooltip contentStyle={c.tooltip} cursor={{ fill: c.cursor }}
                        formatter={(v, n) => (n === '% do frete' ? [formatPercent(Number(v)), n] : [formatMoney(Number(v)), n])} />
                      <Legend verticalAlign="top" height={32} iconType="circle" />
                      <Bar isAnimationActive={false} yAxisId="l" dataKey="faturamento" name="Faturamento" fill={c.blue} radius={[4, 4, 0, 0]} maxBarSize={36} />
                      <Bar isAnimationActive={false} yAxisId="l" dataKey="custo" name="Custo frete" fill={c.amber} radius={[4, 4, 0, 0]} maxBarSize={36} />
                      <Line isAnimationActive={false} yAxisId="r" type="monotone" dataKey="percentual" name="% do frete" stroke={c.red} strokeWidth={2.5} dot={{ r: 4, fill: c.red }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          <div className="chart-grid">
            <div className="card card-pad">
              <h3 className="card-title" style={{ marginBottom: 14 }}><Activity size={18} color={c.amber} /> Resumo de operação</h3>
              <div className="stat-list">
                <button className="stat-row" onClick={() => abrirNoPainel(['Entregue'])} title="Ver no Painel de Entregas">
                  <span>Entregues</span><strong className="text-green">{stats.entregues}</strong>
                </button>
                <button className="stat-row" onClick={() => abrirNoPainel(GRUPO_EM_ANDAMENTO)} title="Ver no Painel de Entregas">
                  <span>Em trânsito / processo</span><strong className="text-orange">{stats.emAndamento}</strong>
                </button>
                <button className="stat-row stat-row--danger" onClick={() => abrirNoPainel(GRUPO_CRITICO)} title="Ver no Painel de Entregas">
                  <span>Atrasadas ou críticas</span><strong>{stats.atrasadas}</strong>
                </button>
              </div>
              <p className="muted" style={{ fontSize: '0.75rem', marginTop: 10 }}>Clique em uma linha para abrir as NFs no Painel de Entregas.</p>
            </div>
            <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 6 }}>
              <Clock size={34} color={c.blue} />
              <div className="kpi__label">Lead time total (SLA médio)</div>
              <div style={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '-0.03em' }} className="num">{stats.mediaGap}<small style={{ fontSize: '1rem', color: 'var(--muted)', marginLeft: 6 }}>dias</small></div>
              <p className="muted" style={{ fontSize: '0.85rem' }}>Do pedido até a entrega no cliente.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
