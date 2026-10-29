import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Activity, Download, Eraser, FilePlus2, Pencil, RotateCw, ShieldAlert, Trash2, Truck, UserRound, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { mensagemErro } from '../lib/db';
import { MODULOS_LOG } from '../lib/constants';
import { downloadCsv } from '../lib/csv';
import { FUSO, diaLocal, formatDate, formatDateTimeBR, formatHora, hojeISO, iniciais, tempoRelativo } from '../lib/format';
import { useAppData } from '../state/context';
import { useFeedback } from '../feedback/context';
import { EmptyState, FilterCard, Field, PageHeader, SearchInput } from '../components/ui/basics';
import { ModalHistorico } from '../modals/ModalHistorico';
import type { Entrega, LogAuditoria } from '../types';
import './auditoria.css';

const POR_PAGINA = 100;
const ACOES: Record<string, { label: string; tone: string; icon: typeof Pencil }> = {
  CRIOU: { label: 'Criou', tone: 'green', icon: FilePlus2 },
  EDITOU: { label: 'Editou', tone: 'amber', icon: Pencil },
  APAGOU: { label: 'Apagou', tone: 'red', icon: Trash2 },
};
const PORTAL = '__portal__';
const SISTEMA = '__sistema__';

/** Início/fim do dia em Fortaleza (UTC−3) como carimbo absoluto. */
const inicioDia = (iso: string) => `${iso}T00:00:00-03:00`;
const fimDia = (iso: string) => `${iso}T23:59:59.999-03:00`;
/** texto seguro para o filtro .or() do PostgREST */
const limpaBusca = (t: string) => t.replace(/[,()*%\\"]/g, ' ').trim();

function rotuloDia(iso: string, hoje: string) {
  const ontem = new Date(Date.parse(`${hoje}T12:00:00Z`) - 864e5).toISOString().slice(0, 10);
  const semana = new Date(`${iso}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' });
  const data = formatDate(iso);
  if (iso === hoje) return `Hoje · ${semana}, ${data}`;
  if (iso === ontem) return `Ontem · ${semana}, ${data}`;
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${data}`;
}

/** Destaca no texto o "antes → depois" e transforma os números de NF em links para o histórico. */
function Detalhes({ texto, abrirNf }: { texto: string; abrirNf: (nf: string) => void }) {
  const [principal, ...resto] = texto.split(' — ');
  const linkarNfs = (t: string): ReactNode[] => {
    const partes: ReactNode[] = [];
    const re = /(NF[:º°]?\s*(?:Nº\s*)?)((?:\d{3,})(?:\s*\/\s*\d{3,})*)/gi;
    let ultimo = 0; let m: RegExpExecArray | null; let k = 0;
    while ((m = re.exec(t))) {
      partes.push(t.slice(ultimo, m.index + m[1].length));
      const nfs = m[2].split('/').map((x) => x.trim());
      nfs.forEach((n, i) => {
        partes.push(<button key={`nf${k++}`} type="button" className="aud-nf" onClick={(e) => { e.stopPropagation(); abrirNf(n); }} title="Ver o histórico desta NF">{n}</button>);
        if (i < nfs.length - 1) partes.push(' / ');
      });
      ultimo = m.index + m[0].length;
    }
    partes.push(t.slice(ultimo));
    return partes;
  };
  const mudancas = resto.join(' — ').split(/;\s*/).filter(Boolean);
  return (
    <div className="aud-det">
      <span>{linkarNfs(principal)}</span>
      {mudancas.length > 0 && (
        <span className="aud-mud">
          {mudancas.map((m, i) => {
            const r = m.match(/^([^:→]{1,40}):\s*(.*?)\s*→\s*(.*)$/);
            return r
              ? <span key={i} className="aud-mud__item"><b>{r[1]}</b> <s>{r[2] || 'vazio'}</s> → <em>{r[3] || 'vazio'}</em></span>
              : <span key={i} className="aud-mud__item">{linkarNfs(m)}</span>;
          })}
        </span>
      )}
    </div>
  );
}

export default function Auditoria() {
  const { perfis, entregas } = useAppData();
  const { toast } = useFeedback();
  const hoje = hojeISO();
  const [logs, setLogs] = useState<LogAuditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMais, setLoadingMais] = useState(false);
  const [temMais, setTemMais] = useState(true);
  const [busca, setBusca] = useState('');
  const [buscaServ, setBuscaServ] = useState('');
  const [usuario, setUsuario] = useState('');
  const [modulo, setModulo] = useState('');
  const [acao, setAcao] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [resumoHoje, setResumoHoje] = useState<Pick<LogAuditoria, 'usuario_email' | 'acao' | 'modulo'>[] | null>(null);
  const [novos, setNovos] = useState<Set<string>>(new Set());
  const [historico, setHistorico] = useState<Entrega | null>(null);
  const [agora, setAgora] = useState(() => new Date());
  const filtrosRef = useRef({ usuario, modulo, acao, de, ate, buscaServ });
  useEffect(() => { filtrosRef.current = { usuario, modulo, acao, de, ate, buscaServ }; });

  // a busca vai ao banco (procura em TODO o histórico, não só no que está carregado)
  useEffect(() => { const t = setTimeout(() => setBuscaServ(limpaBusca(busca)), 400); return () => clearTimeout(t); }, [busca]);
  // atualiza o "há X min" a cada minuto
  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 60_000); return () => clearInterval(t); }, []);

  const consulta = useCallback(() => {
    let q = supabase.from('logs_auditoria').select('*');
    if (acao) q = q.eq('acao', acao);
    if (modulo) q = q.eq('modulo', modulo);
    if (usuario === PORTAL) q = q.ilike('usuario_email', 'portal:%');
    else if (usuario === SISTEMA) q = q.ilike('usuario_email', 'sistema@%');
    else if (usuario) q = q.ilike('usuario_email', usuario);
    if (de) q = q.gte('criado_em', inicioDia(de));
    if (ate) q = q.lte('criado_em', fimDia(ate));
    if (buscaServ) q = q.or(`detalhes.ilike."*${buscaServ}*",usuario_email.ilike."*${buscaServ}*"`);
    return q.order('criado_em', { ascending: false }).order('id', { ascending: false });
  }, [acao, modulo, usuario, de, ate, buscaServ]);

  const buscar = useCallback(async (offset: number) => {
    try {
      const { data, error } = await consulta().range(offset, offset + POR_PAGINA - 1);
      if (error) throw error;
      const rows = (data ?? []) as LogAuditoria[];
      setLogs((prev) => (offset === 0 ? rows : [...prev, ...rows]));
      setTemMais(rows.length === POR_PAGINA);
    } catch (err) {
      toast({ kind: 'error', title: 'Erro ao buscar registros', text: mensagemErro(err) });
    } finally { setLoading(false); setLoadingMais(false); }
  }, [consulta, toast]);

  const carregarResumo = useCallback(async () => {
    const { data } = await supabase.from('logs_auditoria').select('usuario_email, acao, modulo').gte('criado_em', inicioDia(hoje)).limit(5000);
    setResumoHoje((data ?? []) as Pick<LogAuditoria, 'usuario_email' | 'acao' | 'modulo'>[]);
  }, [hoje]);

  // busca assíncrona: os setState acontecem depois do await
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setLoading(true); buscar(0); }, [buscar]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregarResumo(); }, [carregarResumo]);

  // tempo real: novas ações aparecem no topo (quando combinam com os filtros)
  useEffect(() => {
    const canal = supabase.channel('munilalog-auditoria')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs_auditoria' }, (p) => {
        const l = p.new as LogAuditoria;
        const f = filtrosRef.current;
        const email = (l.usuario_email ?? '').toLowerCase();
        const okUsuario = !f.usuario || (f.usuario === PORTAL ? email.startsWith('portal:') : f.usuario === SISTEMA ? email.startsWith('sistema@') : email === f.usuario.toLowerCase());
        const okBusca = !f.buscaServ || `${l.detalhes} ${l.usuario_email}`.toLowerCase().includes(f.buscaServ.toLowerCase());
        const ok = okUsuario && okBusca && (!f.modulo || l.modulo === f.modulo) && (!f.acao || l.acao === f.acao) && !f.ate;
        setResumoHoje((r) => (r ? [...r, { usuario_email: l.usuario_email, acao: l.acao, modulo: l.modulo }] : r));
        if (!ok) return;
        setLogs((prev) => (prev.some((x) => x.id === l.id) ? prev : [l, ...prev]));
        setNovos((s) => new Set(s).add(String(l.id)));
        setTimeout(() => setNovos((s) => { const n = new Set(s); n.delete(String(l.id)); return n; }), 6000);
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, []);

  const recarregar = () => { setLoading(true); buscar(0); carregarResumo(); };
  const carregarMais = () => { setLoadingMais(true); buscar(logs.length); };
  const ativos = [busca, usuario, modulo, acao, de, ate].filter(Boolean).length;
  const limpar = () => { setBusca(''); setUsuario(''); setModulo(''); setAcao(''); setDe(''); setAte(''); };

  const nomeDe = useCallback((email: string) => {
    if (email.startsWith('portal:')) return email.slice(7).trim() || 'Portal';
    if (email.startsWith('sistema@')) return 'Sistema (automático)';
    return perfis.find((p) => p.email?.toLowerCase() === email.toLowerCase())?.nome || email;
  }, [perfis]);

  const grupos = useMemo(() => {
    const m = new Map<string, LogAuditoria[]>();
    for (const l of logs) { const d = diaLocal(l.criado_em); m.set(d, [...(m.get(d) ?? []), l]); }
    return [...m];
  }, [logs]);

  const resumo = useMemo(() => {
    const r = resumoHoje ?? [];
    const porUsuario = new Map<string, number>();
    r.forEach((l) => porUsuario.set(l.usuario_email, (porUsuario.get(l.usuario_email) ?? 0) + 1));
    const ranking = [...porUsuario].sort((a, b) => b[1] - a[1]);
    return {
      total: r.length,
      usuarios: ranking.filter(([e]) => !e.startsWith('portal:') && !e.startsWith('sistema@')).length,
      portal: r.filter((l) => l.usuario_email.startsWith('portal:')).length,
      apagou: r.filter((l) => l.acao === 'APAGOU').length,
      ranking,
    };
  }, [resumoHoje]);

  function abrirNf(nf: string) {
    const n = String(Number(nf));
    const e = entregas.find((x) => (x.nota_fiscal.match(/\d+/g) ?? []).some((y) => String(Number(y)) === n));
    if (e) setHistorico(e);
    else { setBusca(nf); toast({ kind: 'info', title: `NF ${nf} não está no Painel`, text: 'Mostrando todos os registros com esse número.' }); }
  }

  function exportar() {
    if (!logs.length) { toast({ kind: 'warning', title: 'Não há registros para exportar.' }); return; }
    downloadCsv('MunilaLog_Auditoria', ['Data e hora (Fortaleza)', 'Usuário', 'Nome', 'Ação', 'Módulo', 'Detalhes'],
      logs.map((l) => [formatDateTimeBR(l.criado_em), l.usuario_email, nomeDe(l.usuario_email), ACOES[l.acao]?.label ?? l.acao, MODULOS_LOG.find((m) => m.value === l.modulo)?.label ?? l.modulo, l.detalhes]));
  }

  const usuariosFiltro = useMemo(() => [...perfis].filter((p) => p.email).sort((a, b) => (a.nome || a.email).localeCompare(b.nome || b.email)), [perfis]);
  const fusoTxt = useMemo(() => new Date().toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }), [agora]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page aud">
      <PageHeader icon={<ShieldAlert size={22} />} title="Auditoria do Sistema"
        subtitle={<>Quem fez o quê e quando · horário de Fortaleza (UTC−3), agora <b>{fusoTxt}</b></>}
        actions={<>
          <button className="btn btn-success-outline" onClick={exportar}><Download size={16} /> Exportar</button>
          <button className="btn" onClick={recarregar}><RotateCw size={16} className={loading ? 'spin' : ''} /> Atualizar</button>
        </>} />

      <div className="aud-resumo">
        <div className="aud-resumo__item"><Activity size={18} /><div><strong>{resumoHoje === null ? '…' : resumo.total}</strong><span>ações hoje</span></div></div>
        <div className="aud-resumo__item"><Users size={18} /><div><strong>{resumoHoje === null ? '…' : resumo.usuarios}</strong><span>usuários ativos hoje</span></div></div>
        <div className="aud-resumo__item"><Truck size={18} /><div><strong>{resumoHoje === null ? '…' : resumo.portal}</strong><span>pelo portal das transportadoras</span></div></div>
        <button type="button" className={`aud-resumo__item ${resumo.apagou ? 'is-alerta' : ''}`} onClick={() => { setAcao('APAGOU'); setDe(hoje); setAte(''); }} title="Ver as exclusões de hoje">
          <Trash2 size={18} /><div><strong>{resumoHoje === null ? '…' : resumo.apagou}</strong><span>exclusões hoje</span></div>
        </button>
        {resumo.ranking.length > 0 && (
          <div className="aud-resumo__quem">
            <span>Mais ativos hoje</span>
            <div>
              {resumo.ranking.slice(0, 4).map(([email, n]) => (
                <button key={email} type="button" className={`aud-pessoa ${usuario.toLowerCase() === email.toLowerCase() ? 'is-on' : ''}`}
                  onClick={() => setUsuario(email.startsWith('portal:') ? PORTAL : email.startsWith('sistema@') ? SISTEMA : email)} title={email}>
                  <span className="aud-av">{email.startsWith('portal:') ? <Truck size={12} /> : iniciais(nomeDe(email))}</span>{nomeDe(email).split(' ')[0]} <b>{n}</b>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <FilterCard ativos={ativos} minCol={170}>
        <Field label="Buscar em todo o histórico" className="span-2"><SearchInput value={busca} onChange={setBusca} placeholder="NF, cliente, CTE, fatura, e-mail…" /></Field>
        <Field label="Usuário">
          <select className="select" value={usuario} onChange={(e) => setUsuario(e.target.value)}>
            <option value="">Todos</option>
            {usuariosFiltro.map((p) => <option key={p.email} value={p.email}>{p.nome || p.email}</option>)}
            <option value={PORTAL}>Portal das transportadoras</option>
            <option value={SISTEMA}>Sistema (automático)</option>
          </select>
        </Field>
        <Field label="Módulo">
          <select className="select" value={modulo} onChange={(e) => setModulo(e.target.value)}>
            <option value="">Todos os módulos</option>
            {MODULOS_LOG.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </Field>
        <Field label="Ação">
          <select className="select" value={acao} onChange={(e) => setAcao(e.target.value)}>
            <option value="">Todas as ações</option>
            {Object.entries(ACOES).map(([k, a]) => <option key={k} value={k}>{a.label}</option>)}
          </select>
        </Field>
        <Field label="De"><input type="date" className="input" value={de} max={ate || undefined} onChange={(e) => setDe(e.target.value)} /></Field>
        <Field label="Até"><input type="date" className="input" value={ate} min={de || undefined} onChange={(e) => setAte(e.target.value)} /></Field>
        {ativos > 0 && <button className="btn btn-danger-outline" onClick={limpar}><Eraser size={16} /> Limpar</button>}
      </FilterCard>

      <div className="card aud-lista">
        {loading ? <div className="card-pad muted">Carregando…</div>
          : !logs.length ? <EmptyState icon={<ShieldAlert size={30} />} title="Nenhum registro encontrado" text={ativos ? 'Ajuste ou limpe os filtros.' : undefined} />
          : (
            <table className="aud-tabela">
              <thead><tr><th>Hora</th><th>Usuário</th><th>Ação</th><th>Módulo</th><th>Detalhes</th></tr></thead>
              {grupos.map(([dia, ls]) => (
                <tbody key={dia}>
                  <tr className="aud-dia"><td colSpan={5}>{rotuloDia(dia, diaLocal(agora))}<span>{ls.length} registro{ls.length > 1 ? 's' : ''}{temMais && dia === grupos[grupos.length - 1][0] ? '+' : ''}</span></td></tr>
                  {ls.map((l) => {
                    const a = ACOES[l.acao]; const Ic = a?.icon ?? Pencil;
                    const portal = l.usuario_email.startsWith('portal:');
                    return (
                      <tr key={l.id} className={novos.has(String(l.id)) ? 'is-novo' : ''}>
                        <td className="aud-hora" title={formatDateTimeBR(l.criado_em)}>
                          <b>{formatHora(l.criado_em)}</b>
                          {diaLocal(l.criado_em) === diaLocal(agora) && <small>{tempoRelativo(l.criado_em, agora)}</small>}
                        </td>
                        <td className="aud-user" title={l.usuario_email}><div className="aud-user__in">
                          <span className={`aud-av ${portal ? 'aud-av--portal' : ''}`}>{portal ? <Truck size={12} /> : l.usuario_email.startsWith('sistema@') ? <UserRound size={12} /> : iniciais(nomeDe(l.usuario_email))}</span>
                          <span className="aud-user__txt"><b>{nomeDe(l.usuario_email)}</b>{!portal && nomeDe(l.usuario_email) !== l.usuario_email && <small>{l.usuario_email}</small>}{portal && <small>portal da transportadora</small>}</span>
                        </div></td>
                        <td><span className={`badge tone-${a?.tone ?? 'slate'} aud-acao`}><Ic size={12} /> {a?.label ?? l.acao}</span></td>
                        <td className="aud-mod">{MODULOS_LOG.find((m) => m.value === l.modulo)?.label ?? l.modulo}</td>
                        <td><Detalhes texto={l.detalhes ?? ''} abrirNf={abrirNf} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          )}
        {!loading && temMais && logs.length > 0 && (
          <div className="aud-mais">
            <button className="btn" onClick={carregarMais} disabled={loadingMais}>
              <RotateCw size={16} className={loadingMais ? 'spin' : ''} /> {loadingMais ? 'Carregando…' : 'Carregar registros mais antigos'}
            </button>
          </div>
        )}
      </div>
      <p className="muted aud-nota">Os registros não podem ser editados nem apagados. Clique no número de uma NF para ver o histórico completo dela.</p>

      {historico && <ModalHistorico entrega={historico} onClose={() => setHistorico(null)} />}
    </div>
  );
}
