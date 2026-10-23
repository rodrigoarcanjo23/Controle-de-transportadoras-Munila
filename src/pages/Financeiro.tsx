import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, DollarSign, Download, Percent, PiggyBank, Receipt, Settings2, Truck, Wallet } from 'lucide-react';
import { useAppData } from '../state/context';
import { useFeedback } from '../feedback/context';
import { useChartTheme } from '../hooks/useChartTheme';
import { supabase } from '../lib/supabase';
import { fetchAll, mensagemErro, registrarLog } from '../lib/db';
import { downloadCsv, csvNum } from '../lib/csv';
import { dentro, fmtMes, resolverPeriodo, variacao, type PeriodoId } from '../lib/bi';
import { formatMoney, formatPercent, hojeISO, matchesSearch } from '../lib/format';
import {
  CONFIG_FIN_PADRAO, SITUACAO, analisarNFs, cteAberto, lerConfigFin, porCliente, porTransportadora, resumir, serieMensal,
  type ConfigFinanceiro, type Situacao,
} from '../lib/financeiro';
import { loadPrefRaw, savePref } from '../lib/storage';
import { PageHeader, SearchInput } from '../components/ui/basics';
import { Modal } from '../components/ui/Modal';
import { ModalHistorico } from '../modals/ModalHistorico';
import { KpiBI } from './bi/KpiBI';
import { moedaCompacta, num } from './bi/fmt';
import { Clientes, Conferencia, Transportadoras, VisaoGeral } from './financeiro/Abas';
import type { Cte, Entrega } from '../types';
import './bi/bi.css';
import './financeiro/financeiro.css';

type Aba = 'visao' | 'conferencia' | 'transportadoras' | 'clientes';
const ABAS: [Aba, string][] = [['visao', 'Visão geral'], ['conferencia', 'Conferência de frete'], ['transportadoras', 'Transportadoras'], ['clientes', 'Clientes']];

function ModalParametros({ cfg, onClose, onSalvar }: { cfg: ConfigFinanceiro; onClose: () => void; onSalvar: (c: ConfigFinanceiro) => Promise<void> }) {
  const [f, setF] = useState(cfg);
  const [salvando, setSalvando] = useState(false);
  const campo = (k: keyof ConfigFinanceiro, l: string, dica: string) => (
    <div className="field">
      <label>{l}</label>
      <input type="number" step="0.1" min={0} className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: Math.max(0, Number(e.target.value) || 0) })} />
      <small className="muted">{dica}</small>
    </div>
  );
  return (
    <Modal title="Parâmetros financeiros" subtitle="Valem para todos os usuários" onClose={onClose}
      onSubmit={async (e) => { e.preventDefault(); setSalvando(true); try { await onSalvar(f); onClose(); } finally { setSalvando(false); } }}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {campo('orcamento_pct', 'Orçamento de frete (% do faturamento)', 'Linha vermelha do gráfico e barra de orçamento do mês.')}
        {campo('limite_pct', 'NF fora do padrão acima de (% de frete)', 'Ex.: 15 = NFs com frete maior que 15% do valor da nota.')}
        {campo('margem_cotado_pct', 'Real acima do cotado em mais de (%)', 'NFs para cobrar/revisar com a transportadora.')}
      </div>
    </Modal>
  );
}

export default function Financeiro() {
  const { entregas, metas, transportadoras, loading, isAdmin } = useAppData();
  const { toast } = useFeedback();
  const navigate = useNavigate();
  const c = useChartTheme();

  const [aba, setAbaState] = useState<Aba>(() => loadPrefRaw<Aba>('financeiroAba', 'visao'));
  const setAba = (a: Aba) => { setAbaState(a); savePref('financeiroAba', a); };
  const [situacao, setSituacao] = useState<Situacao | 'todas'>('todas');
  const [periodo, setPeriodo] = useState<PeriodoId>('tudo');
  const [mes, setMes] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [transp, setTransp] = useState('');
  const [busca, setBusca] = useState('');
  const [historico, setHistorico] = useState<Entrega | null>(null);
  const [parametros, setParametros] = useState(false);
  const [cfg, setCfg] = useState<ConfigFinanceiro>(CONFIG_FIN_PADRAO);
  const [ctes, setCtes] = useState<Cte[]>([]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.from('configuracoes').select('valor').eq('chave', 'financeiro').maybeSingle();
      if (vivo && data) setCfg(lerConfigFin(data.valor));
      try {
        const lista = await fetchAll<Cte>((f, t) => supabase.from('ctes').select('*').order('id').range(f, t));
        if (vivo) setCtes(lista);
      } catch (err) { console.error(err); }
    })();
    return () => { vivo = false; };
  }, []);

  async function salvarCfg(n: ConfigFinanceiro) {
    const { error } = await supabase.from('configuracoes').upsert({ chave: 'financeiro', valor: n }, { onConflict: 'chave' });
    if (error) { toast({ kind: 'error', title: 'Não foi possível salvar', text: mensagemErro(error) }); throw error; }
    setCfg(n);
    registrarLog('EDITOU', 'ALERTAS', `Alterou os parâmetros financeiros (orçamento ${n.orcamento_pct}%, fora do padrão ${n.limite_pct}%, real × cotado ${n.margem_cotado_pct}%)`);
    toast({ kind: 'success', title: 'Parâmetros salvos' });
  }

  const meses = useMemo(() => [...new Set(entregas.map((e) => e.data_faturamento?.slice(0, 7)).filter(Boolean) as string[])].sort().reverse(), [entregas]);
  const per = useMemo(() => resolverPeriodo(periodo, { mes: mes || meses[0], de, ate }), [periodo, mes, meses, de, ate]);

  const doPeriodo = (i: typeof per.atual) => entregas.filter((e) => e.data_faturamento && dentro(e.data_faturamento, i) && (!transp || e.transportadora_id === transp));
  const linhas = useMemo(() => analisarNFs(doPeriodo(per.atual), metas, cfg),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entregas, per, transp, metas, cfg]);
  const linhasAnt = useMemo(() => (per.anterior ? analisarNFs(doPeriodo(per.anterior), metas, cfg) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entregas, per, transp, metas, cfg]);
  const r = useMemo(() => resumir(linhas), [linhas]);
  const ra = useMemo(() => (linhasAnt?.length ? resumir(linhasAnt) : null), [linhasAnt]);
  const serie = useMemo(() => serieMensal(linhas), [linhas]);

  const nomeTransp = transportadoras.find((t) => t.id === transp)?.nome;
  const ctesPeriodo = useMemo(() => ctes.filter((x) => x.data_emissao && dentro(x.data_emissao, per.atual)), [ctes, per]);
  const ctesAbertos = useMemo(() => ctes.filter(cteAberto), [ctes]);
  const tabTransp = useMemo(() => porTransportadora(linhas, ctesPeriodo, ctesAbertos, transportadoras)
    .filter((l) => !nomeTransp || l.nome === nomeTransp), [linhas, ctesPeriodo, ctesAbertos, transportadoras, nomeTransp]);
  const tabClientes = useMemo(() => porCliente(linhas), [linhas]);
  const linhasBusca = useMemo(() => (busca ? linhas.filter((l) => matchesSearch(busca, l.e.nota_fiscal, l.e.clientes?.nome, l.e.transportadoras?.nome)) : linhas), [linhas, busca]);

  const abertosValor = ctesAbertos.reduce((s, x) => s + Number(x.valor_total_servico || 0), 0);
  const mesHoje = hojeISO().slice(0, 7);
  const mesOrc = (periodo === 'mes' ? serie.find((s) => s.mes === (mes || meses[0])) : serie.find((s) => s.mes === mesHoje) ?? serie[serie.length - 1]) ?? null;
  const vs = ra ? per.rotuloAnterior : '';

  function exportar() {
    if (aba === 'transportadoras') {
      downloadCsv('MunilaLog_Frete_por_Transportadora', ['Transportadora', 'NFs', 'Faturamento', 'Frete real', '% frete (CTE)', 'Real x cotado %', 'Aguardando CTE', 'Cotado pendente', 'CTEs no período', 'Valor CTEs', 'CTEs a lançar no Infarma', 'Valor a lançar'],
        tabTransp.map((l) => [l.nome, l.notas, csvNum(l.faturamento.toFixed(2)), csvNum(l.freteReal.toFixed(2)), l.pctReal === null ? '-' : csvNum(l.pctReal.toFixed(2)), l.desvioPct === null ? '-' : csvNum(l.desvioPct.toFixed(1)), l.aguardando, csvNum(l.cotadoPendente.toFixed(2)), l.ctes, csvNum(l.valorCtes.toFixed(2)), l.ctesAbertos, csvNum(l.valorAbertos.toFixed(2))]));
      return;
    }
    if (aba === 'clientes') {
      downloadCsv('MunilaLog_Frete_por_Cliente', ['Cliente', 'NFs', 'Faturamento', 'Ticket médio', 'Custo de frete', 'Frete por NF', '% frete', 'Acima da meta'],
        tabClientes.map((l) => [l.nome, l.notas, csvNum(l.faturamento.toFixed(2)), csvNum(l.ticketMedio.toFixed(2)), csvNum(l.custo.toFixed(2)), csvNum(l.fretePorNf.toFixed(2)), csvNum(l.pct.toFixed(2)), l.comMeta ? `${l.acimaMeta} de ${l.comMeta}` : '-']));
      return;
    }
    const lista = situacao === 'todas' ? linhasBusca : linhasBusca.filter((l) => l.flags.has(situacao));
    if (!lista.length) { toast({ kind: 'warning', title: 'Não há dados para exportar.' }); return; }
    downloadCsv('MunilaLog_Conferencia_Frete',
      ['Nº NF', 'Faturamento', 'Cliente', 'Transportadora', 'Modal', 'Valor NF (R$)', 'Frete cotado (R$)', 'Frete real (R$)', '% frete', 'Real - cotado (R$)', 'Situação', 'Pendências'],
      lista.map((l) => [l.e.nota_fiscal, l.e.data_faturamento ?? '', l.e.clientes?.nome ?? '-', l.e.transportadoras?.nome ?? '-', l.e.modal_frete || l.e.transportadoras?.modal_padrao || '-',
        csvNum(l.valor), csvNum(l.cotado), l.real === null ? '-' : csvNum(l.real), csvNum(l.pct.toFixed(2)), l.diferenca === null ? '-' : csvNum(l.diferenca.toFixed(2)),
        SITUACAO[l.situacao].label, [...l.flags].map((f) => SITUACAO[f].label).join(' / ')]));
  }

  return (
    <div className="page fin">
      <PageHeader icon={<DollarSign size={22} />} title="Gestão Financeira" subtitle="Custo de frete, conferência dos CTEs e o que ainda falta pagar e lançar"
        actions={<>
          {isAdmin && <button className="btn" onClick={() => setParametros(true)}><Settings2 size={16} /> Parâmetros</button>}
          <button className="btn btn-success-outline" onClick={exportar}><Download size={16} /> Exportar</button>
        </>} />

      <div className="card card-pad no-print bi-filtros">
        <div className="field">
          <label><Calendar size={14} /> Período (faturamento)</label>
          <select className="select" value={periodo} onChange={(e) => setPeriodo(e.target.value as PeriodoId)}>
            <option value="tudo">Todo o histórico</option>
            <option value="mes">Mês…</option>
            <option value="30dias">Últimos 30 dias</option>
            <option value="90dias">Últimos 3 meses</option>
            <option value="esteAno">Este ano</option>
            <option value="personalizado">Personalizado…</option>
          </select>
        </div>
        {periodo === 'mes' && (
          <div className="field"><label>Mês</label>
            <select className="select" value={mes || meses[0] || ''} onChange={(e) => setMes(e.target.value)}>
              {meses.map((m) => <option key={m} value={m}>{fmtMes(m)}</option>)}
            </select>
          </div>
        )}
        {periodo === 'personalizado' && (<>
          <div className="field"><label>De</label><input type="date" className="input" value={de} onChange={(e) => setDe(e.target.value)} /></div>
          <div className="field"><label>Até</label><input type="date" className="input" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
        </>)}
        <div className="field">
          <label><Truck size={14} /> Transportadora</label>
          <select className="select" value={transp} onChange={(e) => setTransp(e.target.value)}>
            <option value="">Todas</option>
            {transportadoras.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
        <div className="bi-filtros__info">
          <strong>{per.rotulo}{nomeTransp ? ` · ${nomeTransp}` : ''}</strong>
          <span>{ra ? `Comparando com ${per.rotuloAnterior}` : 'Escolha um período para ver a comparação ↑ ↓'}</span>
        </div>
      </div>

      <div className="bi-kpis">
        <KpiBI label="% de frete (CTE)" tone="orange" icon={<Percent size={18} />} tipo="pp" melhor="menor"
          value={r.conferidas ? formatPercent(r.pctReal) : '—'}
          sub={`Frete real ${moedaCompacta(r.freteReal)} ÷ ${moedaCompacta(r.fatConferido)} das ${num(r.conferidas)} NFs com CTE`}
          delta={ra && ra.conferidas && r.conferidas ? r.pctReal - ra.pctReal : null} vsTexto={ra?.conferidas ? `vs. ${formatPercent(ra.pctReal)}` : vs} />
        <KpiBI label="Frete a conferir" tone="blue" icon={<Wallet size={18} />} melhor="menor"
          value={moedaCompacta(r.cotadoPendente)}
          sub={`${num(r.aguardando)} NFs aguardando CTE${r.diasMedioSemCte !== null ? ` · há ${num(r.diasMedioSemCte, 0)} dias em média` : ''} (pelo cotado)`}
          delta={ra ? variacao(r.cotadoPendente, ra.cotadoPendente) : null} vsTexto={ra ? `vs. ${moedaCompacta(ra.cotadoPendente)}` : undefined} />
        <KpiBI label={r.desvio > 0 ? 'Pago acima do cotado' : 'Economia sobre o cotado'} tone={r.desvio > 0 ? 'orange' : 'green'} icon={<PiggyBank size={18} />} tipo="pp" melhor="menor"
          value={moedaCompacta(Math.abs(r.desvio))}
          sub={r.comparaveis ? `Real ${r.desvio > 0 ? '+' : '−'}${formatPercent(Math.abs(r.desvioPct), 1)} em relação ao cotado, nas ${num(r.comparaveis)} NFs com os dois valores` : 'Sem NFs com cotado e real'}
          delta={ra && ra.comparaveis && r.comparaveis ? r.desvioPct - ra.desvioPct : null} vsTexto={ra?.comparaveis ? `vs. ${ra.desvioPct > 0 ? '+' : ''}${formatPercent(ra.desvioPct, 1)}` : vs} />
        <KpiBI label="Custo total previsto" tone="purple" icon={<Receipt size={18} />} melhor="menor"
          value={moedaCompacta(r.custoPrevisto)}
          sub={`${formatPercent(r.pctPrevisto)} do faturamento de ${moedaCompacta(r.faturamento)} (real + a conferir)`}
          delta={ra ? variacao(r.custoPrevisto, ra.custoPrevisto) : null} vsTexto={ra ? `vs. ${moedaCompacta(ra.custoPrevisto)}` : undefined} />
      </div>

      <div className="bi-strip">
        <div className="bi-strip__item"><Receipt size={16} /><span>NFs no período</span><strong>{num(r.notas)}</strong></div>
        <div className="bi-strip__item"><DollarSign size={16} /><span>Faturamento</span><strong>{moedaCompacta(r.faturamento)}</strong></div>
        <div className="bi-strip__item bi-strip__item--wide">
          <Receipt size={16} /><span>Conferidas por CTE</span><strong>{formatPercent(r.cobertura, 0)}</strong>
          <div className="bi-progress"><i style={{ width: `${r.cobertura}%`, background: c.green }} /></div>
        </div>
        <button className="bi-strip__item fin-strip-btn" onClick={() => setAba('transportadoras')} title="Ver por transportadora">
          <Truck size={16} /><span>CTEs a lançar no Infarma</span>
          <strong className={ctesAbertos.length ? 'text-orange' : ''}>{num(ctesAbertos.length)}</strong>
          <em>{formatMoney(abertosValor)}</em>
        </button>
      </div>

      <div className="fin-tabs no-print" role="tablist">
        {ABAS.map(([k, l]) => <button key={k} role="tab" aria-selected={aba === k} className={`fin-tab ${aba === k ? 'is-on' : ''}`} onClick={() => setAba(k)}>{l}</button>)}
        {aba === 'conferencia' && <SearchInput className="fin-tabs__busca" value={busca} onChange={setBusca} placeholder="Buscar NF, cliente ou transportadora…" />}
      </div>

      {aba === 'visao' && <VisaoGeral serie={serie} r={r} cfg={cfg} c={c} mesOrc={mesOrc} />}
      {aba === 'conferencia' && <Conferencia linhas={linhasBusca} aba={situacao} setAba={setSituacao} cfg={cfg} onHistorico={setHistorico} loading={loading} />}
      {aba === 'transportadoras' && <Transportadoras linhas={tabTransp} media={r.pctReal} irCtes={() => navigate('/ctes')} />}
      {aba === 'clientes' && <Clientes linhas={tabClientes} media={r.pctPrevisto} />}

      {historico && <ModalHistorico entrega={historico} onClose={() => setHistorico(null)} />}
      {parametros && <ModalParametros cfg={cfg} onClose={() => setParametros(false)} onSalvar={salvarCfg} />}
    </div>
  );
}
