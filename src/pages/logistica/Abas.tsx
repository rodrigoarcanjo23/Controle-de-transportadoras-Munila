import { useMemo, useState } from 'react';
import { CheckCheck, ClipboardCopy, History, Mail, MessageCircle, PanelsTopLeft, Save, Siren, TriangleAlert } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { useChartTheme } from '../../hooks/useChartTheme';
import {
  ETAPA, envelhecimento, gruposCobranca, mensagemCobranca, type Aprendizado, type ConfigSLA, type Etapa, type LinhaSLA, type RiscoNF, type RotaPrazo,
} from '../../lib/sla';
import { formatDate, formatPercent, hojeISO, percentual } from '../../lib/format';
import { cidadeDestino, ufDestino } from '../../lib/filtrosEntrega';
import { UFS } from '../../lib/constants';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Badge, EmptyState, StatusBadge } from '../../components/ui/basics';
import type { Entrega } from '../../types';

type Tema = ReturnType<typeof useChartTheme>;
const du = (n: number) => `${n} d.u.`;

export function SeloSituacao({ l }: { l: LinhaSLA }) {
  if (l.situacao === 'verificar') return <Badge tone="purple" square>Verificar status</Badge>;
  if (l.atraso === null) return <span className="muted">—</span>;
  if (l.situacao === 'atrasada') return <Badge tone="red" square><TriangleAlert size={12} /> {du(l.atraso)} de atraso</Badge>;
  if (l.situacao === 'vence_hoje') return <Badge tone="amber" square>{l.atraso === 0 ? 'Vence hoje' : 'Vence amanhã'}</Badge>;
  return <Badge tone="green" square>No prazo · faltam {du(-l.atraso)}</Badge>;
}

/* ------------------------------------------------------------------ */
/* Em aberto                                                            */
/* ------------------------------------------------------------------ */
const ETAPAS_ABERTAS: Etapa[] = ['coleta', 'agendamento', 'agendado', 'transito'];

export function EmAberto({ linhas, etapa, setEtapa, onHistorico, loading, riscos }: {
  linhas: LinhaSLA[]; etapa: Etapa | ''; setEtapa: (e: Etapa | '') => void; onHistorico: (e: Entrega) => void; loading: boolean; riscos?: Map<string, RiscoNF>;
}) {
  const cont = useMemo(() => Object.fromEntries(ETAPAS_ABERTAS.map((et) => [et, linhas.filter((l) => l.etapa === et).length])) as Record<Etapa, number>, [linhas]);
  const visiveis = etapa ? linhas.filter((l) => l.etapa === etapa) : linhas;
  const cols: Column<LinhaSLA>[] = [
    {
      key: 'nf', header: 'NF / Cliente', mobile: 'title', sortValue: (l) => l.e.nota_fiscal,
      render: (l) => (
        <div className="cell-id">
          <button className="fin-nf" onClick={() => onHistorico(l.e)} title="Histórico da NF"><History size={13} /> NF {l.e.nota_fiscal}</button>
          <small className="cell-id__sub">{l.e.clientes?.nome ?? '—'}</small>
        </div>
      ),
    },
    { key: 'dest', header: 'Destino', mobile: 'subtitle', sortValue: (l) => ufDestino(l.e), render: (l) => <span>{cidadeDestino(l.e) || '—'} <b>{ufDestino(l.e)}</b></span> },
    {
      key: 'transp', header: 'Transportadora', sortValue: (l) => l.e.transportadoras?.nome ?? '',
      render: (l) => <div className="cell-id"><span>{l.e.transportadoras?.nome ?? <span className="muted">—</span>}</span><small className="cell-id__sub">{l.e.modal_frete || l.e.transportadoras?.modal_padrao || ''}</small></div>,
    },
    { key: 'fat', header: 'Faturamento', render: (l) => formatDate(l.e.data_faturamento), sortValue: (l) => l.e.data_faturamento ?? '', className: 'num', mobile: 'hide' },
    { key: 'col', header: 'Coleta', render: (l) => (l.e.data_coleta ? formatDate(l.e.data_coleta) : <span className="muted">—</span>), sortValue: (l) => l.e.data_coleta ?? '', className: 'num', mobile: 'hide' },
    {
      key: 'etapa', header: 'Etapa / responsável', sortValue: (l) => ETAPAS_ABERTAS.indexOf(l.etapa),
      render: (l) => <div className="cell-id"><span className="strong">{ETAPA[l.etapa].label}</span><small className="cell-id__sub">{ETAPA[l.etapa].resp}</small></div>,
    },
    {
      key: 'prev', header: 'Prazo da etapa', sortValue: (l) => l.limite ?? '', className: 'num',
      render: (l) => (
        <span title={l.etapa === 'transito' ? `${l.previsaoCalculada ? 'Previsão calculada. ' : 'Previsão da NF. '}${l.prazo.detalhe}` : l.etapa === 'agendado' ? 'Data agendada com o cliente' : 'Prazo da etapa (dias úteis desde o faturamento)'}>
          {formatDate(l.limite)}{l.etapa === 'transito' && l.previsaoCalculada && <small className="muted"> calc.</small>}
        </span>
      ),
    },
    {
      key: 'sit', header: 'Situação', mobile: 'badge', sortValue: (l) => l.atraso ?? -999,
      render: (l) => {
        const r = riscos?.get(String(l.e.id));
        return (
          <span className="sla-sit">
            <SeloSituacao l={l} />
            {r && <span className={`badge badge--square tone-${r.nivel === 'alto' ? 'orange' : 'amber'} sla-risco`} title={r.motivos.join('\n')}><Siren size={12} /> {r.nivel === 'alto' ? 'Risco alto' : 'Risco'}</span>}
          </span>
        );
      },
    },
    { key: 'status', header: 'Status', render: (l) => <StatusBadge status={l.e.status} />, sortValue: (l) => l.e.status, mobile: 'hide' },
  ];
  // situação e etapa logo após a NF (o que importa fica visível sem rolar)
  const ordem = ['nf', 'sit', 'etapa', 'prev', 'dest', 'transp', 'fat', 'col', 'status'];
  const colsOrd = ordem.map((k) => cols.find((x) => x.key === k)!);
  return (
    <div className="fin-conf">
      <div className="fin-abas">
        <button className={`fin-aba ${!etapa ? 'is-on' : ''}`} onClick={() => setEtapa('')}>Todas as etapas<b>{linhas.length}</b></button>
        {ETAPAS_ABERTAS.map((et) => (
          <button key={et} className={`fin-aba ${etapa === et ? 'is-on' : ''}`} onClick={() => setEtapa(et)} title={`Responsável: ${ETAPA[et].resp}`}>{ETAPA[et].label}<b>{cont[et]}</b></button>
        ))}
      </div>
      <div className="card table-card">
        <DataTable rows={visiveis} columns={colsOrd} rowKey={(l) => l.e.id} loading={loading} fill stickyFirst
          empty={<EmptyState title="Nenhuma NF aqui" text="Ajuste os filtros acima." />} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Verificar status (provavelmente entregues)                           */
/* ------------------------------------------------------------------ */
export function Verificar({ linhas, isAdmin, onMarcar, onAbrirPainel }: {
  linhas: LinhaSLA[]; isAdmin: boolean;
  onMarcar: (itens: { e: Entrega; data: string }[]) => Promise<void>;
  onAbrirPainel: (ids: string[]) => void;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [modo, setModo] = useState<'previsao' | 'data'>('previsao');
  const [data, setData] = useState(hojeISO());
  const [salvando, setSalvando] = useState(false);
  const todos = linhas.length > 0 && linhas.every((l) => sel.has(l.e.id));
  const alternar = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const hoje = hojeISO();
  const dataDe = (l: LinhaSLA) => (modo === 'data' ? data : l.previsao && l.previsao <= hoje ? l.previsao : hoje);

  if (!linhas.length) return <div className="card"><EmptyState icon={<CheckCheck size={30} />} title="Nada para verificar" text="Nenhuma NF muito além do prazo sem atualização." /></div>;
  const escolhidas = linhas.filter((l) => sel.has(l.e.id));
  return (
    <div className="bi-stack">
      <div className="callout sla-verif">
        <TriangleAlert size={18} />
        <span>
          Estas <strong>{linhas.length} NFs</strong> estão há mais que o dobro do prazo sem nenhuma atualização — o mais provável é que <strong>já tenham sido entregues e o status não foi atualizado</strong>.
          Confira e marque como entregues para limpar a lista de atrasos. {!isAdmin && 'Somente administradores podem atualizar.'}
        </span>
        <button className="btn btn-sm" onClick={() => onAbrirPainel(linhas.map((l) => l.e.id))}><PanelsTopLeft size={14} /> Abrir no Painel</button>
      </div>
      {isAdmin && (
        <div className="card card-pad sla-lote">
          <strong>{sel.size} selecionada{sel.size === 1 ? '' : 's'}</strong>
          <label><input type="radio" checked={modo === 'previsao'} onChange={() => setModo('previsao')} /> Data de entrega = previsão de cada NF</label>
          <label><input type="radio" checked={modo === 'data'} onChange={() => setModo('data')} /> Mesma data para todas: <input type="date" className="input" value={data} max={hoje} onChange={(e) => { setData(e.target.value); setModo('data'); }} style={{ height: 32, width: 150 }} /></label>
          <button className="btn btn-primary btn-sm" disabled={!sel.size || salvando}
            onClick={async () => { setSalvando(true); try { await onMarcar(escolhidas.map((l) => ({ e: l.e, data: dataDe(l) }))); setSel(new Set()); } finally { setSalvando(false); } }}>
            <CheckCheck size={15} /> {salvando ? 'Salvando…' : `Marcar ${sel.size || ''} como Entregue`}
          </button>
        </div>
      )}
      <div className="card bi-ranking">
        <div className="table-scroll" style={{ maxHeight: 560 }}>
          <table className="bi-tabela">
            <thead>
              <tr>
                {isAdmin && <th style={{ width: 34 }}><input type="checkbox" checked={todos} onChange={() => setSel(todos ? new Set() : new Set(linhas.map((l) => l.e.id)))} aria-label="Selecionar todas" /></th>}
                <th>NF</th><th>Cliente</th><th>Destino</th><th>Transportadora</th><th>Status atual</th><th className="r">Faturamento</th><th className="r">Previsão</th><th className="r">Dias úteis</th>
                {isAdmin && <th className="r">Entrega a gravar</th>}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.e.id} className={sel.has(l.e.id) ? 'is-sel' : ''} onClick={isAdmin ? () => alternar(l.e.id) : undefined} style={isAdmin ? { cursor: 'pointer' } : undefined}>
                  {isAdmin && <td><input type="checkbox" checked={sel.has(l.e.id)} onChange={() => alternar(l.e.id)} onClick={(ev) => ev.stopPropagation()} aria-label={`Selecionar NF ${l.e.nota_fiscal}`} /></td>}
                  <td className="strong">NF {l.e.nota_fiscal}</td>
                  <td>{l.e.clientes?.nome ?? '—'}</td>
                  <td>{cidadeDestino(l.e)} <b>{ufDestino(l.e)}</b></td>
                  <td>{l.e.transportadoras?.nome ?? '—'}</td>
                  <td><StatusBadge status={l.e.status} /></td>
                  <td className="r">{formatDate(l.e.data_faturamento)}</td>
                  <td className="r">{formatDate(l.previsao)}{l.previsaoCalculada && <small className="muted"> calc.</small>}</td>
                  <td className="r">{l.idade}</td>
                  {isAdmin && <td className="r muted">{sel.has(l.e.id) ? formatDate(dataDe(l)) : ''}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cobrança por transportadora                                          */
/* ------------------------------------------------------------------ */
export function Cobranca({ linhas, onCopiado, onAbrirPainel }: { linhas: LinhaSLA[]; onCopiado: () => void; onAbrirPainel: (ids: string[]) => void }) {
  const grupos = useMemo(() => gruposCobranca(linhas), [linhas]);
  if (!grupos.length) return <div className="card"><EmptyState icon={<CheckCheck size={30} />} title="Nenhuma transportadora com NF atrasada" /></div>;
  return (
    <div className="sla-cobr">
      {grupos.map((g) => {
        const msg = mensagemCobranca(g);
        const fone = (g.telefone ?? '').replace(/\D/g, '');
        return (
          <div key={g.transportadora} className="card sla-cobr__card">
            <div className="sla-cobr__head">
              <div><h3>{g.transportadora}</h3><small className="muted">{[g.telefone, g.email].filter(Boolean).join(' · ') || 'sem contato no cadastro'}</small></div>
              <strong className="text-red">{g.linhas.length}<small> NF{g.linhas.length > 1 ? 's' : ''}</small></strong>
            </div>
            <ul>
              {g.linhas.slice(0, 6).map((l) => (
                <li key={l.e.id}><b>NF {l.e.nota_fiscal}</b><span>{l.e.clientes?.nome}</span><em>{ufDestino(l.e)} · {l.atraso} d.u.</em></li>
              ))}
              {g.linhas.length > 6 && <li className="muted">e mais {g.linhas.length - 6}…</li>}
            </ul>
            <div className="sla-cobr__acoes">
              <button className="btn btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(msg); onCopiado(); } catch { /* sem permissão */ } }}><ClipboardCopy size={14} /> Copiar</button>
              <a className="btn btn-sm" href={`https://wa.me/${fone.length >= 10 ? (fone.startsWith('55') ? fone : '55' + fone) : ''}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> WhatsApp</a>
              <a className="btn btn-sm" href={`mailto:${g.email ?? ''}?subject=${encodeURIComponent(`Posição de entregas em atraso — ${g.transportadora}`)}&body=${encodeURIComponent(msg)}`}><Mail size={14} /> E-mail</a>
              <button className="btn btn-ghost btn-sm" onClick={() => onAbrirPainel(g.linhas.map((l) => l.e.id))}>Ver no Painel</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Desempenho: envelhecimento, no prazo por mês e mapa de calor         */
/* ------------------------------------------------------------------ */
export function Desempenho({ linhas, apr, c }: { linhas: LinhaSLA[]; apr: Aprendizado; c: Tema }) {
  const aging = useMemo(() => envelhecimento(linhas), [linhas]);
  const porMes = useMemo(() => {
    const m = new Map<string, { mes: string; ok: number; atr: number }>();
    for (const l of linhas) {
      if (l.etapa !== 'entregue' || !l.e.data_entrega_agendamento) continue;
      const k = l.e.data_entrega_agendamento.slice(0, 7);
      const x = m.get(k) ?? { mes: k, ok: 0, atr: 0 };
      if (l.situacao === 'entregue_prazo') x.ok++; else x.atr++;
      m.set(k, x);
    }
    return [...m.values()].sort((a, b) => a.mes.localeCompare(b.mes)).slice(-12).map((x) => ({
      nome: `${x.mes.slice(5)}/${x.mes.slice(2, 4)}`, 'No prazo': x.ok, 'Com atraso': x.atr, pct: percentual(x.ok, x.ok + x.atr),
    }));
  }, [linhas]);

  // mapa de calor: transportadoras × UFs com mais entregas
  const ufs = [...apr.porUf.values()].filter((u) => u.uf !== 'ND').sort((a, b) => b.n - a.n).slice(0, 12);
  const transps = [...new Set([...apr.porTranspUf.values()].map((x) => x.transportadora!))]
    .map((t) => ({ t, n: [...apr.porTranspUf.values()].filter((x) => x.transportadora === t).reduce((s, x) => s + x.n, 0) }))
    .filter((x) => x.n >= 3).sort((a, b) => b.n - a.n).slice(0, 12);
  const tick = { fill: c.axis, fontSize: 11 };
  const cor = (med: number, ref: number) => (med <= ref ? 'verde' : med <= ref + 2 ? 'amarelo' : 'vermelho');

  return (
    <div className="bi-stack">
      <div className="chart-grid bi-grid-2">
        <div className="card chart-card">
          <h3>Envelhecimento das NFs em aberto (dias úteis desde o faturamento)</h3>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aging} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.grid} />
                <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={tick} />
                <YAxis axisLine={false} tickLine={false} tick={tick} allowDecimals={false} width={36} />
                <Tooltip contentStyle={c.tooltip} cursor={{ fill: c.cursor }} />
                <Legend verticalAlign="top" height={30} iconType="circle" />
                <Bar isAnimationActive={false} dataKey="coleta" name="Aguardando coleta" stackId="a" fill={c.amber} />
                <Bar isAnimationActive={false} dataKey="agendamento" name="Aguardando agendamento" stackId="a" fill={c.purple} />
                <Bar isAnimationActive={false} dataKey="agendado" name="Agendado" stackId="a" fill={c.blue} />
                <Bar isAnimationActive={false} dataKey="transito" name="Em trânsito" stackId="a" fill={c.orange} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card chart-card">
          <h3>Entregas no prazo por mês (data de entrega)</h3>
          {porMes.length ? (
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porMes} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.grid} />
                  <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={tick} />
                  <YAxis axisLine={false} tickLine={false} tick={tick} allowDecimals={false} width={36} />
                  <Tooltip contentStyle={c.tooltip} cursor={{ fill: c.cursor }}
                    formatter={(v, n, p) => [`${v}${n === 'No prazo' ? ` (${formatPercent((p as { payload: { pct: number } }).payload.pct, 0)})` : ''}`, n]} />
                  <Legend verticalAlign="top" height={30} iconType="circle" />
                  <Bar isAnimationActive={false} dataKey="No prazo" stackId="m" fill={c.green} />
                  <Bar isAnimationActive={false} dataKey="Com atraso" stackId="m" fill={c.red} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="muted">Ainda não há entregas concluídas com data de entrega.</p>}
        </div>
      </div>

      <div className="card bi-ranking">
        <div style={{ padding: '16px 18px 4px' }}>
          <h3 style={{ fontSize: '1rem' }}>Tempo real de trânsito: transportadora × UF</h3>
          <p className="muted bi-legenda" style={{ marginTop: 4 }}>Mediana de dias úteis da coleta à entrega (último ano). Verde = igual ou mais rápido que a média da UF; amarelo = até 2 d.u. mais lento; vermelho = mais lento que isso. Passe o mouse para ver o detalhe.</p>
        </div>
        {transps.length && ufs.length ? (
          <div className="table-scroll">
            <table className="bi-tabela sla-heat">
              <thead><tr><th>Transportadora</th>{ufs.map((u) => <th key={u.uf} className="c" title={`${u.n} entregas · mediana ${u.mediana} d.u.`}>{u.uf}<small>{u.mediana} d.u.</small></th>)}</tr></thead>
              <tbody>
                {transps.map(({ t }) => (
                  <tr key={t}>
                    <td className="bi-tabela__nome"><span>{t}</span></td>
                    {ufs.map((u) => {
                      const x = apr.porTranspUf.get(`${t.toUpperCase()}|${u.uf}`);
                      if (!x) return <td key={u.uf} className="c muted">·</td>;
                      return (
                        <td key={u.uf} className="c">
                          <span className={`sla-cel sla-cel--${x.n < 3 ? 'cinza' : cor(x.mediana, u.mediana)}`}
                            title={`${t} → ${u.uf}\n${x.n} entregas · mediana ${x.mediana} d.u. · 80% em até ${x.p80} d.u.${x.comPrevisao ? `\nNo prazo: ${formatPercent(percentual(x.noPrazo, x.comPrevisao), 0)}` : ''}`}>
                            {x.mediana}<small>{x.n}</small>
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted" style={{ padding: '0 18px 16px' }}>Ainda não há histórico suficiente (entregas com data de coleta e de entrega).</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Prazos (sugeridos pelo histórico + ajuste manual)                    */
/* ------------------------------------------------------------------ */
export function Prazos({ cfg, apr, isAdmin, onSalvar }: { cfg: ConfigSLA; apr: Aprendizado; isAdmin: boolean; onSalvar: (c: ConfigSLA) => Promise<void> }) {
  const [f, setF] = useState(cfg);
  const [salvando, setSalvando] = useState(false);
  const manual = (uf: string, t?: string) => f.rotas.find((r) => r.uf === uf && (r.transportadora ?? '') === (t ?? ''))?.dias;
  const setManual = (uf: string, t: string | undefined, v: string) => setF((x) => {
    const outras = x.rotas.filter((r) => !(r.uf === uf && (r.transportadora ?? '') === (t ?? '')));
    const n = parseInt(v, 10);
    return { ...x, rotas: Number.isFinite(n) && n > 0 ? [...outras, { uf, transportadora: t, dias: n } as RotaPrazo] : outras };
  });
  const ufsLista = UFS.map((u) => ({ uf: u, h: apr.porUf.get(u) })).sort((a, b) => (b.h?.n ?? 0) - (a.h?.n ?? 0));
  const combos = [...apr.porTranspUf.values()].filter((x) => x.n >= 3 && x.uf !== 'ND').sort((a, b) => b.n - a.n).slice(0, 60);
  const mudou = JSON.stringify(f) !== JSON.stringify(cfg);
  const input = (uf: string, t?: string) => (
    <input type="number" min={1} max={60} className="input sla-input" disabled={!isAdmin} placeholder="auto"
      value={manual(uf, t) ?? ''} onChange={(e) => setManual(uf, t, e.target.value)} />
  );
  return (
    <div className="bi-stack">
      <div className="card card-pad sla-param">
        <div>
          <h3>Como o prazo de cada NF é calculado</h3>
          <p className="muted">
            Previsão de entrega = <b>data da coleta</b> (ou faturamento + {cfg.coleta_dias} d.u.) + <b>dias úteis de trânsito</b>. O trânsito vem, nesta ordem:
            do prazo manual da transportadora na UF › do prazo manual da UF › do histórico real (80% das entregas chegaram em até X d.u.) › do padrão.
            Se a NF já tem <b>Data de previsão</b> preenchida, ela vale. Feriados nacionais e fins de semana não contam.
          </p>
        </div>
        <div className="sla-param__campos">
          <div className="field"><label>Coleta (D+ úteis)</label><input className="input" value={cfg.coleta_dias} disabled title="Definido em Indicadores Diários › Expedição" /><small className="muted">em Indicadores Diários</small></div>
          <div className="field"><label>Agendamento (d.u.)</label><input type="number" min={0} className="input" disabled={!isAdmin} value={f.agendamento_dias} onChange={(e) => setF({ ...f, agendamento_dias: Math.max(0, +e.target.value || 0) })} /></div>
          <div className="field"><label>Trânsito padrão (d.u.)</label><input type="number" min={1} className="input" disabled={!isAdmin} value={f.transito_padrao} onChange={(e) => setF({ ...f, transito_padrao: Math.max(1, +e.target.value || 1) })} /></div>
          {isAdmin && <button className="btn btn-primary" disabled={!mudou || salvando} onClick={async () => { setSalvando(true); try { await onSalvar(f); } finally { setSalvando(false); } }}><Save size={15} /> {salvando ? 'Salvando…' : 'Salvar prazos'}</button>}
        </div>
      </div>

      <div className="chart-grid bi-grid-2">
        <div className="card bi-ranking">
          <h3 className="sla-tit">Prazo por UF</h3>
          <div className="table-scroll" style={{ maxHeight: 520 }}>
            <table className="bi-tabela">
              <thead><tr><th>UF</th><th className="r">Entregas</th><th className="r">Mediana</th><th className="r">Sugerido</th><th className="r">Manual</th></tr></thead>
              <tbody>
                {ufsLista.map(({ uf, h }) => (
                  <tr key={uf}>
                    <td className="strong">{uf}</td>
                    <td className="r">{h?.n ?? 0}</td>
                    <td className="r">{h ? du(h.mediana) : '—'}</td>
                    <td className="r">{h && h.n >= 5 ? <b>{du(h.p80)}</b> : <span className="muted" title="Menos de 5 entregas: usa o padrão">{du(f.transito_padrao)}*</span>}</td>
                    <td className="r">{input(uf)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card bi-ranking">
          <h3 className="sla-tit">Por transportadora × UF <small className="muted">(com 3+ entregas)</small></h3>
          {combos.length ? (
            <div className="table-scroll" style={{ maxHeight: 520 }}>
              <table className="bi-tabela">
                <thead><tr><th>Transportadora</th><th>UF</th><th className="r">Entregas</th><th className="r">Mediana</th><th className="r">Sugerido</th><th className="r">Manual</th></tr></thead>
                <tbody>
                  {combos.map((x) => (
                    <tr key={`${x.transportadora}|${x.uf}`}>
                      <td className="bi-tabela__nome"><span>{x.transportadora}</span></td>
                      <td className="strong">{x.uf}</td>
                      <td className="r">{x.n}</td>
                      <td className="r">{du(x.mediana)}</td>
                      <td className="r"><b>{du(x.p80)}</b></td>
                      <td className="r">{input(x.uf, x.transportadora)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="muted" style={{ padding: '0 18px 16px' }}>Ainda sem histórico suficiente.</p>}
        </div>
      </div>
      <p className="muted bi-legenda">"Sugerido" = em até quantos dias úteis 80% das entregas chegaram (coleta → entrega, último ano). Deixe "Manual" vazio para usar o sugerido; preencha para fixar um prazo combinado com a transportadora.</p>
    </div>
  );
}
