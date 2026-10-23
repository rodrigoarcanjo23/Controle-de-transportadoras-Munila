import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RotateCw, Upload } from 'lucide-react';
import {
  ACOMP, AREA, AREAS, DOW, HOME, PAGINAS, PERIODOS, FILTROS_PADRAO, STATUS_EXP,
  buckets, calc, delta, dow, fdm, fdmy, fmt, fmtInt, grupoDe, isN, kpiDe, limparNota, nf2, periodo, serie, somaCampos, todayISO,
  type AcompId, type AreaId, type Bucket, type Dia, type Filtros, type Kpi, type Nota, type Pagina, type Periodo,
} from './config';
import { valoresFinais } from './calculos';
import { lerCsvIndicadores, planejarImportacao, type ArquivoLido } from './importarCsv';
import { lerArquivoTexto } from '../../lib/xml';
import { useIndicadores, type IndicadoresApi } from './useIndicadores';
import { Grafico } from './Grafico';
import { FormLancamento } from './FormLancamento';
import { Acompanhamento, StatusSelect } from './Acompanhamento';
import { useMudarStatusExp } from './useMudarStatusExp';
import { useAppData } from '../../state/context';
import { useFeedback } from '../../feedback/context';
import { mensagemErro } from '../../lib/db';
import { downloadCsv } from '../../lib/csv';
import { loadPrefRaw, savePref } from '../../lib/storage';
import './indicadores.css';

/* ---------------------------------------------------------------- KPI */
function KpiBox({ k, es, pes, comp, carregando, hk, eyebrow, onAbrir, bks }: {
  k: Kpi; es: Dia[]; pes: Dia[]; comp: boolean; carregando: boolean; hk?: boolean;
  eyebrow?: { cod: string; nome: string }; onAbrir?: () => void; bks?: Bucket[];
}) {
  const v = calc(k, es);
  const d = comp ? delta(k, v, calc(k, pes)) : null;
  let sub = '';
  if (es.length) {
    if (k.t === 'ultimo') {
      let ld: string | null = null;
      for (let i = es.length - 1; i >= 0; i--) if (isN(es[i].v[k.c![0]])) { ld = es[i].d; break; }
      sub = ld ? 'Posição em ' + fdmy(ld) : '';
    } else sub = es.length + (es.length === 1 ? ' dia lançado' : ' dias lançados');
  }
  return (
    <article className={`icard ${hk ? 'hk' : 'ikpi'}`}>
      {eyebrow && <div className="eyebrow"><span className="tag">{eyebrow.cod}</span><span>{eyebrow.nome}</span></div>}
      {hk ? <h3>{k.l}</h3> : <div className="lbl">{k.l}</div>}
      <div className="row" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '.35rem .8rem' }}>
        <span className="val">{carregando ? '…' : fmt(v, k.f, k.u)}</span>
        {comp && <span className={`dl ${d?.c ?? ''}`}>{d ? d.txt + ' vs. período anterior' : v == null ? '' : 'sem base de comparação'}</span>}
      </div>
      {hk && <div className="sub">{sub}</div>}
      {!hk && <p className="def">{k.d}</p>}
      {hk && bks && <Grafico k={k} bks={bks} vals={serie(k, es, bks)} carregando={carregando} />}
      {onAbrir && eyebrow && <button type="button" className="go" onClick={onAbrir}>Abrir {eyebrow.nome} →</button>}
    </article>
  );
}

/* ------------------------------------------------------------ Visão geral */
function VisaoGeral({ api, F, per, bks, ir }: { api: IndicadoresApi; F: Filtros; per: Periodo; bks: Bucket[]; ir: (p: Pagina, data?: string) => void }) {
  const t = todayISO();
  const carregando = api.estado === 'loading';
  return (
    <section className="pg">
      <div className="home">
        {HOME.map(([a, id]) => (
          <KpiBox key={a} hk k={kpiDe(a, id)} es={api.dias(a, per.de, per.ate, F.dows)} pes={F.comp ? api.dias(a, per.pde, per.pate, F.dows) : []}
            comp={F.comp} carregando={carregando} eyebrow={{ cod: AREA[a].cod, nome: AREA[a].nome }} onAbrir={() => ir(a)} bks={bks} />
        ))}
        <article className="icard today">
          <h3>Lançamentos de hoje</h3>
          <p className="imuted">Situação da base de cada área na data de hoje.</p>
          <ul>
            {AREAS.map((a) => {
              const ok = !!api.store[a.id][t];
              return (
                <li key={a.id}>
                  <span className="nm"><span className="tag">{a.cod}</span><span>{a.nome}</span></span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                    <span className={`pill ${ok ? 'ok' : 'no'}`}>{ok ? 'Lançado' : 'Pendente'}</span>
                    {api.estado === 'ok' && <button type="button" className="lnk" onClick={() => ir(a.id, t)}>{ok ? 'Revisar' : 'Lançar'}</button>}
                  </span>
                </li>
              );
            })}
          </ul>
        </article>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Área */
function AreaView({ area, api, F, per, bks, g, data, setData }: {
  area: AreaId; api: IndicadoresApi; F: Filtros; per: Periodo; bks: Bucket[]; g: string; data: string; setData: (d: string) => void;
}) {
  const a = AREA[area];
  const N = a.notas;
  const { isAdmin, email } = useAppData();
  const { toast, confirm } = useFeedback();
  const mudarStatusExp = useMudarStatusExp(api);
  const [busca, setBusca] = useState('');
  const [focoNf, setFocoNf] = useState<number | null>(null);
  const limparFoco = useCallback(() => setFocoNf(null), []);
  const carregando = api.estado === 'loading';
  const podeEditar = api.estado === 'ok';
  const es = api.dias(area, per.de, per.ate, F.dows);
  const pes = F.comp ? api.dias(area, per.pde, per.pate, F.dows) : [];
  const gl = { dia: 'por dia', semana: 'por semana', mes: 'por mês' }[g];
  const ix = a.kpis.filter((k) => k.t === 'razao');

  // NFs do período (tabela "Notas … no período")
  const nfShow = (c: NonNullable<typeof N>['campos'][number], v: Nota[string]) => {
    if (c.t === 'date') return v && /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? fdmy(String(v)) : '';
    if (c.t === 'num') return v == null ? '' : fmtInt(Number(v));
    if (c.t === 'sel' && c.opts) { const o = c.opts.find((x) => x[0] === v); return v && o ? o[1] : ''; }
    return String(v ?? '');
  };
  const notasPeriodo = useMemo(() => {
    if (!N) return [];
    const all: (Nota & { _d: string; _i: number })[] = [];
    es.forEach((e) => e.notas.forEach((n, i) => { if (n && typeof n === 'object') all.push({ ...limparNota(N, n), _d: e.d, _i: i }); }));
    const q = busca.trim().toLowerCase();
    return q ? all.filter((n) => N.campos.some((c) => c.t !== 'num' && String(nfShow(c, n[c.k])).toLowerCase().includes(q))) : all;
  }, [es, N, busca]); // eslint-disable-line react-hooks/exhaustive-deps

  async function excluirDia(d: string) {
    if (!(await confirm({ title: `Excluir o lançamento de ${fdmy(d)}?`, text: `${a.nome}: todos os números${N ? ' e a lista de NFs' : ''} deste dia serão apagados.`, danger: true, confirmLabel: 'Excluir' }))) return;
    try { await api.excluir(area, d); toast({ kind: 'success', title: 'Lançamento excluído' }); }
    catch (err) { toast({ kind: 'error', title: 'Não foi possível excluir', text: mensagemErro(err) }); }
  }

  async function excluirNf(d: string, i: number) {
    const l = api.store[area][d];
    if (!l || !N) return;
    const nf = l.notas[i];
    if (!(await confirm({ title: `Excluir a NF ${nf?.nf ?? ''}?`, text: `Ela sai do lançamento de ${fdmy(d)} e os totais do dia são recalculados.`, danger: true, confirmLabel: 'Excluir NF' }))) return;
    const notas = l.notas.filter((_, j) => j !== i);
    try {
      await api.salvar(area, d, valoresFinais(area, l.valores ?? {}, notas, d, api.prazo), notas, email, `Excluiu a NF ${nf?.nf ?? ''} do lançamento de ${a.nome} de ${fdmy(d)}`);
      toast({ kind: 'success', title: `NF excluída do lançamento de ${fdmy(d)}`, text: 'Totais do dia recalculados.' });
    } catch (err) { toast({ kind: 'error', title: 'Não foi possível excluir a NF', text: mensagemErro(err) }); }
  }

  function exportarBase() {
    downloadCsv(`munila-${area}-${per.de}-a-${per.ate}`, ['Data', ...a.todos.map((c) => c.l), ...ix.map((k) => k.l + (k.f === 'pct' ? ' (%)' : k.u ? ` (${k.u})` : ''))],
      es.map((e) => [fdmy(e.d), ...a.todos.map((c) => (isN(e.v[c.k]) ? String(Math.round(e.v[c.k]! * 100) / 100).replace('.', ',') : '')),
        ...ix.map((k) => { const v = calc(k, [e]); return v == null ? '' : String(Math.round(v * 100) / 100).replace('.', ','); })]));
  }
  function exportarNotas() {
    if (!N) return;
    downloadCsv(`munila-${N.arq}-${per.de}-a-${per.ate}`, ['Data', ...N.campos.map((c) => c.l)], notasPeriodo.map((n) => [fdmy(n._d), ...N.campos.map((c) => nfShow(c, n[c.k]))]));
  }

  // Divergências por tipo
  const divs = a.extra ? a.extra.campos.map((c) => ({ l: c.l, v: somaCampos(es, [c.k]) })).sort((p, q) => q.v - p.v) : [];
  const divMax = Math.max(0, ...divs.map((x) => x.v));

  // Volumes por UF (Expedição)
  const porUF = useMemo(() => {
    if (!N?.porUF) return [];
    const m = new Map<string, { nfs: number; vol: number }>();
    notasPeriodo.forEach((n) => { if (!n.uf) return; const x = m.get(String(n.uf)) ?? { nfs: 0, vol: 0 }; x.nfs++; x.vol += Number(n.vol) || 0; m.set(String(n.uf), x); });
    return [...m.entries()].sort((x, y) => y[1].vol - x[1].vol || y[1].nfs - x[1].nfs).slice(0, 8);
  }, [N, notasPeriodo]);
  const ufMax = Math.max(1, ...porUF.map((x) => x[1].vol));

  return (
    <section className="pg">
      <div className="ikpis">
        {a.kpis.map((k) => <KpiBox key={k.id} k={k} es={es} pes={pes} comp={F.comp} carregando={carregando} />)}
      </div>

      <div className="ind-charts">
        {a.kpis.map((k) => (
          <article key={k.id} className="icard">
            <div className="card-h"><h3>{k.l}</h3><span className="imuted gl">{gl}</span></div>
            <Grafico k={k} bks={bks} vals={serie(k, es, bks)} carregando={carregando} />
          </article>
        ))}
        {a.extra && (
          <article className="icard">
            <div className="card-h"><h3>Divergências por tipo</h3><span className="imuted">Ocorrências no período</span></div>
            <div className="bk">
              {!divMax ? <div className="ch-empty">Nenhuma divergência por tipo lançada no período</div> : divs.map((x) => (
                <div className="bk-r" key={x.l}><span>{x.l}</span><div className="bk-t"><div className="bk-b" style={{ width: `${(x.v / divMax) * 100}%` }} /></div><span className="n">{fmtInt(x.v)}</span></div>
              ))}
            </div>
          </article>
        )}
      </div>

      {N && (
        <article className="icard">
          <div className="card-h">
            <div><h3>{N.tabTit}</h3><span className="imuted"> · {notasPeriodo.length} {notasPeriodo.length === 1 ? 'NF' : 'NFs'}{busca ? ' encontradas' : ''} · {fmtInt(notasPeriodo.reduce((t, n) => t + (Number(n.vol) || 0), 0))} volumes</span></div>
            <div className="nt-tools">
              <input type="search" placeholder={N.busca} aria-label={N.busca} value={busca} onChange={(e) => setBusca(e.target.value)} />
              {notasPeriodo.length > 0 && <button type="button" className="ibtn" onClick={exportarNotas}>Exportar NFs</button>}
            </div>
          </div>
          {N.resumo && (
            <div className="st-sum">
              {STATUS_EXP.map(([k, l]) => {
                const n = notasPeriodo.filter((r) => String(r.status || '') === k).length;
                if (!k && !n) return null;
                return <span key={k || 'sem'} className={`st-c st-${k || 'sem'}`}><b>{n}</b> {k ? l : 'Sem status'}</span>;
              })}
            </div>
          )}
          {N.porUF && (
            <>
              <div className="imuted">Volumes expedidos por UF</div>
              <div className="bk">
                {!porUF.length ? <div className="imuted">Sem destinos lançados no período.</div> : porUF.map(([uf, x]) => (
                  <div className="bk-r" key={uf} style={{ gridTemplateColumns: '2.5rem 1fr 7.5rem' }}><span>{uf}</span><div className="bk-t"><div className="bk-b" style={{ width: `${(x.vol / ufMax) * 100}%` }} /></div><span className="n">{fmtInt(x.vol)} vol · {x.nfs} NF</span></div>
                ))}
              </div>
            </>
          )}
          <div className="tw">
            <table className="base">
              <thead><tr><th className="l">{a.dataLabel}</th>{N.campos.map((c) => <th key={c.k} className={c.t === 'num' ? undefined : 'l'}>{c.l}</th>)}<th /></tr></thead>
              <tbody>
                {!notasPeriodo.length ? (
                  <tr><td className="empty-t" colSpan={N.campos.length + 2} style={{ textAlign: 'center', position: 'static' }}>{busca ? 'Nenhuma NF encontrada para essa busca.' : 'Nenhuma NF detalhada neste período. Liste as notas no lançamento diário.'}</td></tr>
                ) : [...notasPeriodo].reverse().map((n) => (
                  <tr key={`${n._d}-${n._i}`} className="row" onClick={() => { setData(n._d); setFocoNf(n._i); }}>
                    <td className="l">{fdmy(n._d)}</td>
                    {N.campos.map((c) => (
                      <td key={c.k} className={c.t === 'num' ? undefined : 'l'}>
                        {c.k === 'status' && podeEditar ? <StatusSelect v={String(n.status ?? '')} onChange={(v) => mudarStatusExp(n._d, n._i, v)} />
                          : c.k === 'div' ? (n.div ? <span className="dv">{nfShow(c, n.div)}</span> : '—') : nfShow(c, n[c.k])}
                      </td>
                    ))}
                    <td className="acts-c" onClick={(e) => e.stopPropagation()}>
                      {podeEditar && <>
                        <button type="button" className="ed" onClick={() => { setData(n._d); setFocoNf(n._i); }}>Editar</button>
                        <button type="button" className="del" onClick={() => excluirNf(n._d, n._i)}>Excluir</button>
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}

      <div className="work">
        <FormLancamento area={area} api={api} data={data} setData={setData} focoNf={focoNf} onFocoNfUsado={limparFoco} />
        <article className="icard">
          <div className="card-h">
            <div><h3>Base de dados</h3><span className="imuted"> · {carregando ? 'carregando…' : `${es.length} ${es.length === 1 ? 'lançamento' : 'lançamentos'}`}</span></div>
            {es.length > 0 && <button type="button" className="ibtn" onClick={exportarBase}>Exportar CSV</button>}
          </div>
          <p className="imuted">Lançamentos do período filtrado. Clique numa linha para editar.</p>
          <div className="tw">
            <table className="base">
              <thead><tr><th>{a.dataLabel}</th>{a.todos.map((c) => <th key={c.k}>{c.l}</th>)}{ix.map((k) => <th key={k.id}>{k.l}</th>)}<th /></tr></thead>
              <tbody>
                {!es.length ? (
                  <tr><td className="empty-t" colSpan={a.todos.length + ix.length + 2} style={{ textAlign: 'center', position: 'static' }}>
                    {carregando ? 'Carregando…' : 'Nenhum lançamento neste período. Use o formulário ao lado para lançar o primeiro dia.'}</td></tr>
                ) : [...es].reverse().map((e) => (
                  <tr key={e.d} className={`row ${e.d === data ? 'sel' : ''}`} onClick={() => setData(e.d)}>
                    <td>{DOW[dow(e.d)]} {fdmy(e.d)}</td>
                    {a.todos.map((c) => <td key={c.k}>{isN(e.v[c.k]) ? (c.dec ? nf2.format(e.v[c.k]!) : fmtInt(e.v[c.k]!)) : ''}</td>)}
                    {ix.map((k) => <td key={k.id} className="ix">{fmt(calc(k, [e]), k.f, k.u)}</td>)}
                    <td className="acts-c" onClick={(ev) => ev.stopPropagation()}>
                      {podeEditar && <>
                        <button type="button" className="ed" onClick={() => setData(e.d)}>Editar</button>
                        {isAdmin && <button type="button" className="del" onClick={() => excluirDia(e.d)}>Excluir</button>}
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- Página */
const NOMES_PAG: Record<Pagina, string> = {
  geral: 'Visão geral', ...Object.fromEntries(AREAS.map((a) => [a.id, a.nome])), transp: ACOMP.transp.tit, clientes: ACOMP.clientes.tit,
} as Record<Pagina, string>;

export default function Indicadores() {
  const { pagina: param } = useParams();
  const navigate = useNavigate();
  const pagina: Pagina = PAGINAS.includes(param as Pagina) ? (param as Pagina) : 'geral';
  const api = useIndicadores();
  const { email } = useAppData();
  const { toast, confirm } = useFeedback();
  const csvRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);

  /** Importa CSVs exportados pelo painel antigo (ou por esta tela). */
  async function importarCsvs(files: FileList) {
    setImportando(true);
    try {
      const lidos: ArquivoLido[] = [];
      for (const f of Array.from(files)) lidos.push(lerCsvIndicadores(f.name, await lerArquivoTexto(f)));
      const plano = planejarImportacao(lidos, api.store, api.prazo);
      if (!plano.registros.length) { toast({ kind: 'info', title: 'Nada novo para importar', text: 'Todos os dias e NFs desses arquivos já estão nos Indicadores Diários.' }); return; }
      const linhasArq = lidos.map((l) => `• ${l.nome.replace(/^[0-9a-f]{8}-/, '')}: ${AREA[l.area].nome} — ${l.tipo === 'nfs' ? `${l.linhas} NF(s)` : `${l.linhas} dia(s)`}`).join('\n');
      const linhasRes = plano.resumo.map((r) => `• ${AREA[r.area].nome}: ${r.dias} dia(s) (${r.novos} novo(s), ${r.mesclados} já existente(s) — mesclados)${r.nfsNovas || r.nfsIgnoradas ? `, ${r.nfsNovas} NF(s) novas${r.nfsIgnoradas ? `, ${r.nfsIgnoradas} já lançadas (ignoradas)` : ''}` : ''}`).join('\n');
      const ok = await confirm({
        title: 'Importar indicadores?',
        text: `Arquivos reconhecidos:\n${linhasArq}\n\nO que será gravado:\n${linhasRes}\n\nNFs que já estão no sistema não são duplicadas e números já lançados não são sobrescritos. Os totais são recalculados pela lista de NFs.`,
        confirmLabel: `Gravar ${plano.registros.length} dia(s)`,
      });
      if (!ok) return;
      const n = await api.importar(plano.registros, email, `Importou CSV do painel antigo: ${plano.resumo.map((r) => `${AREA[r.area].nome} (${r.dias} dias${r.nfsNovas ? `, ${r.nfsNovas} NFs` : ''})`).join('; ')}`);
      toast({ kind: 'success', title: 'Importação concluída', text: `${n} dia(s) gravados nos Indicadores Diários.` });
    } catch (err) {
      toast({ kind: 'error', title: 'Não foi possível importar', text: err instanceof Error && !('code' in err) ? err.message : mensagemErro(err), duration: 12000 });
    } finally {
      setImportando(false);
      if (csvRef.current) csvRef.current.value = '';
    }
  }
  const [F, setFState] = useState<Filtros>(() => ({ ...FILTROS_PADRAO, ...loadPrefRaw<Partial<Filtros>>('ind-filtros', {}) }));
  const setF = (patch: Partial<Filtros>) => setFState((f) => { const n = { ...f, ...patch }; savePref('ind-filtros', n); return n; });
  const [adv, setAdv] = useState(false);
  const [datas, setDatas] = useState<Partial<Record<AreaId, string>>>({});
  const hoje = todayISO();

  const per = periodo(F);
  const g = grupoDe(F, per.n);
  const bks = useMemo(() => buckets(per.de, per.ate, g), [per.de, per.ate, g]);
  const nAdv = (F.grupo !== 'auto' ? 1 : 0) + (F.dows.length < 7 ? 1 : 0) + (!F.comp ? 1 : 0);

  let lbl = (per.de === per.ate ? fdmy(per.de) : `${fdmy(per.de)} a ${fdmy(per.ate)}`) + ` · ${per.n} ${per.n === 1 ? 'dia' : 'dias'}`;
  if (F.dows.length < 7) lbl += ' · só ' + [1, 2, 3, 4, 5, 6, 0].filter((d) => F.dows.includes(d)).map((d) => DOW[d]).join(', ');
  if (F.comp) lbl += ` · comparado com ${fdm(per.pde)} a ${fdm(per.pate)}`;

  const ir = (p: Pagina, data?: string) => {
    if (data && p !== 'geral' && p !== 'transp' && p !== 'clientes') setDatas((d) => ({ ...d, [p]: data }));
    navigate(`/indicadores/${p === 'geral' ? '' : p}`);
    document.getElementById('conteudo')?.scrollTo({ top: 0 });
  };

  const navBtn = (id: Pagina, cod: string, nome: string, status?: boolean) => (
    <button key={id} type="button" className="ind-nav-i" aria-current={pagina === id ? 'page' : undefined} onClick={() => ir(id)}>
      <span className="cod">{cod}</span><span className="nm">{nome}</span>
      {status !== undefined && <span className={`st ${status ? 'on' : ''}`} title="Lançamento de hoje" />}
    </button>
  );

  return (
    <div className="ind">
      <div className="ind-layout">
        <aside className="ind-side" aria-label="Áreas">
          <div className="ind-brand">
            <img src="/favicon.png" alt="" />
            <div><b>Logística</b><small>Indicadores diários</small></div>
          </div>
          <nav className="ind-nav">
            {navBtn('geral', 'PNL', 'Visão geral')}
            {AREAS.map((a) => navBtn(a.id, a.cod, a.nome, !!api.store[a.id][hoje]))}
            <div className="ind-nav-g">Acompanhamento da expedição</div>
            {(Object.keys(ACOMP) as AcompId[]).map((k) => navBtn(k, ACOMP[k].cod, ACOMP[k].nome))}
          </nav>
          <div className="ind-side-foot">
            <span>Hoje, {fdmy(hoje)}</span>
            <span className="lg"><i /> Lançado hoje</span>
            <span className="lg"><i className="off" /> Pendente hoje</span>
          </div>
        </aside>

        <main className="ind-main">
          <header className="top">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <h1>{NOMES_PAG[pagina]}</h1>
                <p className="per">{lbl}</p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input ref={csvRef} type="file" accept=".csv,text/csv" multiple hidden onChange={(e) => { if (e.target.files?.length) importarCsvs(e.target.files); }} />
                <button type="button" className="ibtn" disabled={api.estado !== 'ok' || importando} onClick={() => csvRef.current?.click()}
                  title="Importar CSVs exportados pelo painel antigo (base diária, NFs recebidas, NFs expedidas). Pode escolher vários arquivos.">
                  <Upload size={15} /> {importando ? 'Importando…' : 'Importar CSV'}
                </button>
                <button type="button" className="ibtn" onClick={() => api.recarregar()} title="Buscar lançamentos feitos por outras pessoas"><RotateCw size={15} /> Atualizar</button>
              </div>
            </div>
            <div className="filters">
              <label className="fld"><span>Período</span>
                <select value={F.periodo} onChange={(e) => setF(e.target.value === 'custom' ? { periodo: 'custom', de: per.de, ate: per.ate } : { periodo: e.target.value })}>
                  {PERIODOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className="fld"><span>De</span><input type="date" value={per.de} onChange={(e) => e.target.value && setF({ periodo: 'custom', de: e.target.value, ate: per.ate })} /></label>
              <label className="fld"><span>Até</span><input type="date" value={per.ate} onChange={(e) => e.target.value && setF({ periodo: 'custom', de: per.de, ate: e.target.value })} /></label>
              <button className="ibtn" type="button" aria-expanded={adv} onClick={() => setAdv((v) => !v)}>Filtros avançados {nAdv > 0 && <span className="n">{nAdv}</span>}</button>
            </div>
            {adv && (
              <div className="adv">
                <label className="fld"><span>Agrupar gráficos por</span>
                  <select value={F.grupo} onChange={(e) => setF({ grupo: e.target.value as Filtros['grupo'] })}>
                    <option value="auto">Automático</option><option value="dia">Dia</option><option value="semana">Semana</option><option value="mes">Mês</option>
                  </select>
                </label>
                <fieldset className="fld"><legend>Dias da semana</legend>
                  <div className="ichips">
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                      <label key={d} className="ichip">
                        <input type="checkbox" checked={F.dows.includes(d)} onChange={(e) => {
                          const v = e.target.checked ? [...F.dows, d] : F.dows.filter((x) => x !== d);
                          if (v.length) setF({ dows: v });
                        }} /><span>{DOW[d]}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="chk"><input type="checkbox" checked={F.comp} onChange={(e) => setF({ comp: e.target.checked })} /> Comparar com o período anterior</label>
                <button className="ibtn" type="button" onClick={() => setF({ ...FILTROS_PADRAO })}>Limpar filtros</button>
              </div>
            )}
          </header>

          {api.estado === 'sem_tabela' && (
            <div className="banner err"><p><b>Falta criar as tabelas no Supabase.</b> Abra o Supabase › SQL Editor, cole o conteúdo do arquivo <code>supabase/indicadores_diarios.sql</code> do projeto e clique em Run. Depois clique em Atualizar.</p></div>
          )}
          {api.estado === 'erro' && (
            <div className="banner err"><p>Não foi possível carregar os indicadores. Verifique a conexão e clique em Atualizar.</p></div>
          )}

          {pagina === 'geral' && <VisaoGeral api={api} F={F} per={per} bks={bks} ir={ir} />}
          {pagina in AREA && (
            <AreaView key={pagina} area={pagina as AreaId} api={api} F={F} per={per} bks={bks} g={g}
              data={datas[pagina as AreaId] ?? hoje} setData={(d) => setDatas((x) => ({ ...x, [pagina]: d }))} />
          )}
          {(pagina === 'transp' || pagina === 'clientes') && <section className="pg"><Acompanhamento tipo={pagina} api={api} per={per} /></section>}
        </main>
      </div>
    </div>
  );
}

