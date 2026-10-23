import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Download } from 'lucide-react';
import {
  AREA, DOW, ISO, calc, dow, fdm, fdmy, fmt, isN, limparNota, todayISO, TRANSP_PADRAO,
  type AreaId, type CampoNota, type Nota,
} from './config';
import { numOuNulo, valoresFinais } from './calculos';
import type { IndicadoresApi } from './useIndicadores';
import { useAppData } from '../../state/context';
import { useFeedback } from '../../feedback/context';
import { mensagemErro } from '../../lib/db';
import { loadPrefRaw, savePref } from '../../lib/storage';

type NotaForm = Record<string, string>;
const notaParaForm = (n: Nota): NotaForm => Object.fromEntries(Object.entries(n).map(([k, v]) => [k, v == null ? '' : String(v)]));

/**
 * Formulário "Lançamento diário" (coluna esquerda das áreas), com a mesma
 * lógica do painel original: lista de NFs com totais automáticos, prévia dos
 * índices do dia, validações, rascunho salvo e aviso de data diferente de hoje.
 */
export function FormLancamento({ area, api, data, setData, focoNf, onFocoNfUsado }: {
  area: AreaId; api: IndicadoresApi; data: string; setData: (d: string) => void;
  focoNf: number | null; onFocoNfUsado: () => void;
}) {
  const a = AREA[area];
  const N = a.notas;
  const { email, entregas, transportadoras } = useAppData();
  const { toast } = useFeedback();
  const existente = api.store[area][data];

  const [valores, setValores] = useState<Record<string, string>>({});
  const [notas, setNotas] = useState<NotaForm[]>([]);
  const [msg, setMsg] = useState<{ t: string; c: 'ok' | 'err' } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [foco, setFoco] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Carrega o lançamento da data escolhida (ou o rascunho não salvo).
  const [carregado, setCarregado] = useState<string>('');
  const chaveCarga = `${area}|${data}|${existente?.updated_at ?? ''}|${api.estado}`;
  if (carregado !== chaveCarga) {
    const mesmoDia = carregado.startsWith(`${area}|${data}|`);
    setCarregado(chaveCarga);
    const rasc = loadPrefRaw<{ d: string; v: Record<string, string>; n: NotaForm[] } | null>(`ind-rascunho-${area}`, null);
    if (rasc && rasc.d === data && !existente) {
      setValores(rasc.v ?? {}); setNotas(rasc.n ?? []);
      setMsg({ t: 'Rascunho não salvo restaurado. Confira e clique em Salvar.', c: 'ok' });
    } else {
      const v: Record<string, string> = {};
      a.todos.forEach((c) => { const x = existente?.valores?.[c.k]; v[c.k] = isN(x) ? String(x) : ''; });
      setValores(v);
      setNotas(N && existente ? (existente.notas ?? []).map((n) => notaParaForm(limparNota(N, n))) : []);
      if (!mesmoDia) setMsg(null); // mantém "salvo" visível após gravar
    }
    setFoco(null);
  }

  // NF escolhida na tabela "Notas do período": destaca a linha no formulário
  useEffect(() => {
    if (focoNf == null) return;
    const t = setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setFoco(focoNf);
      onFocoNfUsado();
    }, 50);
    return () => clearTimeout(t);
  }, [focoNf, onFocoNfUsado]);

  const rowsNotas: Nota[] = useMemo(() => {
    if (!N) return [];
    return notas.map((r) => {
      const o: Nota = {};
      N.campos.forEach((c) => { const v = r[c.k] ?? ''; o[c.k] = c.t === 'num' ? numOuNulo(v) : v.trim(); });
      return o;
    }).filter((o) => N.campos.some((c) => (c.t === 'num' ? o[c.k] != null : !!o[c.k])));
  }, [notas, N]);

  const auto = !!N && rowsNotas.length > 0;
  const totais = useMemo(() => (N && auto ? N.totais(rowsNotas, data, api.prazo) : {}), [N, auto, rowsNotas, data, api.prazo]);

  const valoresNum = useMemo(() => {
    const v: Record<string, number | null> = {};
    a.todos.forEach((c) => { v[c.k] = auto && c.k in totais ? totais[c.k] : numOuNulo(valores[c.k] ?? ''); });
    return v;
  }, [a, valores, auto, totais]);

  // rascunho automático
  useEffect(() => {
    const t = setTimeout(() => {
      const temAlgo = Object.values(valores).some(Boolean) || notas.length > 0;
      if (temAlgo && !existente) savePref(`ind-rascunho-${area}`, { d: data, v: valores, n: notas });
    }, 400);
    return () => clearTimeout(t);
  }, [valores, notas, area, data, existente]);

  const limparRascunho = () => { try { localStorage.removeItem(`munilalog:ind-rascunho-${area}`); } catch { /* ignore */ } };

  function validar(): string | null {
    if (!ISO.test(data)) return 'Informe a data do lançamento.';
    if (data > todayISO()) return 'A data não pode ser no futuro.';
    for (const c of a.campos) if (!c.opt && valoresNum[c.k] == null) return `Preencha "${c.l}".`;
    for (const c of a.todos) { const v = valoresNum[c.k]; if (v != null && v < 0) return `"${c.l}" não pode ser negativo.`; }
    if (N) {
      const seen = new Set<string>();
      for (let i = 0; i < rowsNotas.length; i++) {
        const n = rowsNotas[i];
        const falta = N.req.filter((k) => !n[k]).map((k) => N.campos.find((c) => c.k === k)!.l.toLowerCase());
        if (falta.length) return `Linha ${i + 1} da lista de NFs: informe ${falta.join(', ')}.`;
        const key = N.chave(n);
        if (seen.has(key)) return `${N.dup(n)} está repetida na lista.`;
        seen.add(key);
      }
    }
    for (const [n, dn, m] of a.checks) { const x = valoresNum[n], y = valoresNum[dn]; if (x != null && y != null && x > y) return m; }
    if (a.extra) {
      const s = a.extra.campos.reduce((t, c) => t + (valoresNum[c.k] ?? 0), 0);
      if (s && !valoresNum.nfs_div) return 'Há divergências por tipo, mas "NFs com divergência" está zerado.';
    }
    return null;
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const err = validar();
    if (err) { setMsg({ t: err, c: 'err' }); return; }
    setSalvando(true);
    try {
      await api.salvar(area, data, valoresFinais(area, valoresNum, rowsNotas, data, api.prazo), rowsNotas, email);
      limparRascunho();
      setMsg({ t: `Lançamento de ${fdmy(data)} salvo.`, c: 'ok' });
      toast({ kind: 'success', title: `${a.nome}: ${fdmy(data)} salvo` });
    } catch (x) {
      setMsg({ t: mensagemErro(x, 'Não foi possível salvar agora. Tente de novo em instantes.'), c: 'err' });
    } finally { setSalvando(false); }
  }

  /** Expedição: traz as NFs do Painel de Entregas cuja data de entrada do pedido é esta data. */
  function importarDoPainel() {
    const doDia = entregas.filter((e) => e.data_entrada_pedido === data);
    if (!doDia.length) { toast({ kind: 'warning', title: 'Nenhuma entrega no Painel com essa data de pedido', text: `Data do pedido: ${fdmy(data)}` }); return; }
    const ja = new Set(notas.map((n) => (n.nf ?? '').trim()));
    const novas: NotaForm[] = doDia.filter((e) => !ja.has(String(e.nota_fiscal).trim())).map((e) => ({
      cliente: e.clientes?.nome ?? '', pedido: '', nf: String(e.nota_fiscal), vol: e.volume != null ? String(e.volume) : '',
      transp: e.transportadoras?.nome ?? '', cidade: e.cidade_destino || e.clientes?.cidade || '', uf: e.uf_destino || e.clientes?.uf || '',
      status: e.data_coleta ? 'coletado' : e.status === 'Aguardando coleta' ? 'separado' : '', dt_col: e.data_coleta ?? '',
    }));
    if (!novas.length) { toast({ kind: 'info', title: 'Todas as NFs desse dia já estão na lista.' }); return; }
    setNotas((l) => [...l, ...novas]);
    toast({ kind: 'success', title: `${novas.length} NF(s) importadas do Painel de Entregas`, text: 'Confira os dados (nº do pedido e status) e clique em Salvar.' });
  }

  const opcoesTransp = useMemo(() => {
    const s = new Set<string>([...transportadoras.map((t) => t.nome), ...TRANSP_PADRAO]);
    notas.forEach((n) => { if (n.transp) s.add(n.transp); });
    return [...s].sort((x, y) => x.localeCompare(y, 'pt-BR'));
  }, [transportadoras, notas]);

  const sugestoes = useMemo(() => {
    const out: Record<string, string[]> = {};
    if (!N) return out;
    N.campos.filter((c) => c.sug).forEach((c) => {
      const m = new Map<string, string>();
      Object.values(api.store[area]).forEach((l) => (l.notas ?? []).forEach((n) => {
        const f = typeof n[c.k] === 'string' ? String(n[c.k]).trim() : '';
        if (f && !m.has(f.toLowerCase())) m.set(f.toLowerCase(), f);
      }));
      if (c.k === 'cliente') entregas.forEach((e) => { const f = e.clientes?.nome; if (f && !m.has(f.toLowerCase())) m.set(f.toLowerCase(), f); });
      out[c.k] = [...m.values()].sort((x, y) => x.localeCompare(y, 'pt-BR')).slice(0, 500);
    });
    return out;
  }, [N, api.store, area, entregas]);

  const campoNota = (c: CampoNota, r: NotaForm, i: number) => {
    const set = (v: string) => setNotas((l) => l.map((x, j) => {
      if (j !== i) return x;
      const o = { ...x, [c.k]: v };
      if (c.k === 'status') { if (v === 'coletado' && !o.dt_col) o.dt_col = todayISO(); else if (v !== 'coletado') o.dt_col = ''; }
      return o;
    }));
    const st = { gridColumn: `span ${c.sp}` };
    if (c.t === 'sel') {
      const opts: [string, string][] = c.transp ? [['', 'Transportadora'], ...opcoesTransp.map((t) => [t, t] as [string, string])] : c.opts!;
      return <select key={c.k} style={st} aria-label={c.l} value={r[c.k] ?? ''} onChange={(e) => set(e.target.value)}>{opts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>;
    }
    if (c.t === 'date') return <input key={c.k} style={st} type="date" title={c.l} aria-label={c.l} value={r[c.k] ?? ''} onChange={(e) => set(e.target.value)} />;
    return (
      <input key={c.k} style={st} aria-label={c.l} placeholder={c.ph ?? c.l} value={r[c.k] ?? ''}
        type={c.t === 'num' ? 'number' : 'text'} min={c.t === 'num' ? 0 : undefined} inputMode={c.num || c.t === 'num' ? 'numeric' : undefined}
        list={c.sug ? `ind-dl-${area}-${c.k}` : undefined} maxLength={c.num ? 20 : 120} onChange={(e) => set(e.target.value)} />
    );
  };

  const ixDia = a.kpis.filter((k) => k.t === 'razao');
  const diaPrev = { d: data, v: valoresFinais(area, valoresNum, rowsNotas, data, api.prazo), notas: [] };
  const hoje = todayISO();
  const podeImportar = area === 'expedicao';

  return (
    <article className="icard">
      <div className="card-h">
        <h3>Lançamento diário</h3>
        <span className="mode">{existente ? `Editando ${fdm(data)}` : 'Novo lançamento'}</span>
      </div>
      <form className="form" onSubmit={salvar} noValidate ref={formRef}>
        <label className="fld"><span>{a.dataLabel}</span>
          <input type="date" required value={data} max={hoje} onChange={(e) => { if (ISO.test(e.target.value)) setData(e.target.value); }} />
        </label>
        {data !== hoje && ISO.test(data) && (
          <p className="dwarn">Atenção: este lançamento é do dia {fdmy(data)} ({DOW[dow(data)]}), não de hoje.{' '}
            <button type="button" className="lnk" onClick={() => setData(hoje)}>Voltar para hoje</button></p>
        )}

        {N && (
          <div className="nfs">
            <div className="nfs-h"><span>{N.tit}</span><small>{N.dica}</small></div>
            {foco != null && notas.length > 1 && (
              <div className="nf-focus"><span>Editando só a NF {notas[foco]?.nf || 'selecionada'}. As outras {notas.length - 1} NFs do dia continuam salvas.</span>
                <button type="button" className="lnk" onClick={() => setFoco(null)}>Mostrar todas as NFs do dia</button></div>
            )}
            <div className="nfs-list">
              {notas.map((r, i) => (
                <div key={i} className={`nf ${foco != null && notas.length > 1 && foco !== i ? 'nf-off' : ''} ${foco === i ? 'hl' : ''}`}>
                  {N.campos.map((c, ix) => (
                    <span key={c.k} style={{ display: 'contents' }}>
                      {campoNota(c, r, i)}
                      {ix === 0 && <button type="button" className="nf-x" aria-label="Remover NF" onClick={() => { setNotas((l) => l.filter((_, j) => j !== i)); setFoco(null); }}>×</button>}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <div className="nf-imp">
              <button type="button" className="ibtn" onClick={() => { setNotas((l) => [...l, {}]); setFoco(null); }}>+ Adicionar NF</button>
              {podeImportar && <button type="button" className="ibtn" onClick={importarDoPainel} title="Traz as NFs do Painel de Entregas com esta data de entrada do pedido"><Download size={15} /> Importar do Painel de Entregas</button>}
            </div>
            {N.campos.filter((c) => c.sug).map((c) => (
              <datalist key={c.k} id={`ind-dl-${area}-${c.k}`}>{(sugestoes[c.k] ?? []).map((f) => <option key={f} value={f} />)}</datalist>
            ))}
          </div>
        )}
        {auto && N && <p className="nf-auto">{N.auto}</p>}

        {a.campos.map((c) => (
          <label key={c.k} className="fld"><span>{c.l}</span>
            <input type="number" min={0} step={c.dec ? (c.dec === 2 ? '0.01' : '0.1') : '1'} inputMode={c.dec ? 'decimal' : 'numeric'}
              readOnly={auto && c.k in totais} value={auto && c.k in totais ? String(totais[c.k]) : valores[c.k] ?? ''}
              onChange={(e) => setValores((v) => ({ ...v, [c.k]: e.target.value }))} />
            {c.h && <small>{c.h}</small>}
          </label>
        ))}
        {a.extra && (
          <fieldset><legend>{a.extra.t}</legend>
            {a.extra.campos.map((c) => (
              <label key={c.k} className="fld"><span>{c.l}</span>
                <input type="number" min={0} inputMode="numeric" readOnly={auto && c.k in totais}
                  value={auto && c.k in totais ? String(totais[c.k]) : valores[c.k] ?? ''}
                  onChange={(e) => setValores((v) => ({ ...v, [c.k]: e.target.value }))} />
              </label>
            ))}
          </fieldset>
        )}

        {ixDia.length > 0 && (
          <div className="prev"><span className="imuted">Índices do dia</span>
            {ixDia.map((k) => <div key={k.id}><span>{k.l}</span><b>{fmt(calc(k, [diaPrev]), k.f, k.u)}</b></div>)}
          </div>
        )}
        <p className={`msg ${msg?.c ?? ''}`} role="status">{msg?.t}</p>
        <div className="acts">
          <button type="submit" className="ibtn pri" disabled={salvando || api.estado !== 'ok'}>{salvando ? 'Salvando…' : existente ? 'Atualizar lançamento' : 'Salvar lançamento'}</button>
          <button type="button" className="ibtn" onClick={() => { limparRascunho(); setCarregado(''); setData(hoje); }}>Limpar</button>
        </div>
      </form>
    </article>
  );
}
