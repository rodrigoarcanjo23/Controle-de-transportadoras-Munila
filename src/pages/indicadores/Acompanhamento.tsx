import { useMemo, useState } from 'react';
import {
  ISO, SITL, STATUS_EXP, diasEntre, fdm, fdmy, fmt1, fmtInt, prazoData, situacao, todayISO,
  type AcompId, type NfExp, type Periodo,
} from './config';
import { nfsExpedicao } from './calculos';
import { useMudarStatusExp } from './useMudarStatusExp';
import type { IndicadoresApi } from './useIndicadores';
import { useAppData } from '../../state/context';
import { useFeedback } from '../../feedback/context';
import { mensagemErro } from '../../lib/db';

export function StatusSelect({ v, onChange, disabled }: { v: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <select className={`st-sel ${v === 'coletado' ? 'ok' : ''}`} aria-label="Status da NF" value={STATUS_EXP.some((x) => x[0] === v) ? v : ''}
      disabled={disabled} onChange={(e) => onChange(e.target.value)} onClick={(e) => e.stopPropagation()}>
      {STATUS_EXP.map(([k, l]) => <option key={k} value={k}>{k ? l : 'Sem status'}</option>)}
    </select>
  );
}

function StackBar({ parts }: { parts: [string, number][] }) {
  const tot = parts.reduce((t, p) => t + p[1], 0);
  return <div className="sbar">{tot > 0 && parts.map(([k, v]) => (v ? <i key={k} className={`sw ${k}`} style={{ width: `${(v / tot) * 100}%` }} /> : null))}</div>;
}

function Tile({ lbl, v, cls }: { lbl: string; v: string; cls?: string }) {
  return (
    <article className={`icard ikpi tl ${cls ?? ''}`}>
      <div className="lbl">{cls && <i className="dot2" />}{lbl}</div>
      <div className="val">{v}</div>
    </article>
  );
}

function ListaNfs({ rows, mostrarTransp, prazo, mudarStatus, podeEditar }: {
  rows: NfExp[]; mostrarTransp: boolean; prazo: number; mudarStatus: (d: string, i: number, v: string) => void; podeEditar: boolean;
}) {
  const ord = { atr: 0, pen: 1, col_atr: 2, col_ok: 3 } as const;
  const lista = [...rows].sort((x, y) => ord[situacao(x, prazo)] - ord[situacao(y, prazo)] || (x._d < y._d ? -1 : 1));
  const cols = ['Data do pedido', 'Prazo', 'Dias até a coleta', 'Cliente', 'Pedido', 'NF', 'Volumes', 'Destino', ...(mostrarTransp ? ['Transportadora'] : []), 'Status', 'Situação'];
  return (
    <div className="tw">
      <table className="base">
        <thead><tr>{cols.map((c) => <th key={c} className={c === 'Volumes' || c === 'Dias até a coleta' ? undefined : 'l'}>{c}</th>)}</tr></thead>
        <tbody>
          {!lista.length ? <tr><td className="empty-t" colSpan={cols.length} style={{ textAlign: 'center', position: 'static' }}>Nenhuma NF aqui no período.</td></tr>
            : lista.map((n) => {
              const sit = situacao(n, prazo);
              const col = n.status === 'coletado' && ISO.test(String(n.dt_col || ''));
              const dd = Math.max(0, diasEntre(n._d, col ? String(n.dt_col) : todayISO()));
              return (
                <tr key={`${n._d}-${n._i}`}>
                  <td className="l">{fdmy(n._d)}</td>
                  <td className="l">{fdmy(prazoData(n._d, prazo))}</td>
                  <td className={col ? undefined : 'aging'}>{col ? `${dd} ${dd === 1 ? 'dia' : 'dias'}` : `há ${dd} ${dd === 1 ? 'dia' : 'dias'}`}</td>
                  <td className="l">{n.cliente || '—'}</td>
                  <td className="l">{n.pedido || '—'}</td>
                  <td className="l">{n.nf || '—'}</td>
                  <td>{n.vol == null ? '' : fmtInt(Number(n.vol))}</td>
                  <td className="l">{[n.cidade, n.uf].filter(Boolean).join('/') || '—'}</td>
                  {mostrarTransp && <td className="l">{n.transp || '—'}</td>}
                  <td className="l"><StatusSelect v={String(n.status ?? '')} disabled={!podeEditar} onChange={(v) => mudarStatus(n._d, n._i, v)} /></td>
                  <td className="l"><span className={`sit ${SITL[sit][1]}`}>{SITL[sit][0]}{n.status === 'coletado' && n.dt_col ? ` · ${fdm(String(n.dt_col))}` : ''}</span></td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}

export function Acompanhamento({ tipo, api, per }: { tipo: AcompId; api: IndicadoresApi; per: Periodo }) {
  const { isAdmin } = useAppData();
  const { toast } = useFeedback();
  const mudarStatus = useMudarStatusExp(api);
  const [sel, setSel] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const carregando = api.estado === 'loading';
  const podeEditar = api.estado === 'ok';
  const all = useMemo(() => nfsExpedicao(api.dias('expedicao', per.de, per.ate)), [api, per.de, per.ate]);
  const prazo = api.prazo;
  const num = (v: number) => (carregando ? '…' : fmtInt(v));

  if (tipo === 'transp') {
    const S = all.map((n) => situacao(n, prazo));
    const coletadas = all.filter((n) => n.status === 'coletado' && ISO.test(String(n.dt_col || '')));
    const lead = coletadas.length ? fmt1(coletadas.reduce((t, n) => t + Math.max(0, diasEntre(n._d, String(n.dt_col))), 0) / coletadas.length) + ' dias' : '—';
    const m = new Map<string, { n: number; vol: number; col: number; colok: number; pen: number; atr: number; ls: number; ln: number }>();
    all.forEach((n) => {
      const k = String(n.transp || 'Sem transportadora');
      const x = m.get(k) ?? { n: 0, vol: 0, col: 0, colok: 0, pen: 0, atr: 0, ls: 0, ln: 0 };
      const s = situacao(n, prazo);
      if (n.status === 'coletado' && ISO.test(String(n.dt_col || ''))) { x.ls += Math.max(0, diasEntre(n._d, String(n.dt_col))); x.ln++; }
      x.n++; x.vol += Number(n.vol) || 0;
      if (s === 'col_ok') { x.col++; x.colok++; } else if (s === 'col_atr') x.col++; else if (s === 'pen') x.pen++; else x.atr++;
      m.set(k, x);
    });
    const selAtual = sel && m.has(sel) ? sel : null;
    const lista = [...m.entries()].sort((x, y) => y[1].atr - x[1].atr || y[1].n - x[1].n);
    return (
      <>
        <div className="icard cfg">
          <div className="cfg-r">
            <label className="fld"><span>Prazo de coleta</span>
              <select value={prazo} disabled={!isAdmin || !podeEditar} title={isAdmin ? undefined : 'Somente administradores alteram o prazo'}
                onChange={async (e) => { try { await api.setPrazo(+e.target.value); toast({ kind: 'success', title: 'Prazo de coleta atualizado' }); } catch (err) { toast({ kind: 'error', title: 'Não foi possível alterar o prazo', text: mensagemErro(err) }); } }}>
                {[[0, 'Mesmo dia da NF (D+0)'], [1, '1 dia útil (D+1)'], [2, '2 dias úteis (D+2)'], [3, '3 dias úteis (D+3)'], [5, '5 dias úteis (D+5)']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <p className="imuted">Pendente: ainda não coletada e dentro do prazo. Atrasada: não coletada e com o prazo vencido. O prazo e o tempo até a coleta contam a partir da data do pedido.</p>
          </div>
        </div>
        <div className="ikpis k5">
          <Tile lbl="Total de NFs" v={num(all.length)} />
          <Tile lbl="Coletadas" cls="ok" v={num(S.filter((x) => x === 'col_ok' || x === 'col_atr').length)} />
          <Tile lbl="Pendentes" cls="pen" v={num(S.filter((x) => x === 'pen').length)} />
          <Tile lbl="Atrasadas" cls="bad" v={num(S.filter((x) => x === 'atr').length)} />
          <Tile lbl="Pedido até a coleta (média)" v={carregando ? '…' : lead} />
        </div>
        <article className="icard">
          <div className="card-h"><h3>Transportadoras</h3>
            <div className="lgd">{[['ok', 'Coletadas'], ['pen', 'Pendentes'], ['bad', 'Atrasadas']].map(([k, l]) => <span key={k}><i className={`sw ${k}`} />{l}</span>)}</div>
          </div>
          <p className="imuted">Clique numa transportadora para ver as NFs dela.</p>
          <div className="tw">
            <table className="base">
              <thead><tr>{[['Transportadora', 'l'], ['NFs', ''], ['Volumes', ''], ['Coletadas', ''], ['Pendentes', ''], ['Atrasadas', ''], ['Coletadas no prazo', ''], ['Tempo médio até a coleta', ''], ['', 'l bar-h']].map(([x, c], i) => <th key={i} className={c || undefined}>{x}</th>)}</tr></thead>
              <tbody>
                {!lista.length ? <tr><td className="empty-t" colSpan={9} style={{ textAlign: 'center', position: 'static' }}>{carregando ? 'Carregando…' : 'Nenhuma NF expedida no período. Lance as NFs na Expedição/Separação.'}</td></tr>
                  : lista.map(([k, x]) => (
                    <tr key={k} className={`row ${selAtual === k ? 'sel' : ''}`} onClick={() => setSel(selAtual === k ? null : k)}>
                      <td className="l">{k}</td>
                      {[x.n, x.vol, x.col, x.pen].map((v, i) => <td key={i}>{fmtInt(v)}</td>)}
                      <td className={x.atr ? 'neg' : undefined}>{fmtInt(x.atr)}</td>
                      <td>{x.col ? fmt1((x.colok / x.col) * 100) + '%' : '—'}</td>
                      <td>{x.ln ? fmt1(x.ls / x.ln) + ' dias' : '—'}</td>
                      <td className="l bar-c"><StackBar parts={[['ok', x.col], ['pen', x.pen], ['bad', x.atr]]} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </article>
        <article className="icard">
          <div className="card-h"><h3>{selAtual ? `NFs · ${selAtual}` : 'NFs em aberto (pendentes e atrasadas)'}</h3>
            {selAtual && <button type="button" className="lnk" onClick={() => setSel(null)}>Ver todas em aberto</button>}</div>
          <ListaNfs rows={selAtual ? all.filter((n) => (n.transp || 'Sem transportadora') === selAtual) : all.filter((n) => n.status !== 'coletado')}
            mostrarTransp={!selAtual} prazo={prazo} mudarStatus={mudarStatus} podeEditar={podeEditar} />
        </article>
      </>
    );
  }

  // Por cliente
  const cnt = (k: string) => all.filter((n) => n.status === k).length;
  const m = new Map<string, Record<string, number>>();
  all.forEach((n) => {
    const k = String(n.cliente || 'Sem cliente');
    const x = m.get(k) ?? { n: 0, vol: 0, separacao: 0, separado: 0, cotado: 0, coletado: 0, sem: 0 };
    x.n++; x.vol += Number(n.vol) || 0;
    const s = String(n.status || '');
    if (s && x[s] != null) x[s]++; else x.sem++;
    m.set(k, x);
  });
  const q = busca.trim().toLowerCase();
  const lista = [...m.entries()].filter(([k]) => !q || k.toLowerCase().includes(q)).sort((x, y) => y[1].n - x[1].n || x[0].localeCompare(y[0], 'pt-BR'));
  const selAtual = sel && m.has(sel) ? sel : null;
  return (
    <>
      <div className="ikpis">
        <Tile lbl="Total de NFs" v={num(all.length)} />
        <Tile lbl="Em separação" cls="sep" v={num(cnt('separacao'))} />
        <Tile lbl="Separado" cls="pen" v={num(cnt('separado'))} />
        <Tile lbl="Coletado" cls="ok" v={num(cnt('coletado'))} />
      </div>
      <article className="icard">
        <div className="card-h"><h3>Clientes</h3>
          <input type="search" className="q-in" placeholder="Buscar cliente" aria-label="Buscar cliente" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
        <div className="lgd">{[['sep', 'Em separação'], ['pen', 'Separado'], ['cot', 'Frete cotado'], ['ok', 'Coletado'], ['sem', 'Sem status']].map(([k, l]) => <span key={k}><i className={`sw ${k}`} />{l}</span>)}</div>
        <div className="tw">
          <table className="base">
            <thead><tr>{[['Cliente', 'l'], ['NFs', ''], ['Volumes', ''], ['Em separação', ''], ['Separado', ''], ['Frete cotado', ''], ['Coletado', ''], ['', 'l bar-h']].map(([x, c], i) => <th key={i} className={c || undefined}>{x}</th>)}</tr></thead>
            <tbody>
              {!lista.length ? <tr><td className="empty-t" colSpan={8} style={{ textAlign: 'center', position: 'static' }}>{carregando ? 'Carregando…' : q ? 'Nenhum cliente encontrado.' : 'Nenhuma NF expedida no período.'}</td></tr>
                : lista.map(([k, x]) => (
                  <tr key={k} className={`row ${selAtual === k ? 'sel' : ''}`} onClick={() => setSel(selAtual === k ? null : k)}>
                    <td className="l">{k}</td>
                    {[x.n, x.vol, x.separacao, x.separado, x.cotado, x.coletado].map((v, i) => <td key={i}>{fmtInt(v)}</td>)}
                    <td className="l bar-c"><StackBar parts={[['sep', x.separacao], ['pen', x.separado], ['cot', x.cotado], ['ok', x.coletado], ['sem', x.sem]]} /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </article>
      {selAtual && (
        <article className="icard">
          <div className="card-h"><h3>NFs · {selAtual}</h3><button type="button" className="lnk" onClick={() => setSel(null)}>Fechar</button></div>
          <ListaNfs rows={all.filter((n) => (n.cliente || 'Sem cliente') === selAtual)} mostrarTransp prazo={prazo} mudarStatus={mudarStatus} podeEditar={podeEditar} />
        </article>
      )}
    </>
  );
}

