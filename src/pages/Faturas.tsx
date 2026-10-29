import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, CircleCheck, Download, FileWarning, PiggyBank, Plus, ReceiptText, Send, TriangleAlert, Wallet } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchAll } from '../lib/db';
import { downloadCsv, csvNum } from '../lib/csv';
import { formatDate, formatMoney, hojeISO, matchesSearch, toNumber } from '../lib/format';
import { extrairNFs } from '../lib/integracaoCte';
import { lerConfigFin } from '../lib/financeiro';
import {
  EM_ABERTO, SITUACAO_CONF, diasAntes, STATUS_FATURA, conferirFatura, ctesSemFatura, diasParaVencer, indiceCtes, normCte, resumirFaturas,
  transportadoraIdDoCte, valorAPagar, type ContextoConferencia, type Fatura, type StatusFatura,
} from '../lib/faturas';
import type { TabelaFrete } from '../lib/tabelaFrete';
import { useAppData } from '../state/context';
import { useFeedback } from '../feedback/context';
import { EmptyState, PageHeader, SearchInput } from '../components/ui/basics';
import { KpiBI } from './bi/KpiBI';
import { moedaCompacta, num } from './bi/fmt';
import { ModalFatura, type RascunhoFatura } from './faturas/ModalFatura';
import { ModalDetalheFatura, PrazoFatura } from './faturas/ModalDetalhe';
import type { Cte } from '../types';
import './bi/bi.css';
import './financeiro/financeiro.css';
import './faturas/faturas.css';

type Filtro = 'abertas' | StatusFatura | 'todas' | 'vencidas';
const FILTROS: [Filtro, string, string?][] = [
  ['abertas', 'Em aberto'], ['vencidas', 'Vencidas', 'red'], ['recebida', 'A conferir', 'blue'], ['contestada', 'Contestadas', 'orange'],
  ['conferida', 'Conferidas', 'purple'], ['aprovada', 'Aprovadas p/ pagar', 'amber'], ['paga', 'Pagas', 'green'], ['cancelada', 'Canceladas'], ['todas', 'Todas'],
];

export default function Faturas() {
  const { entregas, transportadoras, isAdmin } = useAppData();
  const { toast } = useFeedback();
  const navigate = useNavigate();
  const hoje = hojeISO();

  const [faturas, setFaturas] = useState<Fatura[] | null>(null);
  const [semTabela, setSemTabela] = useState(false);
  const [ctes, setCtes] = useState<Cte[]>([]);
  const [tabelas, setTabelas] = useState<TabelaFrete[]>([]);
  const [tol, setTol] = useState(2);
  const [aba, setAba] = useState<'faturas' | 'semfatura'>('faturas');
  const [filtro, setFiltro] = useState<Filtro>('abertas');
  const [transp, setTransp] = useState('');
  const [busca, setBusca] = useState('');
  const [rascunho, setRascunho] = useState<RascunhoFatura | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

  const carregarFaturas = useCallback(async () => {
    const { data, error } = await supabase.from('faturas_frete').select('*').order('vencimento', { ascending: true });
    if (error) { if (/does not exist|schema cache|faturas_frete/i.test(error.message)) setSemTabela(true); else toast({ kind: 'error', title: 'Erro ao carregar faturas', text: error.message }); setFaturas([]); return; }
    setFaturas((data ?? []) as Fatura[]);
  }, [toast]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      await carregarFaturas();
      const { data: cfg } = await supabase.from('configuracoes').select('valor').eq('chave', 'financeiro').maybeSingle();
      if (vivo && cfg) setTol(lerConfigFin(cfg.valor).tolerancia_tabela_pct);
      const { data: tf } = await supabase.from('tabelas_frete').select('*');
      if (vivo && tf) setTabelas(tf as TabelaFrete[]);
      try {
        const lista = await fetchAll<Cte>((f, t) => supabase.from('ctes').select('*').order('id').range(f, t));
        if (vivo) setCtes(lista);
      } catch (err) { console.error(err); }
    })();
    // outra pessoa aprovou/pagou/registrou: a lista se atualiza sozinha
    let timer: ReturnType<typeof setTimeout>;
    const canal = supabase.channel('munilalog-faturas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'faturas_frete' }, () => { clearTimeout(timer); timer = setTimeout(() => { if (vivo) carregarFaturas(); }, 600); })
      .subscribe();
    return () => { vivo = false; clearTimeout(timer); supabase.removeChannel(canal); };
  }, [carregarFaturas]);

  const lista = useMemo(() => faturas ?? [], [faturas]);
  const indice = useMemo(() => indiceCtes(ctes), [ctes]);
  const ctx: ContextoConferencia = useMemo(() => ({ ctes, entregas, tabelas, transportadoras, faturas: lista, tolPct: tol, indice }), [ctes, entregas, tabelas, transportadoras, lista, tol, indice]);
  const confs = useMemo(() => new Map(lista.map((f) => [f.id, conferirFatura(f, ctx)])), [lista, ctx]);
  const resumo = useMemo(() => resumirFaturas(lista, hoje), [lista, hoje]);
  const nomeT = useCallback((id: string) => transportadoras.find((t) => String(t.id) === String(id))?.nome ?? '—', [transportadoras]);

  const contagem = useMemo(() => {
    const c: Record<string, number> = {};
    for (const [k] of FILTROS) c[k] = 0;
    for (const f of lista) {
      if (transp && f.transportadora_id !== transp) continue;
      c.todas++; c[f.status]++;
      if (EM_ABERTO.includes(f.status)) { c.abertas++; if (diasParaVencer(f.vencimento, hoje) < 0) c.vencidas++; }
    }
    return c;
  }, [lista, transp, hoje]);

  const visiveis = useMemo(() => lista.filter((f) => {
    if (transp && f.transportadora_id !== transp) return false;
    if (filtro === 'abertas' && !EM_ABERTO.includes(f.status)) return false;
    if (filtro === 'vencidas' && !(EM_ABERTO.includes(f.status) && diasParaVencer(f.vencimento, hoje) < 0)) return false;
    if (filtro !== 'abertas' && filtro !== 'todas' && filtro !== 'vencidas' && f.status !== filtro) return false;
    return !busca || matchesSearch(busca, f.numero, nomeT(f.transportadora_id), ...(f.ctes ?? []));
  }).sort((a, b) => (filtro === 'paga' ? String(b.pago_em).localeCompare(String(a.pago_em)) : a.vencimento.localeCompare(b.vencimento))),
  [lista, transp, filtro, busca, hoje, nomeT]);

  // CTEs (últimos 6 meses) ainda não cobrados em nenhuma fatura, por transportadora
  const semFatura = useMemo(() => {
    const desde = diasAntes(hoje, 183);
    const cs = ctesSemFatura(ctes, lista, transportadoras).filter((c) => !c.data_emissao || c.data_emissao >= desde);
    const m = new Map<string, { id: string | null; nome: string; ctes: Cte[]; valor: number; maisAntigo: string | null }>();
    for (const c of cs) {
      const id = transportadoraIdDoCte(c, transportadoras);
      const k = id ?? `?${c.razao_social_emitente ?? ''}`;
      const g = m.get(k) ?? { id, nome: id ? nomeT(id) : (c.razao_social_emitente || 'Emitente sem cadastro'), ctes: [], valor: 0, maisAntigo: null };
      g.ctes.push(c); g.valor += toNumber(c.valor_total_servico);
      if (c.data_emissao && (!g.maisAntigo || c.data_emissao < g.maisAntigo)) g.maisAntigo = c.data_emissao;
      m.set(k, g);
    }
    return [...m.values()].filter((g) => !transp || g.id === transp).sort((a, b) => b.valor - a.valor);
  }, [ctes, lista, transportadoras, nomeT, transp, hoje]);
  const totalSemFatura = semFatura.reduce((s, g) => s + g.ctes.length, 0);

  function exportar() {
    if (!visiveis.length) { toast({ kind: 'warning', title: 'Não há faturas para exportar.' }); return; }
    downloadCsv('MunilaLog_Faturas_de_Frete',
      ['Fatura', 'Transportadora', 'Emissão', 'Vencimento', 'Status', 'Valor (R$)', 'CTEs', 'Soma dos CTEs (R$)', 'Diferença (R$)', 'Conferência', 'A contestar sugerido (R$)', 'Contestado (R$)', 'Aprovado (R$)', 'Pago em'],
      visiveis.map((f) => {
        const c = confs.get(f.id)!;
        return [f.numero, nomeT(f.transportadora_id), f.emissao ?? '', f.vencimento, STATUS_FATURA[f.status].label, csvNum(toNumber(f.valor).toFixed(2)), (f.ctes ?? []).join(' '),
          csvNum(c.somaCtes.toFixed(2)), c.diferencaSoma === null ? '-' : csvNum(c.diferencaSoma.toFixed(2)), SITUACAO_CONF[c.situacao].label, csvNum(c.aContestar.toFixed(2)),
          csvNum(toNumber(f.valor_contestado).toFixed(2)), f.valor_aprovado === null ? '-' : csvNum(toNumber(f.valor_aprovado).toFixed(2)), f.pago_em ?? ''];
      }));
  }

  const atualizar = (f: Fatura) => setFaturas((xs) => (xs ?? []).some((x) => x.id === f.id) ? (xs ?? []).map((x) => (x.id === f.id ? f : x)) : [...(xs ?? []), f]);
  const fAberta = aberta ? lista.find((f) => f.id === aberta) : undefined;

  if (semTabela) {
    return (
      <div className="page">
        <PageHeader icon={<ReceiptText size={22} />} title="Faturas de frete" />
        <div className="card card-pad bi-vazio">
          <ReceiptText size={28} />
          <div><strong>Falta preparar o banco de dados.</strong>
            <p className="muted">No Supabase, abra SQL Editor › New query, cole o arquivo <code>supabase/faturas_frete.sql</code> e clique em Run. Depois atualize esta página.</p></div>
        </div>
      </div>
    );
  }

  return (
    <div className="page fat">
      <PageHeader icon={<ReceiptText size={22} />} title="Faturas de frete"
        subtitle="Confira cada fatura das transportadoras contra os CTEs e a tabela de frete, conteste divergências e controle os vencimentos"
        actions={<>
          <button className="btn btn-success-outline" onClick={exportar}><Download size={16} /> Exportar</button>
          {isAdmin && <button className="btn btn-primary" onClick={() => setRascunho({ transportadora_id: transp || undefined })}><Plus size={16} /> Registrar fatura</button>}
        </>} />

      <div className="bi-kpis">
        <KpiBI label="Vencidas sem pagamento" tone="red" icon={<TriangleAlert size={18} />} value={moedaCompacta(resumo.vencidas.valor)}
          sub={resumo.vencidas.n ? `${num(resumo.vencidas.n)} fatura(s) — risco de juros e bloqueio de coleta` : 'Nenhuma fatura vencida'} />
        <KpiBI label="Vencem em 7 dias" tone="amber" icon={<CalendarClock size={18} />} value={moedaCompacta(resumo.vencendo.valor)}
          sub={`${num(resumo.vencendo.n)} fatura(s) para conferir e aprovar a tempo`} />
        <KpiBI label="Em conferência" tone="blue" icon={<Send size={18} />} value={num(resumo.aConferir.n + resumo.contestadas.n)} unit=" faturas"
          sub={`${num(resumo.aConferir.n)} a conferir · ${num(resumo.contestadas.n)} contestada(s)${resumo.contestadas.contestado ? ` (${moedaCompacta(resumo.contestadas.contestado)} em disputa)` : ''}`} />
        <KpiBI label="Liberadas a pagar" tone="purple" icon={<Wallet size={18} />} value={moedaCompacta(resumo.aPagar.valor)}
          sub={`${num(resumo.aPagar.n)} fatura(s) conferidas/aprovadas · pagas no mês: ${moedaCompacta(resumo.pagasMes.valor)}`} />
        <KpiBI label="Economia com contestações" tone="green" icon={<PiggyBank size={18} />} value={moedaCompacta(resumo.economia)}
          sub="Diferença entre o cobrado e o aprovado nas faturas aprovadas/pagas" />
      </div>

      <div className="fin-tabs">
        <button className={`fin-tab ${aba === 'faturas' ? 'is-on' : ''}`} onClick={() => setAba('faturas')}>Faturas</button>
        <button className={`fin-tab ${aba === 'semfatura' ? 'is-on' : ''}`} onClick={() => setAba('semfatura')}>CTEs sem fatura {totalSemFatura > 0 && <span className="count">{totalSemFatura}</span>}</button>
        <div className="fat-filtros">
          <select className="select" value={transp} onChange={(e) => setTransp(e.target.value)} aria-label="Transportadora">
            <option value="">Todas as transportadoras</option>
            {transportadoras.map((t) => <option key={t.id} value={String(t.id)}>{t.nome}</option>)}
          </select>
          {aba === 'faturas' && <SearchInput value={busca} onChange={setBusca} placeholder="Fatura ou nº do CTE" />}
        </div>
      </div>

      {aba === 'faturas' ? (
        <div className="fin-conf">
          <div className="fin-abas">
            {FILTROS.map(([k, l, tom]) => (
              <button key={k} className={`fin-aba ${tom ? `fin-aba--${tom}` : ''} ${filtro === k ? 'is-on' : ''}`} onClick={() => setFiltro(k)}>{l}<b>{num(contagem[k] ?? 0)}</b></button>
            ))}
          </div>
          {faturas === null ? <div className="card card-pad muted">Carregando…</div>
            : !visiveis.length ? (
              <div className="card"><EmptyState icon={<ReceiptText size={32} />} title={lista.length ? 'Nenhuma fatura neste filtro' : 'Nenhuma fatura registrada ainda'}
                text={lista.length ? undefined : 'Registre a fatura (boleto) da transportadora com os números dos CTEs cobrados: o sistema confere a soma, a tabela de frete e as cobranças em dobro.'}
                action={isAdmin && !lista.length ? <button className="btn btn-primary" onClick={() => setRascunho({})}><Plus size={16} /> Registrar a primeira fatura</button> : undefined} /></div>
            ) : (
              <div className="card bi-ranking">
                <div className="table-scroll" style={{ maxHeight: 640 }}>
                  <table className="bi-tabela fat-tabela">
                    <thead><tr><th>Fatura</th><th>Transportadora</th><th>Vencimento</th><th className="r">CTEs</th><th className="r">Valor</th><th>Conferência</th><th className="r">A pagar</th><th>Status</th></tr></thead>
                    <tbody>
                      {visiveis.map((f) => {
                        const c = confs.get(f.id)!; const s = SITUACAO_CONF[c.situacao]; const st = STATUS_FATURA[f.status];
                        return (
                          <tr key={f.id} onClick={() => setAberta(f.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setAberta(f.id); }}>
                            <td className="strong">{f.numero}<small className="muted fat-sub">{f.emissao ? `emitida ${formatDate(f.emissao)}` : ''}</small></td>
                            <td>{nomeT(f.transportadora_id)}</td>
                            <td><PrazoFatura f={f} hoje={hoje} /></td>
                            <td className="r">{num(f.ctes?.length ?? 0)}</td>
                            <td className="r strong">{formatMoney(f.valor)}</td>
                            <td>
                              {f.status === 'paga' || f.status === 'cancelada' ? <span className="muted">—</span> : <>
                                <span className={`badge tone-${s.tone}`}>{s.label}</span>
                                {c.aContestar > 0 && <small className="text-red fat-sub">{formatMoney(c.aContestar)} a contestar</small>}
                              </>}
                            </td>
                            <td className="r">{f.status === 'cancelada' ? '—' : formatMoney(valorAPagar(f))}{f.status === 'paga' && f.pago_em && <small className="muted fat-sub">pago {formatDate(f.pago_em)}</small>}</td>
                            <td><span className={`badge tone-${st.tone}`} title={st.dica}>{st.label}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="fin-totais">
                  <span>{num(visiveis.length)} fatura(s)</span>
                  <span>Valor: <b>{formatMoney(visiveis.reduce((s, f) => s + toNumber(f.valor), 0))}</b></span>
                  <span>A pagar: <b>{formatMoney(visiveis.filter((f) => f.status !== 'cancelada').reduce((s, f) => s + valorAPagar(f), 0))}</b></span>
                  <span className="muted">Clique numa fatura para conferir CTE a CTE</span>
                </div>
              </div>
            )}
        </div>
      ) : (
        <div className="fin-conf">
          <p className="muted bi-legenda">CTEs dos últimos 6 meses que ainda não foram cobrados em nenhuma fatura registrada. Útil para saber o que a transportadora ainda vai cobrar — e para montar a fatura em um clique.</p>
          {!semFatura.length ? <div className="card"><EmptyState icon={<CircleCheck size={30} />} title="Todos os CTEs estão em alguma fatura" /></div> : (
            <div className="fat-grupos">
              {semFatura.map((g) => (
                <div key={g.id ?? g.nome} className="card fat-grupo">
                  <div className="fat-grupo__top">
                    <div><strong>{g.nome}</strong><span className="muted">{num(g.ctes.length)} CTE(s) · {formatMoney(g.valor)}{g.maisAntigo ? ` · mais antigo de ${formatDate(g.maisAntigo)}` : ''}</span></div>
                    {isAdmin && g.id && <button className="btn btn-sm" onClick={() => setRascunho({ transportadora_id: g.id!, ctes: g.ctes.map((c) => normCte(c.numero_documento)), valor: Math.round(g.valor * 100) / 100 })}><Plus size={14} /> Montar fatura com estes CTEs</button>}
                    {!g.id && <span className="badge tone-amber" title="Cadastre a transportadora com o CNPJ do emitente para agrupar"><FileWarning size={12} /> sem cadastro</span>}
                  </div>
                  <div className="table-scroll" style={{ maxHeight: 260 }}>
                    <table className="bi-tabela">
                      <thead><tr><th>CTE</th><th>Emissão</th><th>NFs</th><th className="r">Valor</th><th>Infarma</th></tr></thead>
                      <tbody>
                        {g.ctes.sort((a, b) => String(a.data_emissao).localeCompare(String(b.data_emissao))).map((c) => (
                          <tr key={c.id}>
                            <td className="strong">{c.numero_documento}</td>
                            <td>{formatDate(c.data_emissao)}</td>
                            <td>{extrairNFs(c.chave_acesso).slice(0, 4).join(', ') || '—'}</td>
                            <td className="r">{formatMoney(c.valor_total_servico)}</td>
                            <td><span className={`badge tone-${String(c.situacao).toUpperCase() === 'FECHADO' ? 'green' : 'orange'}`}>{String(c.situacao).toUpperCase() === 'FECHADO' ? 'Lançado' : 'A lançar'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
          {isAdmin && <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/ctes')}>Registrar XMLs de CTE</button>}
        </div>
      )}

      {rascunho && (
        <ModalFatura inicial={rascunho} ctx={ctx} onClose={() => setRascunho(null)}
          onSalvo={(f) => { atualizar(f); setRascunho(null); setAba('faturas'); setAberta(f.id); }} />
      )}
      {fAberta && !rascunho && (
        <ModalDetalheFatura f={fAberta} conf={confs.get(fAberta.id)!} transp={transportadoras.find((t) => String(t.id) === String(fAberta.transportadora_id))}
          onClose={() => setAberta(null)} onAtualizada={atualizar}
          onExcluida={(id) => { setFaturas((xs) => (xs ?? []).filter((x) => x.id !== id)); setAberta(null); }}
          onEditar={() => setRascunho(fAberta)}
          onCtesLancados={(ids) => setCtes((cs) => cs.map((c) => (ids.includes(String(c.id)) ? { ...c, situacao: 'FECHADO' } : c)))} />
      )}
    </div>
  );
}
