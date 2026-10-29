import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, CircleCheck, Download, Map as MapIcon, ShieldQuestion, Siren, TriangleAlert, Truck } from 'lucide-react';
import { useAppData } from '../state/context';
import { useFeedback } from '../feedback/context';
import { useChartTheme } from '../hooks/useChartTheme';
import { supabase } from '../lib/supabase';
import { mensagemErro, registrarLog } from '../lib/db';
import { downloadCsv } from '../lib/csv';
import { FILTROS_VAZIOS, cidadeDestino, ufDestino } from '../lib/filtrosEntrega';
import { formatDate, hojeISO, matchesSearch, percentual, formatPercent } from '../lib/format';
import { diasUteisEntre } from '../lib/diasUteis';
import {
  CONFIG_SLA_PADRAO, ETAPA, aprenderPrazos, analisarSLA, avaliarRisco, lerConfigSLA, type ConfigSLA, type Etapa, type LinhaSLA, type RiscoNF, type SituacaoSLA,
} from '../lib/sla';
import { loadPrefRaw, savePref } from '../lib/storage';
import { KpiCard, PageHeader, SearchInput } from '../components/ui/basics';
import { ModalHistorico } from '../modals/ModalHistorico';
import { Cobranca, Desempenho, EmAberto, Prazos, Verificar } from './logistica/Abas';
import type { Entrega } from '../types';
import './bi/bi.css';
import './financeiro/financeiro.css';
import './logistica/logistica.css';

type Aba = 'aberto' | 'verificar' | 'cobranca' | 'desempenho' | 'prazos';
const ABERTAS = new Set<Etapa>(['coleta', 'agendamento', 'agendado', 'transito']);

export default function Logistica() {
  const { entregas, transportadoras, loading, isAdmin, setEntregas, setFiltros } = useAppData();
  const { toast, confirm } = useFeedback();
  const navigate = useNavigate();
  const c = useChartTheme();

  const [aba, setAbaState] = useState<Aba>(() => loadPrefRaw<Aba>('slaAba', 'aberto'));
  const setAba = (a: Aba) => { setAbaState(a); savePref('slaAba', a); };
  const [busca, setBusca] = useState('');
  const [transp, setTransp] = useState('');
  const [uf, setUf] = useState('');
  const [etapa, setEtapa] = useState<Etapa | ''>('');
  const [situacao, setSituacao] = useState<SituacaoSLA | 'risco' | ''>('');
  const [historico, setHistorico] = useState<Entrega | null>(null);
  const [cfg, setCfg] = useState<ConfigSLA>(CONFIG_SLA_PADRAO);
  const [tabelasFrete, setTabelasFrete] = useState<{ transportadora_id: string; uf: string; componentes: { prazo_dias?: number } | null; ativo: boolean }[]>([]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.from('configuracoes').select('chave, valor').in('chave', ['sla', 'prazo_coleta_dias']);
      if (!vivo || !data) return;
      const v = (k: string) => data.find((x) => x.chave === k)?.valor;
      const col = Number(v('prazo_coleta_dias'));
      setCfg(lerConfigSLA(v('sla'), Number.isFinite(col) ? col : undefined));
      // prazo contratado nas tabelas de frete (por transportadora × UF) também vale como prazo de trânsito
      const { data: tf } = await supabase.from('tabelas_frete').select('transportadora_id, uf, componentes, ativo');
      if (vivo && tf) setTabelasFrete(tf);
    })();
    return () => { vivo = false; };
  }, []);

  const hoje = hojeISO();
  const apr = useMemo(() => aprenderPrazos(entregas), [entregas]);
  const rotasTabela = useMemo(() => tabelasFrete.flatMap((x) => {
    const dias = Number(x.componentes?.prazo_dias);
    const nome = transportadoras.find((t) => String(t.id) === String(x.transportadora_id))?.nome;
    return x.ativo && x.uf !== '*' && dias > 0 && nome ? [{ uf: x.uf, transportadora: nome, dias }] : [];
  }), [tabelasFrete, transportadoras]);
  // prazos manuais da aba Prazos têm prioridade sobre os das tabelas de frete
  const cfgEfetivo = useMemo(() => ({ ...cfg, rotas: [...cfg.rotas, ...rotasTabela] }), [cfg, rotasTabela]);
  const todas = useMemo(() => analisarSLA(entregas, cfgEfetivo, apr, hoje), [entregas, cfgEfetivo, apr, hoje]);
  const filtradas = useMemo(() => todas.filter((l) =>
    (!transp || l.e.transportadora_id === transp) && (!uf || ufDestino(l.e) === uf)
    && matchesSearch(busca, l.e.nota_fiscal, l.e.clientes?.nome, cidadeDestino(l.e), l.e.transportadoras?.nome, l.e.status)), [todas, transp, uf, busca]);

  const abertas = useMemo(() => filtradas.filter((l) => ABERTAS.has(l.etapa) && l.situacao !== 'verificar')
    .sort((a, b) => (b.atraso ?? -999) - (a.atraso ?? -999)), [filtradas]);
  // risco de atraso: ainda no prazo, mas a estimativa pela rota passa da previsão
  const riscos = useMemo(() => {
    const m = new Map<string, RiscoNF>();
    for (const l of abertas) { const r = avaliarRisco(l, cfgEfetivo, apr, hoje); if (r) m.set(String(l.e.id), r); }
    return m;
  }, [abertas, cfgEfetivo, apr, hoje]);
  const verificar = useMemo(() => filtradas.filter((l) => l.situacao === 'verificar').sort((a, b) => (b.idade ?? 0) - (a.idade ?? 0)), [filtradas]);
  const k = useMemo(() => {
    const atr = abertas.filter((l) => l.situacao === 'atrasada');
    const resp = (et: Etapa[]) => atr.filter((l) => et.includes(l.etapa)).length;
    const desde = diasUteisAtras(hoje, 22);
    const ent = filtradas.filter((l) => l.etapa === 'entregue' && l.e.data_entrega_agendamento && l.e.data_entrega_agendamento >= desde);
    const ok = ent.filter((l) => l.situacao === 'entregue_prazo').length;
    return {
      atrasadas: atr.length, transp: resp(['transito', 'agendado']), coleta: resp(['coleta']), agend: resp(['agendamento']),
      vence: abertas.filter((l) => l.situacao === 'vence_hoje').length,
      noPrazo: abertas.filter((l) => l.situacao === 'no_prazo').length,
      ent: ent.length, entOk: ok,
    };
  }, [abertas, filtradas, hoje]);

  const listaAberto = situacao === 'risco'
    ? abertas.filter((l) => riscos.has(String(l.e.id))).sort((a, b) => Number(riscos.get(String(b.e.id))!.nivel === 'alto') - Number(riscos.get(String(a.e.id))!.nivel === 'alto') || String(a.limite).localeCompare(String(b.limite)))
    : situacao ? abertas.filter((l) => l.situacao === situacao) : abertas;
  const riscoAlto = [...riscos.values()].filter((r) => r.nivel === 'alto').length;
  const filtroKpi = (s: SituacaoSLA | 'risco') => () => { setAba('aberto'); setSituacao((x) => (x === s ? '' : s)); };
  const abrirPainel = (ids: string[]) => { setFiltros({ ...FILTROS_VAZIOS, nfsIds: ids, nfsRotulo: 'Logística & SLA' }); navigate('/dashboard'); };

  async function marcarEntregues(itens: { e: Entrega; data: string }[]) {
    if (!itens.length) return;
    const ok = await confirm({
      title: `Marcar ${itens.length} NF${itens.length > 1 ? 's' : ''} como Entregue?`,
      text: `O status muda para "Entregue" e a data de entrega é gravada (${itens.length === 1 ? formatDate(itens[0].data) : 'conforme escolhido'}). Fica registrado na auditoria e no histórico de cada NF.`,
      confirmLabel: 'Marcar como Entregue',
    });
    if (!ok) return;
    let feitos = 0; const gravadas = new Map<string, string>();
    for (let i = 0; i < itens.length; i += 8) {
      const lote = itens.slice(i, i + 8);
      const res = await Promise.all(lote.map(({ e, data }) => supabase.from('entregas').update({ status: 'Entregue', data_entrega_agendamento: data }).eq('id', e.id).select('id')));
      res.forEach((r, j) => { if (!r.error && r.data?.length) { feitos++; gravadas.set(lote[j].e.id, lote[j].data); } });
    }
    if (gravadas.size) {
      setEntregas((l) => l.map((e) => (gravadas.has(e.id) ? { ...e, status: 'Entregue', data_entrega_agendamento: gravadas.get(e.id)! } : e)));
      const linhas = itens.filter((x) => gravadas.has(x.e.id)).map((x) => `NF ${x.e.nota_fiscal} (entrega ${formatDate(x.data)})`);
      for (let i = 0; i < linhas.length; i += 30) await registrarLog('EDITOU', 'ENTREGAS', `Marcou como Entregue pela Central de SLA (verificação de status): ${linhas.slice(i, i + 30).join('; ')}`);
    }
    if (feitos === itens.length) toast({ kind: 'success', title: `${feitos} NF${feitos > 1 ? 's' : ''} atualizada${feitos > 1 ? 's' : ''}` });
    else toast({ kind: 'warning', title: `${feitos} de ${itens.length} atualizadas`, text: 'Algumas não foram gravadas (verifique a permissão de administrador).' });
  }

  async function salvarCfg(n: ConfigSLA) {
    // o prazo de coleta continua sendo o dos Indicadores Diários (não é gravado aqui)
    const valor = { agendamento_dias: n.agendamento_dias, transito_padrao: n.transito_padrao, rotas: n.rotas };
    const { error } = await supabase.from('configuracoes').upsert({ chave: 'sla', valor }, { onConflict: 'chave' });
    if (error) { toast({ kind: 'error', title: 'Não foi possível salvar', text: mensagemErro(error) }); return; }
    setCfg(n);
    registrarLog('EDITOU', 'ENTREGAS', `Alterou os prazos de SLA (agendamento ${n.agendamento_dias} d.u., trânsito padrão ${n.transito_padrao} d.u., ${n.rotas.length} prazo(s) manual(is))`);
    toast({ kind: 'success', title: 'Prazos salvos', text: 'Os prazos de todas as NFs foram recalculados.' });
  }

  function exportar() {
    const lista = aba === 'verificar' ? verificar : listaAberto;
    if (!lista.length) { toast({ kind: 'warning', title: 'Não há dados para exportar.' }); return; }
    downloadCsv('MunilaLog_SLA', ['NF', 'Cliente', 'Cidade', 'UF', 'Transportadora', 'Faturamento', 'Coleta', 'Etapa', 'Responsável', 'Prazo da etapa', 'Previsão de entrega', 'Origem do prazo', 'Dias úteis de atraso', 'Risco de atraso', 'Status'],
      lista.map((l: LinhaSLA) => [l.e.nota_fiscal, l.e.clientes?.nome ?? '-', cidadeDestino(l.e), ufDestino(l.e), l.e.transportadoras?.nome ?? '-',
        formatDate(l.e.data_faturamento), formatDate(l.e.data_coleta), ETAPA[l.etapa].label, ETAPA[l.etapa].resp, formatDate(l.limite), formatDate(l.previsao),
        l.e.data_previsao ? 'Previsão da NF' : l.prazo.detalhe, l.atraso !== null && l.atraso > 0 ? l.atraso : 0, riscos.get(String(l.e.id))?.motivos.join(' | ') ?? '', l.e.status]));
  }

  const ufs = useMemo(() => [...new Set(entregas.map(ufDestino).filter(Boolean))].sort(), [entregas]);
  const ABAS: [Aba, string, number | null][] = [
    ['aberto', 'Em aberto', abertas.length], ['verificar', 'Verificar status', verificar.length],
    ['cobranca', 'Cobrar transportadoras', null], ['desempenho', 'Desempenho', null], ['prazos', 'Prazos', null],
  ];

  return (
    <div className="page fin">
      <PageHeader icon={<MapIcon size={22} />} title="Logística & SLA" subtitle="Prazo de cada NF em dias úteis, por etapa e por responsável — aprendido com o histórico de entregas"
        actions={<button className="btn btn-success-outline" onClick={exportar}><Download size={16} /> Exportar</button>} />

      <div className="kpi-grid">
        <KpiCard label="Atrasadas" value={k.atrasadas} icon={<TriangleAlert size={16} />} tone="red" valueClass="text-red" onClick={filtroKpi('atrasada')} active={situacao === 'atrasada'}
          hint={`${k.transp} transportadora · ${k.coleta} coleta · ${k.agend} agendamento`} />
        <KpiCard label="Vencem hoje ou amanhã" value={k.vence} icon={<CalendarClock size={16} />} tone="amber" onClick={filtroKpi('vence_hoje')} active={situacao === 'vence_hoje'} hint="Acompanhar para não atrasar" />
        <KpiCard label="Em risco de atrasar" value={riscos.size} icon={<Siren size={16} />} tone="orange" onClick={filtroKpi('risco')} active={situacao === 'risco'}
          hint={riscos.size ? `${riscoAlto} com risco alto · ainda no prazo, mas a rota costuma levar mais` : 'Nenhuma NF no prazo com sinal de atraso'} />
        <KpiCard label="No prazo" value={k.noPrazo} icon={<Truck size={16} />} tone="blue" onClick={filtroKpi('no_prazo')} active={situacao === 'no_prazo'} hint="Em aberto, dentro do prazo" />
        <KpiCard label="Verificar status" value={verificar.length} icon={<ShieldQuestion size={16} />} tone="purple" onClick={() => setAba('verificar')} active={aba === 'verificar'} hint="Provavelmente já entregues" />
        <KpiCard label="Entregues no prazo (último mês)" value={k.ent ? formatPercent(percentual(k.entOk, k.ent), 0) : '—'} icon={<CircleCheck size={16} />} tone="green" valueClass="text-green"
          onClick={() => setAba('desempenho')} hint={`${k.entOk} de ${k.ent} entregas`} />
      </div>

      <div className="toolbar no-print sla-filtros">
        <SearchInput className="toolbar__search" value={busca} onChange={setBusca} placeholder="Buscar NF, cliente, cidade, transportadora…" />
        <select className="select" value={transp} onChange={(e) => setTransp(e.target.value)} aria-label="Transportadora">
          <option value="">Todas as transportadoras</option>
          {transportadoras.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        <select className="select" value={uf} onChange={(e) => setUf(e.target.value)} aria-label="UF" style={{ maxWidth: 140 }}>
          <option value="">Todas as UFs</option>
          {ufs.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        {situacao && aba === 'aberto' && <span className="chip chip--removable">Situação: {({ atrasada: 'Atrasadas', vence_hoje: 'Vencem hoje/amanhã', no_prazo: 'No prazo', risco: 'Em risco de atrasar' } as Record<string, string>)[situacao]} <button onClick={() => setSituacao('')} aria-label="Remover filtro">×</button></span>}
      </div>

      <div className="fin-tabs no-print" role="tablist">
        {ABAS.map(([kk, l, n]) => (
          <button key={kk} role="tab" aria-selected={aba === kk} className={`fin-tab ${aba === kk ? 'is-on' : ''}`} onClick={() => setAba(kk)}>
            {l}{n !== null && <span className={`sla-tabn ${kk === 'verificar' && n ? 'sla-tabn--roxo' : ''}`}>{n}</span>}
          </button>
        ))}
      </div>

      {aba === 'aberto' && <EmAberto linhas={listaAberto} etapa={etapa} setEtapa={setEtapa} onHistorico={setHistorico} loading={loading} riscos={riscos} />}
      {aba === 'verificar' && <Verificar linhas={verificar} isAdmin={isAdmin} onMarcar={marcarEntregues} onAbrirPainel={abrirPainel} />}
      {aba === 'cobranca' && <Cobranca linhas={abertas} onAbrirPainel={abrirPainel} onCopiado={() => toast({ kind: 'success', title: 'Mensagem copiada', text: 'Cole no WhatsApp ou e-mail da transportadora.' })} />}
      {aba === 'desempenho' && <Desempenho linhas={filtradas} apr={apr} c={c} />}
      {aba === 'prazos' && <Prazos key={JSON.stringify(cfg)} cfg={cfg} apr={apr} isAdmin={isAdmin} onSalvar={salvarCfg} />}

      {historico && <ModalHistorico entrega={historico} onClose={() => setHistorico(null)} />}
    </div>
  );
}

/** Data de N dias úteis atrás (para "último mês" ≈ 22 dias úteis). */
function diasUteisAtras(hoje: string, n: number) {
  const d = new Date(`${hoje}T12:00:00Z`);
  while (diasUteisEntre(d.toISOString().slice(0, 10), hoje) < n) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
