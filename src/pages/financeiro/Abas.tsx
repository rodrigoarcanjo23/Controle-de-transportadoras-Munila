import { useMemo, useState } from 'react';
import { CircleCheck, Gauge, History, Receipt, TrendingUp, Truck, Users } from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { useChartTheme } from '../../hooks/useChartTheme';
import {
  SITUACAO, type ConfigFinanceiro, type LinhaCliente, type LinhaFin, type LinhaTransp, type ResumoFin, type Situacao, type serieMensal,
} from '../../lib/financeiro';
import { formatDate, formatMoney, formatMoneyShort, formatPercent, percentual } from '../../lib/format';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Badge, EmptyState } from '../../components/ui/basics';
import { moedaCompacta, num } from '../bi/fmt';
import type { Entrega } from '../../types';

type Tema = ReturnType<typeof useChartTheme>;
const pctOu = (v: number | null, c = 2) => (v === null ? '—' : formatPercent(v, c));

/* ------------------------------------------------------------------ */
/* Visão geral: evolução mensal, orçamento e projeção                   */
/* ------------------------------------------------------------------ */
export function VisaoGeral({ serie, r, cfg, c, mesOrc }: {
  serie: ReturnType<typeof serieMensal>; r: ResumoFin; cfg: ConfigFinanceiro; c: Tema;
  /** mês usado no card de orçamento */
  mesOrc: ReturnType<typeof serieMensal>[number] | null;
}) {
  const tick = { fill: c.axis, fontSize: 11 };
  const orcR$ = mesOrc ? mesOrc.faturamento * (cfg.orcamento_pct / 100) : 0;
  const usado = mesOrc ? mesOrc.real + mesOrc.aConferir : 0;
  const uso = orcR$ > 0 ? (usado / orcR$) * 100 : 0;
  const tomUso = uso <= 90 ? 'verde' : uso <= 100 ? 'amarelo' : 'vermelho';
  return (
    <div className="fin-visao">
      <div className="card chart-card">
        <h3><TrendingUp size={18} color={c.orange} /> Custo de frete por mês</h3>
        <p className="muted bi-legenda">Barras: frete real (CTE) + a conferir (cotado). Linhas: % de frete previsto e orçamento ({formatPercent(cfg.orcamento_pct, 1)} da receita).</p>
        {serie.length ? (
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={serie} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.grid} />
                <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={tick} />
                <YAxis yAxisId="l" axisLine={false} tickLine={false} tick={tick} tickFormatter={formatMoneyShort} width={64} />
                <YAxis yAxisId="r" orientation="right" axisLine={false} tickLine={false} tick={{ ...tick, fill: c.purple }} tickFormatter={(v) => `${v}%`} width={42} />
                <Tooltip contentStyle={c.tooltip} cursor={{ fill: c.cursor }}
                  formatter={(v, n) => (String(n).startsWith('%') ? [formatPercent(Number(v)), n] : [formatMoney(Number(v)), n])} />
                <Legend verticalAlign="top" height={30} iconType="circle" />
                <Bar isAnimationActive={false} yAxisId="l" dataKey="real" name="Frete real" stackId="f" fill={c.orange} maxBarSize={48} />
                <Bar isAnimationActive={false} yAxisId="l" dataKey="aConferir" name="A conferir (cotado)" stackId="f" fill={c.dark ? '#475569' : '#cbd5e1'} radius={[4, 4, 0, 0]} maxBarSize={48} />
                <Line isAnimationActive={false} yAxisId="r" type="monotone" dataKey="pctPrevisto" name="% de frete previsto" stroke={c.purple} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                <ReferenceLine yAxisId="r" y={cfg.orcamento_pct} stroke={c.red} strokeDasharray="6 4" label={{ value: `Orçamento ${formatPercent(cfg.orcamento_pct, 1)}`, fill: c.red, fontSize: 11, position: 'insideTopLeft' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="muted">Sem NFs no período.</p>}
      </div>

      <div className="fin-lado">
        <div className="card card-pad fin-orc">
          <h3><Gauge size={18} color={c.blue} /> Orçamento de frete {mesOrc ? `· ${mesOrc.nome}` : ''}</h3>
          {mesOrc ? (
            <>
              <div className="fin-orc__nums">
                <strong>{moedaCompacta(usado)}</strong><span>de {moedaCompacta(orcR$)}</span>
              </div>
              <div className="bi-progress fin-orc__barra"><i className={`fin-orc--${tomUso}`} style={{ width: `${Math.min(100, uso)}%` }} /></div>
              <p className="muted fin-orc__txt">
                {num(uso, 0)}% do orçamento usado ({formatPercent(cfg.orcamento_pct, 1)} de {formatMoney(mesOrc.faturamento)} faturados).
                {' '}{uso > 100 ? <strong className="text-red">Estourou em {formatMoney(usado - orcR$)}.</strong> : <>Sobram {formatMoney(orcR$ - usado)}.</>}
              </p>
            </>
          ) : <p className="muted">Sem faturamento no mês.</p>}
        </div>

        <div className="card card-pad fin-proj">
          <h3><Receipt size={18} color={c.purple} /> Projeção do período</h3>
          <p className="fin-proj__txt">
            Se as <strong>{num(r.aguardando)} NFs</strong> que aguardam CTE vierem com o mesmo desvio médio das já conferidas
            (<strong>{r.desvioPct >= 0 ? '+' : ''}{formatPercent(r.desvioPct, 1)}</strong> sobre o cotado), o frete do período fecha em:
          </p>
          <div className="fin-proj__valor">{formatMoney(r.custoProjetado)}</div>
          <div className="fin-proj__linhas">
            <span>Já conferido (CTE)</span><b>{formatMoney(r.freteReal)}</b>
            <span>Pendentes projetadas</span><b>{formatMoney(r.pendenteProjetado)}</b>
            <span>% sobre o faturamento</span><b>{formatPercent(r.pctProjetado)}</b>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Conferência de frete                                                 */
/* ------------------------------------------------------------------ */
const ABAS: (Situacao | 'todas')[] = ['todas', 'acima_cotado', 'acima_meta', 'fora_padrao', 'sem_cotacao', 'aguardando', 'conferido'];

export function Conferencia({ linhas, aba, setAba, cfg, onHistorico, loading }: {
  linhas: LinhaFin[]; aba: Situacao | 'todas'; setAba: (a: Situacao | 'todas') => void; cfg: ConfigFinanceiro;
  onHistorico: (e: Entrega) => void; loading: boolean;
}) {
  const contagem = useMemo(() => {
    const c = Object.fromEntries(ABAS.map((a) => [a, 0])) as Record<Situacao | 'todas', number>;
    for (const l of linhas) { c.todas++; l.flags.forEach((f) => { c[f]++; }); }
    return c;
  }, [linhas]);
  const visiveis = useMemo(() => (aba === 'todas' ? linhas : linhas.filter((l) => l.flags.has(aba))), [linhas, aba]);
  const tot = useMemo(() => visiveis.reduce((t, l) => ({
    valor: t.valor + l.valor, cotado: t.cotado + l.cotado, real: t.real + (l.real ?? 0), dif: t.dif + (l.diferenca ?? 0),
  }), { valor: 0, cotado: 0, real: 0, dif: 0 }), [visiveis]);

  const cols: Column<LinhaFin>[] = [
    {
      key: 'nf', header: 'NF / Cliente', mobile: 'title', sortValue: (l) => Number(l.e.nota_fiscal.replace(/\D.*/, '')) || l.e.nota_fiscal,
      render: (l) => (
        <div className="cell-id">
          <button className="fin-nf" onClick={() => onHistorico(l.e)} title="Ver histórico da NF"><History size={13} /> NF {l.e.nota_fiscal}</button>
          <small>{l.e.clientes?.nome ?? '—'}</small>
        </div>
      ),
    },
    { key: 'fat', header: 'Faturamento', render: (l) => formatDate(l.e.data_faturamento), sortValue: (l) => l.e.data_faturamento ?? '', className: 'num', mobile: 'hide' },
    { key: 'transp', header: 'Transportadora', render: (l) => l.e.transportadoras?.nome ?? <span className="muted">—</span>, sortValue: (l) => l.e.transportadoras?.nome ?? '', mobile: 'subtitle' },
    { key: 'modal', header: 'Modal', render: (l) => l.e.modal_frete || l.e.transportadoras?.modal_padrao || '—', sortValue: (l) => l.e.modal_frete ?? '', mobile: 'hide' },
    { key: 'valor', header: 'Valor NF', render: (l) => formatMoney(l.valor), sortValue: (l) => l.valor, align: 'right', className: 'num strong' },
    { key: 'cot', header: 'Cotado', render: (l) => (l.cotado > 0 ? formatMoney(l.cotado) : <span className="text-purple">não informado</span>), sortValue: (l) => l.cotado, align: 'right', className: 'num' },
    { key: 'real', header: 'Real (CTE)', render: (l) => (l.real !== null ? formatMoney(l.real) : <span className="muted">aguardando</span>), sortValue: (l) => l.real ?? -1, align: 'right', className: 'num strong' },
    {
      key: 'pct', header: '% frete', align: 'right', className: 'num', sortValue: (l) => l.pct,
      render: (l) => {
        const alto = l.pct > cfg.limite_pct; const meta = l.meta !== null && l.real !== null && l.pct > l.meta;
        return <span className={alto || meta ? 'text-red strong' : ''} title={l.meta !== null ? `Meta ${formatPercent(l.meta)}` : undefined}>{formatPercent(l.pct)}{l.real === null && l.cotado > 0 ? '*' : ''}</span>;
      },
    },
    {
      key: 'dif', header: 'Real − cotado', align: 'right', className: 'num', sortValue: (l) => l.diferencaPct ?? -999,
      render: (l) => {
        if (l.diferenca === null) return <span className="muted">—</span>;
        if (Math.abs(l.diferenca) < Math.max(1, l.cotado * 0.005)) return <span className="muted">igual ao cotado</span>;
        return <span className={l.diferenca > 0 ? 'text-red' : 'text-green'}>{l.diferenca > 0 ? '+' : '−'}{formatMoney(Math.abs(l.diferenca))} <small>({l.diferenca > 0 ? '+' : '−'}{num(Math.abs(l.diferencaPct ?? 0), 1)}%)</small></span>;
      },
    },
    {
      key: 'sit', header: 'Situação', mobile: 'badge', sortValue: (l) => ABAS.indexOf(l.situacao),
      render: (l) => (
        <span className="fin-selos" title={[...l.flags].map((f) => SITUACAO[f].dica).join(' · ')}>
          <Badge tone={SITUACAO[l.situacao].tone as never}>{SITUACAO[l.situacao].label}{l.situacao === 'aguardando' && l.diasSemCte !== null ? ` · ${l.diasSemCte}d` : ''}</Badge>
          {l.flags.size > 1 && l.situacao !== 'aguardando' && <small className="muted">+{l.flags.size - 1}</small>}
        </span>
      ),
    },
  ];

  return (
    <div className="fin-conf">
      <div className="fin-abas" role="tablist">
        {ABAS.map((a) => (
          <button key={a} role="tab" aria-selected={aba === a} className={`fin-aba ${aba === a ? 'is-on' : ''} ${a !== 'todas' ? `fin-aba--${SITUACAO[a].tone}` : ''}`} onClick={() => setAba(a)}
            title={a === 'todas' ? 'Todas as NFs do período' : SITUACAO[a].dica}>
            {a === 'todas' ? 'Todas' : SITUACAO[a].label}<b>{num(contagem[a])}</b>
          </button>
        ))}
      </div>
      <div className="card table-card">
        <DataTable rows={visiveis} columns={cols} rowKey={(l) => l.e.id} loading={loading} fill stickyFirst
          empty={<EmptyState icon={<CircleCheck size={32} />} title="Nada por aqui" text="Nenhuma NF nesta situação no período." />} />
        <div className="fin-totais">
          <span>{num(visiveis.length)} NFs</span>
          <span>Valor <b>{formatMoney(tot.valor)}</b></span>
          <span>Cotado <b>{formatMoney(tot.cotado)}</b></span>
          <span>Real <b>{formatMoney(tot.real)}</b></span>
          <span>Real − cotado <b className={tot.dif > 0 ? 'text-red' : 'text-green'}>{tot.dif > 0 ? '+' : '−'}{formatMoney(Math.abs(tot.dif))}</b></span>
          <span className="muted">* % pelo cotado (aguardando CTE)</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Por transportadora (com CTEs a lançar no Infarma)                    */
/* ------------------------------------------------------------------ */
export function Transportadoras({ linhas, media, irCtes }: { linhas: LinhaTransp[]; media: number; irCtes: () => void }) {
  const tot = linhas.reduce((t, l) => ({ ab: t.ab + l.ctesAbertos, vab: t.vab + l.valorAbertos }), { ab: 0, vab: 0 });
  return (
    <div className="bi-stack">
      {tot.ab > 0 && (
        <div className="callout fin-infarma">
          <Receipt size={18} />
          <span><strong>{num(tot.ab)} CTE{tot.ab > 1 ? 's' : ''} ainda não lançado{tot.ab > 1 ? 's' : ''} no Infarma</strong> (situação ABERTO), somando <strong>{formatMoney(tot.vab)}</strong>.</span>
          <button className="btn btn-sm" onClick={irCtes}>Abrir Registro de CTE</button>
        </div>
      )}
      <div className="card bi-ranking">
        <div className="table-scroll">
          <table className="bi-tabela">
            <thead>
              <tr>
                <th><Truck size={13} /> Transportadora</th><th className="r">NFs</th><th className="r">Faturamento</th>
                <th className="r">Frete real</th><th className="r">% frete (CTE)</th><th className="r">Real × cotado</th>
                <th className="r">Aguardando CTE</th><th className="r">CTEs no período</th><th className="r">A lançar no Infarma</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.nome}>
                  <td className="bi-tabela__nome"><span>{l.nome}</span></td>
                  <td className="r">{num(l.notas)}</td>
                  <td className="r">{moedaCompacta(l.faturamento)}</td>
                  <td className="r">{formatMoney(l.freteReal)}</td>
                  <td className="r">
                    <span className={`bi-pill bi-pill--${l.pctReal === null || l.conferidas < 3 ? 'cinza' : l.pctReal <= media ? 'verde' : l.pctReal <= media * 1.2 ? 'amarelo' : 'vermelho'}`}>{pctOu(l.pctReal)}</span>
                  </td>
                  <td className="r">
                    {l.desvioPct === null ? <span className="muted">—</span>
                      : <span className={l.desvioPct > 5 ? 'text-red strong' : l.desvioPct <= 0 ? 'text-green' : ''}>{l.desvioPct > 0 ? '+' : ''}{num(l.desvioPct, 1)}%</span>}
                  </td>
                  <td className="r">{l.aguardando ? <>{num(l.aguardando)} <small className="muted">· {moedaCompacta(l.cotadoPendente)}</small></> : <span className="muted">0</span>}</td>
                  <td className="r">{l.ctes ? <>{num(l.ctes)} <small className="muted">· {moedaCompacta(l.valorCtes)}</small></> : <span className="muted">0</span>}</td>
                  <td className="r">{l.ctesAbertos ? <span className="text-orange strong">{num(l.ctesAbertos)} · {moedaCompacta(l.valorAbertos)}</span> : <span className="muted">0</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="muted bi-legenda">% de frete: verde = até a média ({formatPercent(media)}); amarelo = até 20% acima; vermelho = acima disso. "A lançar no Infarma" considera todos os CTEs em ABERTO, de qualquer data. A transportadora do CTE é identificada pelo CNPJ do emitente.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Por cliente (custo para atender)                                     */
/* ------------------------------------------------------------------ */
export function Clientes({ linhas, media }: { linhas: LinhaCliente[]; media: number }) {
  const [todos, setTodos] = useState(false);
  const [ordem, setOrdem] = useState<'custo' | 'pct' | 'porNf'>('custo');
  const ord = [...linhas].sort((a, b) => (ordem === 'pct' ? b.pct - a.pct : ordem === 'porNf' ? b.fretePorNf - a.fretePorNf : b.custo - a.custo));
  const lista = todos ? ord : ord.slice(0, 25);
  const custoTotal = linhas.reduce((s, l) => s + l.custo, 0);
  return (
    <div className="bi-stack">
      <div className="fin-ordem">
        <Users size={16} /> Ordenar por:
        {([['custo', 'Maior custo'], ['pct', 'Maior % de frete'], ['porNf', 'Maior frete por NF']] as const).map(([k, l]) => (
          <button key={k} className={`chip ${ordem === k ? 'chip--on' : ''}`} onClick={() => setOrdem(k)}>{l}</button>
        ))}
      </div>
      <div className="card bi-ranking">
        <div className="table-scroll">
          <table className="bi-tabela">
            <thead>
              <tr>
                <th>Cliente</th><th className="r">NFs</th><th className="r">Faturamento</th><th className="r">Ticket médio</th>
                <th className="r">Custo de frete</th><th className="r">% do custo total</th><th className="r">Frete por NF</th>
                <th className="r">% frete</th><th className="r">Acima da meta</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((l) => (
                <tr key={l.nome}>
                  <td className="bi-tabela__nome"><span>{l.nome}</span></td>
                  <td className="r">{num(l.notas)}</td>
                  <td className="r">{moedaCompacta(l.faturamento)}</td>
                  <td className="r">{moedaCompacta(l.ticketMedio)}</td>
                  <td className="r">{formatMoney(l.custo)}</td>
                  <td className="r">{formatPercent(percentual(l.custo, custoTotal), 1)}</td>
                  <td className="r">{formatMoney(l.fretePorNf)}</td>
                  <td className="r">
                    <span className={`bi-pill bi-pill--${l.pct <= media ? 'verde' : l.pct <= media * 1.5 ? 'amarelo' : 'vermelho'}`} title={l.pctReal !== null ? `Só NFs com CTE: ${formatPercent(l.pctReal)}` : 'Pelo cotado (sem CTE)'}>{formatPercent(l.pct)}</span>
                  </td>
                  <td className="r">{l.comMeta ? (l.acimaMeta ? <span className="text-red strong">{l.acimaMeta} de {l.comMeta}</span> : <span className="text-green">0 de {l.comMeta}</span>) : <span className="muted">sem meta</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {linhas.length > 25 && <div className="fin-totais"><button className="btn btn-ghost btn-sm" onClick={() => setTodos((v) => !v)}>{todos ? 'Mostrar só os 25 primeiros' : `Mostrar todos (${linhas.length})`}</button></div>}
      </div>
      <p className="muted bi-legenda">Custo de frete = frete real nas NFs com CTE + cotado nas que aguardam. % frete: verde = até a média geral ({formatPercent(media)}); vermelho = 50% acima. Clientes com frete alto e ticket baixo são candidatos a pedido mínimo ou frete mínimo.</p>
    </div>
  );
}
