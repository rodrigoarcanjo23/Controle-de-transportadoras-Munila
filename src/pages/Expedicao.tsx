import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CircleCheck, ClipboardList, PackageCheck, Printer, ScanBarcode, TriangleAlert, Truck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { mensagemErro, registrarLog } from '../lib/db';
import { acharEntrega, lerCodigo } from '../lib/codigoBarras';
import { cidadeDestino, ufDestino } from '../lib/filtrosEntrega';
import { formatDate, formatDateTimeBR, formatMoney, hojeISO, toNumber } from '../lib/format';
import { loadPrefRaw, savePref } from '../lib/storage';
import { useAppData } from '../state/context';
import { useFeedback } from '../feedback/context';
import { EmptyState, PageHeader } from '../components/ui/basics';
import { CameraLeitor } from './expedicao/Camera';
import type { Entrega } from '../types';
import './bi/bi.css';
import './financeiro/financeiro.css';
import './expedicao/expedicao.css';

interface Romaneio {
  id: string; numero: number; transportadora_id: string; entregas: string[]; motorista?: string | null; placa?: string | null;
  observacao?: string | null; criado_por?: string | null; created_at: string; coletado_em?: string | null;
}
type Aba = 'montar' | 'conferir' | 'romaneios';
const FINAIS = new Set(['Entregue', 'Devolvido', 'Devolução', 'Em devolução']);

/** Bip curto de confirmação/erro e vibração (no celular). */
function bip(ok: boolean) {
  try {
    const ctx = new AudioContext(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = ok ? 880 : 220; g.gain.value = 0.08; o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + (ok ? 0.08 : 0.3));
    setTimeout(() => ctx.close(), 500);
  } catch { /* sem áudio */ }
  try { navigator.vibrate?.(ok ? 40 : [80, 60, 80]); } catch { /* sem vibração */ }
}

export default function Expedicao() {
  const { entregas, transportadoras, email, setEntregas } = useAppData();
  const { toast } = useFeedback();
  const [aba, setAbaState] = useState<Aba>(() => loadPrefRaw<Aba>('expAba', 'montar'));
  const setAba = (a: Aba) => { setAbaState(a); savePref('expAba', a); };
  const [romaneios, setRomaneios] = useState<Romaneio[] | null>(null);
  const [semTabela, setSemTabela] = useState(false);
  const [imprimir, setImprimir] = useState<Romaneio | null>(null);
  const [conferindo, setConferindo] = useState<string>(''); // id do romaneio ou 'avulso'

  const carregar = useCallback(async () => {
    const desde = new Date(Date.now() - 60 * 864e5).toISOString();
    const { data, error } = await supabase.from('romaneios').select('*').gte('created_at', desde).order('numero', { ascending: false });
    if (error) { setSemTabela(true); setRomaneios([]); return; }
    setRomaneios((data ?? []) as Romaneio[]);
  }, []);
  // busca assíncrona: os setState ocorrem após o await
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar(); }, [carregar]);

  // impressão: só o romaneio aparece no papel
  useEffect(() => {
    if (!imprimir) return;
    document.documentElement.classList.add('print-romaneio');
    const t = setTimeout(() => window.print(), 300);
    const fim = () => { document.documentElement.classList.remove('print-romaneio'); setImprimir(null); };
    window.addEventListener('afterprint', fim, { once: true });
    return () => { clearTimeout(t); window.removeEventListener('afterprint', fim); document.documentElement.classList.remove('print-romaneio'); };
  }, [imprimir]);

  const pendentes = useMemo(() => entregas.filter((e) => !e.data_coleta && !FINAIS.has(e.status) && e.data_faturamento), [entregas]);
  const porId = useMemo(() => new Map(entregas.map((e) => [String(e.id), e])), [entregas]);
  const nomeTransp = (id?: string | null) => transportadoras.find((t) => String(t.id) === String(id))?.nome ?? '—';

  if (semTabela) {
    return (
      <div className="page">
        <PageHeader icon={<PackageCheck size={22} />} title="Expedição" subtitle="Romaneio de coleta e conferência do carregamento" />
        <div className="card card-pad bi-vazio"><TriangleAlert size={26} /><div><strong>Falta um passo no Supabase.</strong><p className="muted">Rode o arquivo <code>supabase/fase1_portal_frete_expedicao.sql</code> (SQL Editor › Run) para liberar os romaneios.</p></div></div>
      </div>
    );
  }

  return (
    <div className="page fin">
      <PageHeader icon={<PackageCheck size={22} />} title="Expedição" subtitle="Monte o romaneio da coleta, confira o carregamento lendo o código de barras das NFs e registre a coleta" />

      <div className="fin-tabs no-print" role="tablist">
        {([['montar', 'Montar romaneio'], ['conferir', 'Conferir carregamento'], ['romaneios', 'Romaneios']] as [Aba, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={aba === k} className={`fin-tab ${aba === k ? 'is-on' : ''}`} onClick={() => setAba(k)}>{l}</button>
        ))}
      </div>

      {aba === 'montar' && <Montar pendentes={pendentes} email={email} nomeTransp={nomeTransp}
        onCriado={async (r) => { await carregar(); setImprimir(r); setConferindo(r.id); toast({ kind: 'success', title: `Romaneio nº ${r.numero} criado`, text: 'Imprima e depois confira o carregamento.' }); }} />}

      {aba === 'conferir' && <Conferir romaneios={(romaneios ?? []).filter((r) => !r.coletado_em)} conferindo={conferindo} setConferindo={setConferindo}
        porId={porId} pendentes={pendentes} nomeTransp={nomeTransp}
        onConfirmado={async (ids, data) => {
          setEntregas((l) => l.map((e) => (ids.includes(String(e.id)) && !e.data_coleta && !FINAIS.has(e.status)
            ? { ...e, data_coleta: data, status: ['Pendente', 'Aguardando coleta', 'Frete Conferido'].includes(e.status) ? 'Em Transporte' : e.status } : e)));
          await carregar(); setConferindo('');
        }} />}

      {aba === 'romaneios' && (
        romaneios === null ? <p className="muted">Carregando…</p> : !romaneios.length ? <div className="card"><EmptyState icon={<ClipboardList size={30} />} title="Nenhum romaneio nos últimos 60 dias" /></div> : (
          <div className="card bi-ranking">
            <div className="table-scroll">
              <table className="bi-tabela">
                <thead><tr><th>Nº</th><th>Criado em</th><th>Transportadora</th><th className="r">NFs</th><th className="r">Volumes</th><th>Motorista / placa</th><th>Situação</th><th /></tr></thead>
                <tbody>
                  {romaneios.map((r) => {
                    const es = r.entregas.map((id) => porId.get(id)).filter(Boolean) as Entrega[];
                    return (
                      <tr key={r.id}>
                        <td className="strong">{r.numero}</td>
                        <td>{formatDateTimeBR(r.created_at)}</td>
                        <td>{nomeTransp(r.transportadora_id)}</td>
                        <td className="r">{r.entregas.length}</td>
                        <td className="r">{es.reduce((s, e) => s + toNumber(e.volume), 0)}</td>
                        <td>{[r.motorista, r.placa].filter(Boolean).join(' · ') || <span className="muted">—</span>}</td>
                        <td>{r.coletado_em ? <span className="badge tone-green">Coletado {formatDateTimeBR(r.coletado_em)}</span> : <span className="badge tone-amber">Aguardando coleta</span>}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn btn-sm" onClick={() => setImprimir(r)}><Printer size={14} /> Imprimir</button>{' '}
                          {!r.coletado_em && <button className="btn btn-sm btn-primary" onClick={() => { setConferindo(r.id); setAba('conferir'); }}><ScanBarcode size={14} /> Conferir</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {imprimir && <RomaneioImpresso r={imprimir} entregas={imprimir.entregas.map((id) => porId.get(id)).filter(Boolean) as Entrega[]} transportadora={nomeTransp(imprimir.transportadora_id)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Montar romaneio                                                      */
/* ------------------------------------------------------------------ */
function Montar({ pendentes, email, nomeTransp, onCriado }: {
  pendentes: Entrega[]; email: string; nomeTransp: (id?: string | null) => string; onCriado: (r: Romaneio) => void;
}) {
  const { toast } = useFeedback();
  const porTransp = useMemo(() => {
    const m = new Map<string, Entrega[]>();
    pendentes.forEach((e) => { const k = String(e.transportadora_id ?? ''); if (k) m.set(k, [...(m.get(k) ?? []), e]); });
    return [...m].sort((a, b) => b[1].length - a[1].length);
  }, [pendentes]);
  const [transp, setTransp] = useState('');
  const atual = transp || porTransp[0]?.[0] || '';
  const lista = useMemo(() => (porTransp.find(([k]) => k === atual)?.[1] ?? []).sort((a, b) => (a.data_faturamento ?? '').localeCompare(b.data_faturamento ?? '')), [porTransp, atual]);
  const [fora, setFora] = useState<Set<string>>(new Set()); // desmarcadas
  const [motorista, setMotorista] = useState('');
  const [placa, setPlaca] = useState('');
  const [salvando, setSalvando] = useState(false);
  const escolhidas = lista.filter((e) => !fora.has(String(e.id)));
  const tot = escolhidas.reduce((t, e) => ({ vol: t.vol + toNumber(e.volume), peso: t.peso + toNumber(e.peso_kg), valor: t.valor + toNumber(e.valor_nf) }), { vol: 0, peso: 0, valor: 0 });

  async function gerar() {
    if (!escolhidas.length) return;
    setSalvando(true);
    const { data, error } = await supabase.from('romaneios').insert({
      transportadora_id: atual, entregas: escolhidas.map((e) => String(e.id)), motorista: motorista || null, placa: placa.toUpperCase() || null, criado_por: email,
    }).select('*').single();
    setSalvando(false);
    if (error) { toast({ kind: 'error', title: 'Não foi possível criar o romaneio', text: mensagemErro(error) }); return; }
    registrarLog('CRIOU', 'ENTREGAS', `Criou o romaneio de coleta nº ${(data as Romaneio).numero} (${nomeTransp(atual)}): NF ${escolhidas.map((e) => e.nota_fiscal).join(', ')}`);
    setFora(new Set()); setMotorista(''); setPlaca('');
    onCriado(data as Romaneio);
  }

  if (!porTransp.length) return <div className="card"><EmptyState icon={<CircleCheck size={30} />} title="Nenhuma NF aguardando coleta" text="Todas as NFs faturadas já têm data de coleta." /></div>;
  return (
    <div className="exp-montar">
      <div className="fin-abas">
        {porTransp.map(([k, es]) => (
          <button key={k} className={`fin-aba ${k === atual ? 'is-on' : ''}`} onClick={() => { setTransp(k); setFora(new Set()); }}><Truck size={14} /> {nomeTransp(k)}<b>{es.length}</b></button>
        ))}
      </div>
      <div className="exp-montar__grid">
        <div className="card bi-ranking">
          <div className="table-scroll" style={{ maxHeight: 560 }}>
            <table className="bi-tabela">
              <thead><tr>
                <th style={{ width: 34 }}><input type="checkbox" checked={!fora.size} onChange={() => setFora(fora.size ? new Set() : new Set(lista.map((e) => String(e.id))))} aria-label="Marcar todas" /></th>
                <th>NF</th><th>Cliente</th><th>Destino</th><th>Faturamento</th><th className="r">Vol.</th><th className="r">Peso</th><th>Status</th>
              </tr></thead>
              <tbody>
                {lista.map((e) => {
                  const id = String(e.id); const on = !fora.has(id);
                  return (
                    <tr key={id} className={on ? 'is-sel' : ''} onClick={() => setFora((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; })} style={{ cursor: 'pointer' }}>
                      <td><input type="checkbox" checked={on} readOnly aria-label={`NF ${e.nota_fiscal}`} /></td>
                      <td className="strong">NF {e.nota_fiscal}</td>
                      <td>{e.clientes?.nome ?? '—'}</td>
                      <td>{cidadeDestino(e)} <b>{ufDestino(e)}</b></td>
                      <td>{formatDate(e.data_faturamento)}</td>
                      <td className="r">{toNumber(e.volume) || '—'}</td>
                      <td className="r">{e.peso_kg ? `${toNumber(e.peso_kg).toLocaleString('pt-BR')} kg` : '—'}</td>
                      <td><span className="badge tone-slate">{e.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card card-pad exp-resumo">
          <h3>Romaneio · {nomeTransp(atual)}</h3>
          <div className="exp-resumo__nums">
            <div><strong>{escolhidas.length}</strong><span>NFs</span></div>
            <div><strong>{tot.vol}</strong><span>volumes</span></div>
            <div><strong>{tot.peso.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</strong><span>kg</span></div>
          </div>
          <div className="muted" style={{ fontSize: '0.84rem' }}>Valor das NFs: {formatMoney(tot.valor)}</div>
          <div className="field"><label>Motorista (opcional)</label><input className="input" value={motorista} onChange={(e) => setMotorista(e.target.value)} /></div>
          <div className="field"><label>Placa (opcional)</label><input className="input" value={placa} onChange={(e) => setPlaca(e.target.value)} maxLength={8} style={{ textTransform: 'uppercase' }} /></div>
          <button className="btn btn-primary" disabled={!escolhidas.length || salvando} onClick={gerar}><Printer size={16} /> {salvando ? 'Criando…' : 'Gerar e imprimir romaneio'}</button>
          <p className="muted" style={{ fontSize: '0.78rem' }}>Depois de impresso, confira o carregamento lendo o código de barras de cada NF (aba "Conferir carregamento").</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Conferir carregamento (leitor USB/Bluetooth, câmera ou digitação)    */
/* ------------------------------------------------------------------ */
interface Leitura { t: string; ok: boolean; msg: string }

function Conferir({ romaneios, conferindo, setConferindo, porId, pendentes, nomeTransp, onConfirmado }: {
  romaneios: Romaneio[]; conferindo: string; setConferindo: (id: string) => void; porId: Map<string, Entrega>; pendentes: Entrega[];
  nomeTransp: (id?: string | null) => string; onConfirmado: (ids: string[], data: string) => Promise<void>;
}) {
  const { toast, confirm } = useFeedback();
  const rom = romaneios.find((r) => r.id === conferindo) ?? null;
  const avulso = conferindo === 'avulso';
  const esperadas = useMemo(() => (rom ? rom.entregas.map((id) => porId.get(id)).filter(Boolean) as Entrega[] : []), [rom, porId]);
  const [ok, setOk] = useState<Set<string>>(new Set());
  const [log, setLog] = useState<Leitura[]>([]);
  const [texto, setTexto] = useState('');
  const [camera, setCamera] = useState(false);
  const [data, setData] = useState(hojeISO());
  const [salvando, setSalvando] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [chaveSessao, setChaveSessao] = useState(conferindo);
  if (chaveSessao !== conferindo) { setChaveSessao(conferindo); setOk(new Set()); setLog([]); }

  const registrar = (t: string) => {
    const l = lerCodigo(t);
    const add = (x: Leitura) => setLog((v) => [x, ...v].slice(0, 30));
    if (!l) { bip(false); add({ t, ok: false, msg: 'Código não reconhecido' }); return; }
    const base = avulso ? pendentes : esperadas;
    const e = acharEntrega(base, l.nf);
    if (!e) {
      const outra = acharEntrega([...porId.values()], l.nf);
      bip(false);
      add({ t, ok: false, msg: outra ? `NF ${l.nf} não é ${avulso ? 'pendente de coleta' : 'deste romaneio'} (${outra.transportadoras?.nome ?? 'sem transportadora'} · ${outra.status})` : `NF ${l.nf} não encontrada no Painel` });
      return;
    }
    const id = String(e.id);
    if (ok.has(id)) { bip(true); add({ t, ok: true, msg: `NF ${e.nota_fiscal} já conferida` }); return; }
    setOk((s) => new Set(s).add(id)); bip(true);
    add({ t, ok: true, msg: `NF ${e.nota_fiscal} · ${e.clientes?.nome ?? ''} — conferida` });
  };

  const lista = avulso ? pendentes.filter((e) => ok.has(String(e.id))) : esperadas;
  const faltam = esperadas.filter((e) => !ok.has(String(e.id)));

  async function confirmar() {
    const ids = [...ok];
    if (!ids.length) return;
    if (!avulso && faltam.length && !(await confirm({ title: `Faltam ${faltam.length} NF(s)`, text: `Não foram lidas: ${faltam.map((e) => e.nota_fiscal).join(', ')}.\nConfirmar a coleta só das ${ids.length} conferidas? As que faltam continuam aguardando coleta.`, confirmLabel: 'Confirmar mesmo assim' }))) return;
    setSalvando(true);
    const { data: n, error } = await supabase.rpc('registrar_coleta', { p_ids: ids, p_data: data, p_romaneio: rom?.id ?? null });
    setSalvando(false);
    if (error) { toast({ kind: 'error', title: 'Não foi possível registrar a coleta', text: mensagemErro(error) }); return; }
    toast({ kind: 'success', title: `Coleta registrada em ${n} NF(s)`, text: `Data de coleta ${formatDate(data)} · status "Em Transporte"` });
    if (rom) registrarLog('EDITOU', 'ENTREGAS', `Conferiu o romaneio nº ${rom.numero}: ${ids.length} de ${esperadas.length} NFs lidas`);
    await onConfirmado(ids, data);
  }

  return (
    <div className="exp-conf">
      <div className="card card-pad exp-conf__top">
        <div className="field">
          <label>Conferir</label>
          <select className="select" value={conferindo} onChange={(e) => setConferindo(e.target.value)}>
            <option value="">Escolha um romaneio…</option>
            {romaneios.map((r) => <option key={r.id} value={r.id}>Romaneio nº {r.numero} · {nomeTransp(r.transportadora_id)} · {r.entregas.length} NFs</option>)}
            <option value="avulso">Sem romaneio (ler NFs avulsas)</option>
          </select>
        </div>
        {(rom || avulso) && (
          <>
            <form className="exp-conf__leitor" onSubmit={(ev) => { ev.preventDefault(); if (texto.trim()) registrar(texto); setTexto(''); input.current?.focus(); }}>
              <ScanBarcode size={22} />
              <input ref={input} autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Leia o código de barras do DANFE (leitor) ou digite o nº da NF e Enter" inputMode="numeric" />
              <button type="button" className="btn" onClick={() => setCamera(true)}><Camera size={16} /> Câmera</button>
            </form>
            <div className="exp-conf__prog">
              <span><strong>{ok.size}</strong>{!avulso && <> de <strong>{esperadas.length}</strong></>} NF(s) conferida(s)</span>
              {!avulso && <div className="bi-progress"><i style={{ width: `${esperadas.length ? (ok.size / esperadas.length) * 100 : 0}%`, background: 'var(--green-solid)' }} /></div>}
            </div>
          </>
        )}
      </div>

      {(rom || avulso) && (
        <div className="exp-conf__grid">
          <div className="card bi-ranking">
            <div className="table-scroll" style={{ maxHeight: 520 }}>
              <table className="bi-tabela">
                <thead><tr><th /><th>NF</th><th>Cliente</th><th>Destino</th><th className="r">Vol.</th></tr></thead>
                <tbody>
                  {lista.map((e) => {
                    const feito = ok.has(String(e.id));
                    return (
                      <tr key={e.id} className={feito ? 'exp-ok' : ''}>
                        <td>{feito ? <CircleCheck size={18} className="text-green" /> : <span className="exp-pend" />}</td>
                        <td className="strong">NF {e.nota_fiscal}</td>
                        <td>{e.clientes?.nome ?? '—'}</td>
                        <td>{cidadeDestino(e)} <b>{ufDestino(e)}</b></td>
                        <td className="r">{toNumber(e.volume) || '—'}</td>
                      </tr>
                    );
                  })}
                  {!lista.length && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 24 }}>Leia a primeira NF…</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="exp-conf__lado">
            <div className="card card-pad">
              <h3 style={{ fontSize: '0.95rem', marginBottom: 8 }}>Últimas leituras</h3>
              <ul className="exp-log">
                {log.map((l, i) => <li key={i} className={l.ok ? 'is-ok' : 'is-erro'}>{l.ok ? <CircleCheck size={15} /> : <TriangleAlert size={15} />}<span>{l.msg}</span></li>)}
                {!log.length && <li className="muted">Nenhuma leitura ainda.</li>}
              </ul>
            </div>
            <div className="card card-pad exp-conf__fim">
              <div className="field"><label>Data da coleta</label><input type="date" className="input" value={data} max={hojeISO()} onChange={(e) => setData(e.target.value)} /></div>
              <button className="btn btn-primary" disabled={!ok.size || salvando} onClick={confirmar}><PackageCheck size={16} /> {salvando ? 'Registrando…' : `Confirmar coleta de ${ok.size} NF(s)`}</button>
              <small className="muted">Grava a data de coleta e muda o status para "Em Transporte". Fica no histórico de cada NF.</small>
            </div>
          </div>
        </div>
      )}
      {camera && <CameraLeitor onLer={registrar} onClose={() => { setCamera(false); input.current?.focus(); }} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Romaneio para impressão                                              */
/* ------------------------------------------------------------------ */
function RomaneioImpresso({ r, entregas, transportadora }: { r: Romaneio; entregas: Entrega[]; transportadora: string }) {
  const tot = entregas.reduce((t, e) => ({ vol: t.vol + toNumber(e.volume), peso: t.peso + toNumber(e.peso_kg), valor: t.valor + toNumber(e.valor_nf) }), { vol: 0, peso: 0, valor: 0 });
  return (
    <div className="romaneio-print">
      <div className="rp__top">
        <img src="/favicon.png" alt="" />
        <div><h1>Romaneio de coleta nº {r.numero}</h1><p>Munila · emitido em {formatDateTimeBR(r.created_at)}{r.criado_por ? ` por ${r.criado_por}` : ''}</p></div>
        <div className="rp__transp"><span>Transportadora</span><strong>{transportadora}</strong></div>
      </div>
      <table className="rp__tab">
        <thead><tr><th>#</th><th>NF</th><th>Cliente</th><th>Cidade / UF</th><th>Volumes</th><th>Peso (kg)</th><th>Valor NF</th><th>Conf.</th></tr></thead>
        <tbody>
          {entregas.map((e, i) => (
            <tr key={e.id}><td>{i + 1}</td><td>{e.nota_fiscal}</td><td>{e.clientes?.nome ?? ''}</td><td>{cidadeDestino(e)} / {ufDestino(e)}</td>
              <td>{toNumber(e.volume) || ''}</td><td>{e.peso_kg ? toNumber(e.peso_kg).toLocaleString('pt-BR') : ''}</td><td>{formatMoney(e.valor_nf)}</td><td>☐</td></tr>
          ))}
        </tbody>
        <tfoot><tr><td colSpan={4}>Total: {entregas.length} NF(s)</td><td>{tot.vol}</td><td>{tot.peso.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td><td>{formatMoney(tot.valor)}</td><td /></tr></tfoot>
      </table>
      <div className="rp__assin">
        <div><span>Motorista</span><b>{r.motorista ?? ''}</b></div>
        <div><span>Placa</span><b>{r.placa ?? ''}</b></div>
        <div><span>Documento (RG/CPF)</span><b /></div>
        <div><span>Data e hora da coleta</span><b /></div>
      </div>
      <div className="rp__assin rp__assin--2">
        <div><span>Assinatura do motorista</span><b /></div>
        <div><span>Conferente Munila</span><b /></div>
      </div>
      <p className="rp__obs">Declaro ter recebido as mercadorias acima, em perfeitas condições e nas quantidades indicadas.</p>
    </div>
  );
}
