import type { ReactNode } from 'react';
import {
  CalendarClock, CircleCheck, Clock, DollarSign, Info, Package, Percent, PiggyBank, Receipt,
  Route, Scale, Sparkles, TrendingUp, TriangleAlert, Truck,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { useChartTheme } from '../../hooks/useChartTheme';
import {
  pctPrazoGrupo, variacao, type Destaque, type LinhaMeta, type ProblemaDados, type ResumoDevolucoes, type LinhaRanking, type MetricasBI, type PeriodoBI, type serieEvolucao,
} from '../../lib/bi';
import { GRUPO_CRITICO, GRUPO_EM_ANDAMENTO } from '../../lib/constants';
import { diasDesde, formatDate, formatMoney, formatMoneyShort, formatPercent } from '../../lib/format';
import { Anel, KpiBI, TextoMarcado } from './KpiBI';
import type { ResumoArmazem } from './armazem';
import { corPrazo, encurta, moedaCompacta, num } from './fmt';

export interface DadosBI {
  m: MetricasBI; ma: MetricasBI | null; per: PeriodoBI;
  serie: ReturnType<typeof serieEvolucao>; destaques: Destaque[];
  ranking: LinhaRanking[]; metas: LinhaMeta[];
  /** null = tabela dos Indicadores Diários ainda não existe/carregou */
  armazem: ResumoArmazem | null;
  dev: ResumoDevolucoes; devAnt: ResumoDevolucoes | null;
  qualidade: ProblemaDados[];
}
export interface CtxSecao {
  d: DadosBI; c: ReturnType<typeof useChartTheme>;
  /** true = modo apresentação (tela cheia) */
  ap: boolean;
  /** altura útil da área do slide, em px (só no modo apresentação) */
  alto: number;
  abrir: (status: string[]) => void;
  /** abre outra tela do sistema */
  ir: (rota: string) => void;
}

/** Área do gráfico: altura fixa na página; no slide ocupa todo o espaço que sobra. */
export function Graf({ ap, h, largura, children }: { ap: boolean; h: number; largura?: number; children: ReactNode }) {
  if (ap) return <div className="bi-graf"><div className="bi-graf__in">{children}</div></div>;
  const dentro = <div style={{ minWidth: largura, height: h }}>{children}</div>;
  return largura ? <div className="chart-scroll">{dentro}</div> : dentro;
}

/* ------------------------------------------------------------------ */
/* 1. Resumo do período (manchete)                                      */
/* ------------------------------------------------------------------ */
export function Resumo({ d, c, ap }: CtxSecao) {
  const { m, ma, per } = d;
  const vs = ma ? `vs. ${per.rotuloAnterior}` : undefined;
  const pendentes = m.notas - m.conferidas;
  return (
    <div className="bi-stack">
      <div className="bi-kpis">
        <KpiBI label="Faturamento expedido" tone="blue" icon={<DollarSign size={18} />}
          value={moedaCompacta(m.faturamento)} sub={`${num(m.notas)} NFs · ${formatMoney(m.faturamento)}`}
          delta={ma ? variacao(m.faturamento, ma.faturamento) : null} vsTexto={ma ? `vs. ${moedaCompacta(ma.faturamento)}` : undefined} />
        <KpiBI label="% de frete (CTE)" tone="orange" icon={<Percent size={18} />} melhor="menor" tipo="pp"
          value={m.conferidas ? formatPercent(m.pctFrete) : '—'}
          sub={m.conferidas ? `Frete real de ${moedaCompacta(m.freteReal)} em ${num(m.conferidas)} NFs conferidas` : 'Nenhuma NF com frete real no período'}
          delta={ma && ma.conferidas && m.conferidas ? m.pctFrete - ma.pctFrete : null} vsTexto={ma?.conferidas ? `vs. ${formatPercent(ma.pctFrete)}` : vs} />
        <KpiBI label="Entregas no prazo" tone="green" icon={<CircleCheck size={18} />} tipo="pp"
          value={m.pctNoPrazo !== null ? formatPercent(m.pctNoPrazo, 1) : '—'}
          sub={m.avaliadasPrazo ? `${num(m.noPrazo)} de ${num(m.avaliadasPrazo)} entregas com data prevista` : 'Sem entregas com data prevista'}
          delta={ma && ma.pctNoPrazo !== null && m.pctNoPrazo !== null ? m.pctNoPrazo - ma.pctNoPrazo : null}
          vsTexto={ma?.pctNoPrazo != null ? `vs. ${formatPercent(ma.pctNoPrazo, 1)}` : vs} />
        <KpiBI label="Lead time médio" tone="purple" icon={<Clock size={18} />} tipo="dias" melhor="menor"
          value={m.leadTime !== null ? num(m.leadTime, 1) : '—'} unit={m.leadTime !== null ? ' dias' : undefined}
          sub="Do pedido à entrega no cliente"
          delta={ma && ma.leadTime !== null && m.leadTime !== null ? m.leadTime - ma.leadTime : null}
          vsTexto={ma?.leadTime != null ? `vs. ${num(ma.leadTime, 1)} dias` : vs} />
      </div>

      <div className="bi-strip">
        <div className="bi-strip__item"><Receipt size={16} /><span>NFs expedidas</span><strong>{num(m.notas)}</strong></div>
        <div className="bi-strip__item"><Package size={16} /><span>Volumes</span><strong>{num(m.volumes)}</strong></div>
        <div className="bi-strip__item" title={m.pesosIgnorados.length ? `${m.pesosIgnorados.length} peso(s) fora do padrão não entram no total` : undefined}>
          <Scale size={16} /><span>Peso</span><strong>{num(m.peso / 1000, 1)} t{m.pesosIgnorados.length ? '*' : ''}</strong>
        </div>
        <div className="bi-strip__item">
          <PiggyBank size={16} /><span>Frete real × cotado</span>
          <strong className={m.economia >= 0 ? 'text-green' : 'text-red'}>{moedaCompacta(Math.abs(m.economia))}</strong>
          {m.cotadoComparavel > 0 && <em>{m.economia >= 0 ? 'economia' : 'acima do cotado'} de {formatPercent(Math.abs(m.economiaPct), 1)}</em>}
        </div>
        <div className="bi-strip__item bi-strip__item--wide">
          <Receipt size={16} /><span>Conferidas por CTE</span>
          <strong>{formatPercent(m.cobertura, 0)}</strong>
          <div className="bi-progress"><i style={{ width: `${m.cobertura}%`, background: c.green }} /></div>
        </div>
      </div>

      <div className={`card bi-destaques ${ap ? 'bi-destaques--ap' : ''}`}>
        <h3><Sparkles size={18} color={c.amber} /> Destaques do período</h3>
        {d.destaques.length ? (
          <ul>
            {d.destaques.map((x, i) => (
              <li key={i} className={`bi-destaque bi-destaque--${x.tom}`}><i /><span><TextoMarcado texto={x.texto} /></span></li>
            ))}
          </ul>
        ) : <p className="muted">Sem dados suficientes para gerar destaques.</p>}
      </div>

      {!ap && (pendentes > 0 || m.pesosIgnorados.length > 0) && (
        <div className="callout bi-nota" data-pdf-ignore>
          <Info size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>Como ler estes números. </strong>
            O % de frete usa somente as {num(m.conferidas)} NFs que já têm frete real (CTE), comparando com o valor dessas mesmas NFs.
            {pendentes > 0 && <> Ainda {pendentes === 1 ? 'falta' : 'faltam'} <strong>{num(pendentes)} NF{pendentes > 1 ? 's' : ''} ({formatPercent(100 - m.cobertura, 0)})</strong> sem CTE — pelo cotado, o custo previsto delas é de {formatMoney(m.cotadoPendente)}.</>}
            {m.pesosIgnorados.length > 0 && (
              <> Pesos fora do padrão ignorados no total: {m.pesosIgnorados.slice(0, 5).map((e, i) => (
                <span key={e.id}>{i ? ', ' : ''}<strong>NF {e.nota_fiscal}</strong> ({num(Number(e.peso_kg))} kg)</span>
              ))}{m.pesosIgnorados.length > 5 ? ` e mais ${m.pesosIgnorados.length - 5}` : ''} — vale corrigir no Painel de Entregas.</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Prazo e nível de serviço                                          */
/* ------------------------------------------------------------------ */
export function Servico({ d, c, ap, alto, abrir }: CtxSecao) {
  const { m, serie } = d;
  const etapas = [
    { label: 'Pedido → Faturamento', v: m.etapas.pedidoFat, cor: c.blue },
    { label: 'Faturamento → Coleta', v: m.etapas.fatColeta, cor: c.amber },
    { label: 'Coleta → Entrega', v: m.etapas.coletaEntrega, cor: c.green },
  ];
  const somaEt = etapas.reduce((s, e) => s + (e.v ?? 0), 0);
  const transp = m.porTransp.filter((t) => t.avaliadas >= 2)
    .map((t) => ({ name: t.nome, pct: +(pctPrazoGrupo(t) ?? 0).toFixed(1), avaliadas: t.avaliadas, noPrazo: t.noPrazo }))
    .sort((a, b) => b.pct - a.pct).slice(0, 10);
  const pontos = serie.pontos.filter((p) => p.pctPrazo !== null);
  const hGraf = 300;
  const baixa = ap && alto < 650; // projetor 1366×768
  const listaVenc = m.vencidasAbertas.slice(0, baixa ? 2 : ap ? 4 : 5);
  const axisTick = { fill: c.axis, fontSize: ap ? 13 : 11 };

  return (
    <div className="bi-stack">
      <div className="bi-servico">
        <div className="card card-pad bi-prazo">
          <Anel valor={m.pctNoPrazo ?? 0} cor={corPrazo(c, m.pctNoPrazo)} trilho={c.grid} tamanho={baixa ? 120 : ap ? 160 : 140}>
            <strong>{m.pctNoPrazo !== null ? formatPercent(m.pctNoPrazo, 0) : '—'}</strong>
            <span>no prazo</span>
          </Anel>
          <div className="bi-prazo__nums">
            <div><span className="dot" style={{ background: c.green }} />No prazo<strong>{num(m.noPrazo)}</strong></div>
            <div><span className="dot" style={{ background: c.red }} />Com atraso<strong>{num(m.atrasadas)}</strong></div>
            {m.atrasoMedio !== null && <div className="muted">Atraso médio<strong>{num(m.atrasoMedio, 1)} d</strong></div>}
            {m.semPrevisao > 0 && <div className="muted">Entregues sem data prevista<strong>{num(m.semPrevisao)}</strong></div>}
          </div>
        </div>

        <div className="card card-pad bi-jornada">
          <h3><Route size={18} color={c.blue} /> Jornada do pedido <small>média de dias por etapa</small></h3>
          {somaEt > 0 ? (
            <>
              <div className="bi-jornada__barra">
                {etapas.filter((e) => e.v !== null).map((e) => (
                  <div key={e.label} style={{ flexGrow: Math.max(e.v ?? 0, somaEt * 0.08), background: e.cor }} title={`${e.label}: ${num(e.v ?? 0, 1)} dias`}>
                    {num(e.v ?? 0, 1)} d
                  </div>
                ))}
              </div>
              <ul className="bi-jornada__leg">
                {etapas.map((e) => (
                  <li key={e.label}><span className="dot" style={{ background: e.cor }} />{e.label}<strong>{e.v !== null ? `${num(e.v, 1)} dias` : '—'}</strong></li>
                ))}
              </ul>
              {m.leadTime !== null && <p className="bi-jornada__total">Lead time total (pedido → entrega): <strong>{num(m.leadTime, 1)} dias</strong></p>}
            </>
          ) : <p className="muted">Preencha as datas de pedido, faturamento, coleta e entrega para ver a jornada.</p>}
        </div>

        <div className="card card-pad bi-abertas">
          <h3><CalendarClock size={18} color={c.orange} /> Em aberto agora</h3>
          <div className="stat-list">
            <button className="stat-row" onClick={() => abrir(GRUPO_EM_ANDAMENTO)} title="Ver no Painel de Entregas">
              <span>Em andamento</span><strong className="text-orange">{num(m.abertas)}</strong>
            </button>
            <button className="stat-row stat-row--danger" onClick={() => abrir(GRUPO_CRITICO)} title="Ver no Painel de Entregas">
              <span>Atrasadas ou com problema</span><strong>{num(m.criticas)}</strong>
            </button>
          </div>
          {m.vencidasAbertas.length > 0 && (
            <div className="bi-vencidas">
              <div className="bi-vencidas__tit"><TriangleAlert size={14} /> {num(m.vencidasAbertas.length)} com previsão vencida</div>
              {listaVenc.map((e) => (
                <div key={e.id} className="bi-vencidas__row">
                  <span className="mono">NF {e.nota_fiscal}</span>
                  <span className="bi-vencidas__cli">{e.clientes?.nome ?? '-'}</span>
                  <span className="text-red" title={`Previsão: ${formatDate(e.data_previsao)}`}>{diasDesde(e.data_previsao)} d</span>
                </div>
              ))}
              {m.vencidasAbertas.length > listaVenc.length && <div className="muted" style={{ fontSize: '0.75rem' }}>e mais {m.vencidasAbertas.length - listaVenc.length}…</div>}
            </div>
          )}
        </div>
      </div>

      <div className="chart-grid">
        <div className="card chart-card">
          <h3><TrendingUp size={18} color={c.green} /> % de entregas no prazo {serie.porMes ? 'por mês' : 'por dia de faturamento'}</h3>
          {pontos.length ? (
            <Graf ap={ap} h={hGraf}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pontos} margin={{ top: 22, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.grid} />
                  <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={axisTick} minTickGap={12} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={axisTick} tickFormatter={(v) => `${v}%`} width={44} />
                  <Tooltip contentStyle={c.tooltip} cursor={{ fill: c.cursor }}
                    formatter={(v, _n, p) => { const x = (p as { payload: { noPrazo: number; avaliadas: number } }).payload; return [`${formatPercent(Number(v), 1)} (${x.noPrazo} de ${x.avaliadas})`, 'No prazo']; }} />
                  <Bar isAnimationActive={false} dataKey="pctPrazo" radius={[5, 5, 0, 0]} maxBarSize={48}>
                    {pontos.map((p) => <Cell key={p.chave} fill={corPrazo(c, p.pctPrazo)} />)}
                    {pontos.length <= 16 && <LabelList dataKey="pctPrazo" position="top" fill={c.axis} fontSize={ap ? 13 : 11} formatter={(v) => `${Math.round(Number(v))}%`} />}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Graf>
          ) : <p className="muted">Nenhuma entrega com data prevista e data de entrega no período.</p>}
        </div>
        <div className="card chart-card">
          <h3><Truck size={18} color={c.purple} /> No prazo por transportadora</h3>
          {transp.length ? (
            <Graf ap={ap} h={hGraf}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={transp} layout="vertical" margin={{ top: 4, right: 44, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={c.grid} />
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={axisTick} width={ap ? 150 : 120} tickFormatter={(v: string) => encurta(v)} />
                  <Tooltip contentStyle={c.tooltip} cursor={{ fill: c.cursor }}
                    formatter={(v, _n, p) => { const x = (p as { payload: { noPrazo: number; avaliadas: number } }).payload; return [`${formatPercent(Number(v), 1)} (${x.noPrazo} de ${x.avaliadas})`, 'No prazo']; }} />
                  <Bar isAnimationActive={false} dataKey="pct" radius={[0, 5, 5, 0]} barSize={ap ? 22 : 16}>
                    {transp.map((t) => <Cell key={t.name} fill={corPrazo(c, t.pct)} />)}
                    <LabelList dataKey="pct" position="right" fill={c.axis} fontSize={ap ? 13 : 11} formatter={(v) => `${Math.round(Number(v))}%`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Graf>
          ) : <p className="muted">É preciso ao menos 2 entregas com data prevista por transportadora.</p>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Evolução                                                          */
/* ------------------------------------------------------------------ */
export function Evolucao({ d, c, ap }: CtxSecao) {
  const { serie } = d;
  const axisTick = { fill: c.axis, fontSize: ap ? 13 : 11 };
  const h = 320;
  const largura = ap || serie.porMes ? undefined : Math.max(640, serie.pontos.length * 34);
  return (
    <div className="card chart-card">
      <h3><TrendingUp size={18} color={c.blue} /> Faturamento × % de frete {serie.porMes ? '(mensal)' : '(diário)'}</h3>
      <p className="muted bi-legenda">Barras: faturamento expedido. Linha: frete real ÷ valor das NFs conferidas.</p>
      <Graf ap={ap} h={h} largura={largura}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={serie.pontos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.grid} />
              <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={axisTick} dy={6} minTickGap={16} />
              <YAxis yAxisId="l" axisLine={false} tickLine={false} tick={axisTick} tickFormatter={formatMoneyShort} width={70} />
              <YAxis yAxisId="r" orientation="right" axisLine={false} tickLine={false} tick={{ ...axisTick, fill: c.orange }} tickFormatter={(v) => `${v}%`} width={48} />
              <Tooltip contentStyle={c.tooltip} cursor={{ fill: c.cursor }}
                formatter={(v, n) => (n === '% de frete' ? [formatPercent(Number(v)), n] : [formatMoney(Number(v)), n])} />
              <Legend verticalAlign="top" height={32} iconType="circle" />
              <Bar isAnimationActive={false} yAxisId="l" dataKey="faturamento" name="Faturamento" fill={c.blue} radius={[4, 4, 0, 0]} maxBarSize={serie.porMes ? 56 : 22} />
              <Line isAnimationActive={false} yAxisId="r" type="monotone" dataKey="pctFrete" name="% de frete" stroke={c.orange} strokeWidth={2.5} dot={{ r: serie.porMes ? 4 : 2, fill: c.orange }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
      </Graf>
    </div>
  );
}

