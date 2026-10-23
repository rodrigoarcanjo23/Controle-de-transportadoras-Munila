import { useState, type ReactNode } from 'react';
import { Award, CircleCheck, Flag, Map as MapIcon, Target, TriangleAlert, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { pctFreteGrupo, pctPrazoGrupo, seloPrazo, type LinhaMeta, type Selo } from '../../lib/bi';
import { formatMoney, formatMoneyShort, formatPercent, percentual } from '../../lib/format';
import { Graf, type CtxSecao } from './Secoes';
import { encurta, moedaCompacta, num } from './fmt';
import { COLUNAS_UF, GRADE_UF, LINHAS_UF, NOME_UF, misturar } from './mapaBrasil';

const SELO_TXT: Record<Selo, string> = { verde: 'Bom', amarelo: 'Atenção', vermelho: 'Crítico', cinza: 'Poucos dados' };
const pctOuTraco = (v: number | null, casas = 1) => (v === null ? '—' : formatPercent(v, casas));

function Pill({ selo, children, title }: { selo: Selo; children: ReactNode; title?: string }) {
  return <span className={`bi-pill bi-pill--${selo}`} title={title}>{children}</span>;
}

/* ------------------------------------------------------------------ */
/* 4. Ranking de transportadoras                                        */
/* ------------------------------------------------------------------ */
export function Transportadoras({ d, ap }: CtxSecao) {
  const linhas = d.ranking.filter((l) => l.notas > 0);
  const mostrar = ap ? linhas.slice(0, 9) : linhas;
  const media = d.m.pctFrete;
  if (!linhas.length) return <div className="card card-pad muted">Sem NFs no período.</div>;
  const melhor = linhas.find((l) => l.nota !== null);
  return (
    <div className="bi-stack">
      <div className="card bi-ranking">
        <div className="table-scroll">
          <table className="bi-tabela">
            <thead>
              <tr>
                <th>#</th><th>Transportadora</th><th className="r">Nota</th><th className="r">NFs</th>
                <th className="r">Faturamento</th><th className="r">Custo de frete</th><th className="r">% frete (CTE)</th>
                <th className="r">No prazo</th><th className="r">Atraso médio</th><th className="r">Real × cotado</th>
                {!ap && <th className="r">Críticas</th>}
              </tr>
            </thead>
            <tbody>
              {mostrar.map((l, i) => (
                <tr key={l.nome}>
                  <td className="bi-tabela__pos">{l.nota !== null ? i + 1 : '–'}</td>
                  <td className="bi-tabela__nome"><span><span className={`bi-semaforo bi-semaforo--${l.selo}`} title={SELO_TXT[l.selo]} />{l.nome}</span></td>
                  <td className="r">
                    {l.nota !== null ? (
                      <div className="bi-nota-bar" title={`Nota ${l.nota} de 100 — ${SELO_TXT[l.selo]}`}>
                        <span><i className={`bi-nota-bar--${l.selo}`} style={{ width: `${l.nota}%` }} /></span><b>{l.nota}</b>
                      </div>
                    ) : <span className="muted">—</span>}
                  </td>
                  <td className="r">{num(l.notas)}</td>
                  <td className="r">{moedaCompacta(l.faturamento)}</td>
                  <td className="r">{moedaCompacta(l.custo)}</td>
                  <td className="r"><Pill selo={l.selos.frete} title={`${l.conferidas} NFs com CTE · média geral ${formatPercent(media)}`}>{pctOuTraco(l.pctFrete, 2)}</Pill></td>
                  <td className="r"><Pill selo={l.selos.prazo} title={`${l.avaliadas} entregas com data prevista`}>{pctOuTraco(l.pctPrazo, 0)}</Pill></td>
                  <td className="r">{l.atrasoMedio !== null ? `${num(l.atrasoMedio, 1)} d` : '—'}</td>
                  <td className="r">
                    <Pill selo={l.selos.desvio} title="Frete real comparado ao cotado, nas NFs que têm os dois">
                      {l.desvioPct === null ? '—' : `${l.desvioPct > 0 ? '+' : ''}${num(l.desvioPct, 1)}%`}
                    </Pill>
                  </td>
                  {!ap && <td className="r">{l.criticas ? <span className="text-red strong">{l.criticas}</span> : <span className="muted">0</span>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ap && linhas.length > mostrar.length && <p className="muted bi-legenda" style={{ padding: '0 16px 10px' }}>+ {linhas.length - mostrar.length} transportadoras com menos NFs — veja a lista completa no painel.</p>}
      </div>
      <div className="bi-ranking__leg">
        {melhor && <span><Award size={15} /> Melhor nota: <strong>{melhor.nome}</strong> ({melhor.nota})</span>}
        <span><span className="bi-semaforo bi-semaforo--verde" /> Bom</span>
        <span><span className="bi-semaforo bi-semaforo--amarelo" /> Atenção</span>
        <span><span className="bi-semaforo bi-semaforo--vermelho" /> Crítico</span>
        <span className="muted">Nota: prazo 50% · % de frete vs. média geral ({formatPercent(media)}) 30% · real × cotado 20%. Cinza = menos de 3 NFs para avaliar.</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Clientes e metas de frete                                         */
/* ------------------------------------------------------------------ */
const STATUS_META: Record<LinhaMeta['status'], [Selo, string]> = {
  dentro: ['verde', 'Dentro da meta'], acima: ['vermelho', 'Acima da meta'], sem_cte: ['cinza', 'Aguardando CTE'], sem_nfs: ['cinza', 'Sem NFs no período'],
};

export function ClientesMetas({ d, c, ap }: CtxSecao) {
  const { m, metas } = d;
  const top = m.porCliente.slice(0, 10).map((x) => ({ name: x.nome, valor: x.faturamento, share: percentual(x.faturamento, m.faturamento), notas: x.notas }));
  const top5 = percentual(m.porCliente.slice(0, 5).reduce((s, x) => s + x.faturamento, 0), m.faturamento);
  const comDados = metas.filter((x) => x.status === 'dentro' || x.status === 'acima');
  const dentro = comDados.filter((x) => x.status === 'dentro').length;
  const listaMetas = ap ? metas.filter((x) => x.status !== 'sem_nfs').slice(0, 7) : metas;
  const axisTick = { fill: c.axis, fontSize: ap ? 13 : 11 };

  return (
    <div className="chart-grid bi-grid-2">
      <div className="card chart-card">
        <h3><Users size={18} color={c.green} /> Top 10 clientes (faturamento)</h3>
        <p className="muted bi-legenda">Os 5 maiores somam <strong>{formatPercent(top5, 0)}</strong> do faturamento do período.</p>
        <Graf ap={ap} h={380}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top} layout="vertical" margin={{ top: 4, right: 92, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={c.grid} />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={axisTick} width={ap ? 170 : 140} tickFormatter={(v: string) => encurta(v, 20)} />
              <Tooltip contentStyle={c.tooltip} cursor={{ fill: c.cursor }}
                formatter={(v, _n, p) => { const x = (p as { payload: { share: number; notas: number } }).payload; return [`${formatMoney(Number(v))} · ${formatPercent(x.share, 1)} · ${x.notas} NFs`, 'Faturamento']; }} />
              <Bar isAnimationActive={false} dataKey="valor" fill={c.green} radius={[0, 5, 5, 0]} barSize={ap ? 22 : 18}>
                <LabelList dataKey="valor" position="right" fill={c.axis} fontSize={ap ? 12 : 11}
                  formatter={(v) => `${formatMoneyShort(Number(v))} · ${num(percentual(Number(v), m.faturamento), 0)}%`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Graf>
      </div>

      <div className="card chart-card bi-metas">
        <h3><Target size={18} color={c.orange} /> Metas de frete <small>cliente × transportadora</small></h3>
        {!metas.length ? (
          <p className="muted">Nenhuma meta cadastrada. Cadastre em <strong>Cadastros › Clientes & Metas</strong> para acompanhar aqui.</p>
        ) : (
          <>
            <div className="bi-metas__resumo">
              <div><strong className="text-green">{dentro}</strong><span>dentro da meta</span></div>
              <div><strong className="text-red">{comDados.length - dentro}</strong><span>acima da meta</span></div>
              <div><strong>{metas.length - comDados.length}</strong><span>sem CTE / sem NFs</span></div>
            </div>
            <div className="bi-metas__lista">
              {listaMetas.map((x) => {
                const [selo, txt] = STATUS_META[x.status];
                const v = x.realizado ?? x.previsto;
                const escala = Math.max(x.meta * 1.6, v ?? 0) || 1;
                return (
                  <div key={x.id} className="bi-meta">
                    <div className="bi-meta__top">
                      <div className="bi-meta__nomes"><strong>{x.cliente}</strong><span>{x.transportadora}</span></div>
                      <Pill selo={selo}>{txt}</Pill>
                    </div>
                    <div className="bi-meta__barra" title={`Meta ${formatPercent(x.meta)} · realizado ${pctOuTraco(x.realizado, 2)}`}>
                      {v !== null && <i className={`bi-meta__fill bi-meta__fill--${x.realizado === null ? 'cinza' : selo}`} style={{ width: `${(v / escala) * 100}%` }} />}
                      <span className="bi-meta__alvo" style={{ left: `${(x.meta / escala) * 100}%` }}><Flag size={11} /></span>
                    </div>
                    <div className="bi-meta__nums">
                      <span>Meta <b>{formatPercent(x.meta)}</b></span>
                      <span>{x.realizado !== null ? <>Realizado <b>{formatPercent(x.realizado)}</b></> : x.previsto !== null ? <>Previsto (cotado) <b>{formatPercent(x.previsto)}</b></> : 'Sem NFs'}</span>
                      <span>{x.notas} NF{x.notas === 1 ? '' : 's'}{x.acima ? <> · <b className="text-red">{x.acima} acima</b></> : ''}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {ap && metas.length > listaMetas.length && <p className="muted bi-legenda">+ {metas.length - listaMetas.length} metas sem NFs ou fora do slide.</p>}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 6. Destinos — mapa por UF                                            */
/* ------------------------------------------------------------------ */
type MetricaMapa = 'faturamento' | 'frete' | 'prazo';
const METRICAS: [MetricaMapa, string][] = [['faturamento', 'Faturamento'], ['frete', '% de frete'], ['prazo', 'No prazo']];

export function Destinos({ d, c, ap, alto }: CtxSecao) {
  const [metrica, setMetrica] = useState<MetricaMapa>('faturamento');
  const { m } = d;
  const ufs = new Map(m.porUF.map((u) => [u.uf, u]));
  const maxFat = Math.max(...m.porUF.map((u) => u.faturamento), 1);
  const media = m.pctFrete;
  const base = c.dark ? '#16263a' : '#e3edf8';

  const info = (uf: string) => {
    const g = ufs.get(uf);
    if (!g) return null;
    const frete = g.conferidas ? pctFreteGrupo(g) : null;
    const prazo = pctPrazoGrupo(g);
    let cor: string | null = null; let forte = true; let valor = '—';
    if (metrica === 'faturamento') {
      const t = Math.sqrt(g.faturamento / maxFat);
      cor = misturar(base, c.blue, 0.15 + t * 0.85); forte = t > 0.45; valor = formatMoneyShort(g.faturamento);
    } else if (metrica === 'frete' && frete !== null && media > 0) {
      // mesmas faixas das etiquetas da tabela: até a média · até 20% acima · acima disso
      cor = g.conferidas < 3 ? misturar(base, c.axis, 0.5) : frete <= media ? c.green : frete <= media * 1.2 ? c.amber : c.red;
      valor = formatPercent(frete, 1);
    } else if (metrica === 'prazo' && prazo !== null) {
      cor = g.avaliadas < 3 ? misturar(base, c.axis, 0.5) : prazo >= 90 ? c.green : prazo >= 75 ? c.amber : c.red;
      valor = formatPercent(prazo, 0);
    }
    return { g, frete, prazo, cor, forte, valor };
  };

  const tile = ap ? Math.max(44, Math.min(78, Math.floor((alto - 210 - 5 * LINHAS_UF) / LINHAS_UF))) : 56;
  const lista = [...m.porUF].filter((u) => u.uf !== 'ND').sort((a, b) => {
    if (metrica === 'frete') return (b.conferidas ? pctFreteGrupo(b) : -1) - (a.conferidas ? pctFreteGrupo(a) : -1);
    if (metrica === 'prazo') return (pctPrazoGrupo(a) ?? 101) - (pctPrazoGrupo(b) ?? 101);
    return b.faturamento - a.faturamento;
  }).slice(0, ap ? 10 : 14);

  return (
    <div className="bi-destinos">
      <div className="card card-pad bi-mapa">
        <div className="bi-mapa__top">
          <h3><MapIcon size={18} color={c.blue} /> Mapa por estado de destino</h3>
          <div className="chips" role="tablist">
            {METRICAS.map(([k, l]) => (
              <button key={k} type="button" className={`chip ${metrica === k ? 'chip--on' : ''}`} onClick={() => setMetrica(k)} aria-pressed={metrica === k}>{l}</button>
            ))}
          </div>
        </div>
        <div className="bi-mapa__grade" style={{ gridTemplateColumns: `repeat(${COLUNAS_UF}, ${tile}px)`, gridTemplateRows: `repeat(${LINHAS_UF}, ${tile}px)` }}>
          {Object.entries(GRADE_UF).map(([uf, [col, lin]]) => {
            const x = info(uf);
            const title = x
              ? `${NOME_UF[uf]}\n${x.g.notas} NFs · ${formatMoney(x.g.faturamento)}\n% frete (CTE): ${pctOuTraco(x.frete, 2)}\nNo prazo: ${pctOuTraco(x.prazo, 0)}`
              : `${NOME_UF[uf]}: sem NFs no período`;
            return (
              <div key={uf} className={`bi-uf ${x?.cor ? '' : 'bi-uf--vazio'} ${x?.cor && x.forte ? 'bi-uf--forte' : ''}`}
                style={{ gridColumn: col + 1, gridRow: lin + 1, background: x?.cor ?? undefined, fontSize: tile < 52 ? 11 : 13 }} title={title}>
                <b>{uf}</b>
                {x?.cor && tile >= 50 && <small>{x.valor}</small>}
              </div>
            );
          })}
        </div>
        <p className="muted bi-legenda" style={{ marginTop: 10 }}>
          {metrica === 'faturamento' && 'Quanto mais escuro, maior o faturamento expedido para o estado.'}
          {metrica === 'frete' && <>Verde = até a média geral ({formatPercent(media)}) · amarelo = até 20% acima · vermelho = acima disso. Só NFs com CTE.</>}
          {metrica === 'prazo' && 'Verde = 90% ou mais no prazo · amarelo = 75% a 89% · vermelho = abaixo de 75%.'}
          {' '}Cinza = sem dados ou menos de 3 NFs.
        </p>
      </div>

      <div className="card bi-ranking">
        <div className="bi-mapa__top" style={{ padding: '16px 18px 0' }}>
          <h3>{metrica === 'prazo' ? <TriangleAlert size={18} color={c.red} /> : <CircleCheck size={18} color={c.blue} />}
            {metrica === 'faturamento' ? 'Estados que mais faturam' : metrica === 'frete' ? 'Estados com frete mais pesado' : 'Estados com mais atraso'}</h3>
        </div>
        <div className="table-scroll">
          <table className="bi-tabela">
            <thead><tr><th>UF</th><th className="r">NFs</th><th className="r">Faturamento</th><th className="r">% frete</th><th className="r">No prazo</th></tr></thead>
            <tbody>
              {lista.map((u) => {
                const f = u.conferidas ? pctFreteGrupo(u) : null; const p = pctPrazoGrupo(u);
                const sf: Selo = f === null || u.conferidas < 3 ? 'cinza' : f <= media ? 'verde' : f <= media * 1.2 ? 'amarelo' : 'vermelho';
                return (
                  <tr key={u.uf}>
                    <td className="bi-tabela__nome" title={NOME_UF[u.uf]}><span><b>{u.uf}</b>{ap && <span className="muted">{NOME_UF[u.uf] ?? ''}</span>}</span></td>
                    <td className="r">{num(u.notas)}</td>
                    <td className="r">{moedaCompacta(u.faturamento)}</td>
                    <td className="r"><Pill selo={sf}>{pctOuTraco(f, 2)}</Pill></td>
                    <td className="r"><Pill selo={u.avaliadas >= 3 ? seloPrazo(p) : 'cinza'}>{pctOuTraco(p, 0)}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
