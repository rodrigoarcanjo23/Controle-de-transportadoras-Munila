import { useState } from 'react';
import { CircleCheck, ClipboardCopy, Clock, DollarSign, PackageX, RefreshCcw, ShieldCheck, TriangleAlert, Truck, Users, Warehouse } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { delta as deltaKpi, fmt as fmtInd, kpiDe } from '../indicadores/config';
import { variacao } from '../../lib/bi';
import { formatMoney, formatMoneyShort, formatPercent, percentual } from '../../lib/format';
import { KpiBI } from './KpiBI';
import { Graf, type CtxSecao } from './Secoes';
import { encurta, moedaCompacta, num } from './fmt';
import type { KpiArmazem } from './armazem';

/* ------------------------------------------------------------------ */
/* 7. Armazém (Indicadores Diários)                                     */
/* ------------------------------------------------------------------ */
function LinhaKpi({ k }: { k: KpiArmazem }) {
  const dl = deltaKpi(kpiDe(k.area, k.id), k.valor, k.anterior);
  return (
    <div className="bi-arm__kpi" title={k.desc}>
      <span>{k.label}</span>
      <strong>{fmtInd(k.valor, k.f, k.u)}</strong>
      {dl && <em className={`bi-delta bi-delta--${dl.c === 'good' ? 'bom' : dl.c === 'bad' ? 'ruim' : 'neutro'}`}>{dl.txt}</em>}
    </div>
  );
}

export function Armazem({ d, c, ap, ir }: CtxSecao) {
  const a = d.armazem;
  if (!a || !a.totalDias) {
    return (
      <div className="card card-pad bi-vazio">
        <Warehouse size={28} />
        <div>
          <strong>Sem lançamentos dos Indicadores Diários neste período.</strong>
          <p className="muted">Os números do armazém (recebimento, ocupação, expedição, coleta e devoluções) aparecem aqui assim que forem lançados.</p>
        </div>
        <button className="btn" onClick={() => ir('/indicadores')} data-pdf-ignore>Abrir Indicadores Diários</button>
      </div>
    );
  }
  const areas = [...new Set(a.kpis.map((k) => k.area))];
  const maxDiv = Math.max(1, ...a.divergencias.map((x) => x.qtd));
  return (
    <div className="bi-stack">
      <div className="bi-arm">
        {areas.map((ar) => {
          const ks = a.kpis.filter((k) => k.area === ar);
          return (
            <div key={ar} className="card bi-arm__card">
              <div className="bi-arm__head">
                <span className="bi-arm__cod">{ks[0].cod}</span>
                <strong>{ks[0].areaNome}</strong>
                <small>{a.dias[ar] ? `${a.dias[ar]} dia${a.dias[ar] > 1 ? 's' : ''} lançado${a.dias[ar] > 1 ? 's' : ''}` : 'sem lançamentos'}</small>
              </div>
              {ks.map((k) => <LinhaKpi key={k.id} k={k} />)}
              {ar === 'recebimento' && a.divergencias.length > 0 && (
                <div className="bi-arm__div">
                  <span>Divergências por tipo</span>
                  {a.divergencias.map((x) => (
                    <div key={x.tipo} className="bi-arm__divrow">
                      <em>{x.tipo}</em><i style={{ width: `${(x.qtd / maxDiv) * 100}%`, background: c.orange }} /><b>{x.qtd}</b>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!ap && <p className="muted bi-legenda">Dados lançados em <strong>Armazém › Indicadores Diários</strong>, com as mesmas fórmulas daquela tela. As setas comparam com {d.per.rotuloAnterior || 'o período anterior'}. Este bloco não é filtrado por região.</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 8. Devoluções                                                        */
/* ------------------------------------------------------------------ */
export function Devolucoes({ d, c, ap, ir }: CtxSecao) {
  const { dev, devAnt, m } = d;
  const axisTick = { fill: c.axis, fontSize: ap ? 13 : 11 };
  if (!dev.qtd) {
    return (
      <div className="card card-pad bi-vazio">
        <CircleCheck size={28} color={c.green} />
        <div><strong>Nenhuma devolução emitida neste período.</strong><p className="muted">Considerada a data de emissão da NF de devolução.</p></div>
      </div>
    );
  }
  const motivos = dev.motivos.slice(0, 8).map((x) => ({ name: x.nome, qtd: x.qtd, valor: x.valor }));
  const clientes = dev.clientes.slice(0, 8).map((x) => ({ name: x.nome, qtd: x.qtd, valor: x.valor }));
  const vs = devAnt ? `vs. ${d.per.rotuloAnterior}` : undefined;
  const lista = (data: { name: string; qtd: number; valor: number }[], chave: 'qtd' | 'valor', cor: string) => (
    <Graf ap={ap} h={300}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 70, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={c.grid} />
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={axisTick} width={ap ? 170 : 150} tickFormatter={(v: string) => encurta(v, 22)} />
          <Tooltip contentStyle={c.tooltip} cursor={{ fill: c.cursor }}
            formatter={(_v, _n, p) => { const x = (p as { payload: { qtd: number; valor: number } }).payload; return [`${x.qtd} devolução(ões) · ${formatMoney(x.valor)}`, '']; }} />
          <Bar isAnimationActive={false} dataKey={chave} fill={cor} radius={[0, 5, 5, 0]} barSize={ap ? 22 : 18}>
            <LabelList dataKey={chave} position="right" fill={c.axis} fontSize={ap ? 12 : 11} formatter={(v) => (chave === 'valor' ? formatMoneyShort(Number(v)) : String(v))} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Graf>
  );
  return (
    <div className="bi-stack">
      <div className="bi-kpis">
        <KpiBI label="Devoluções emitidas" tone="pink" icon={<RefreshCcw size={18} />} melhor="menor"
          value={num(dev.qtd)} sub={`${formatPercent(percentual(dev.qtd, m.notas), 1)} das NFs expedidas no período`}
          delta={devAnt ? variacao(dev.qtd, devAnt.qtd) : null} vsTexto={devAnt ? `vs. ${devAnt.qtd}` : vs} />
        <KpiBI label="Valor devolvido" tone="orange" icon={<DollarSign size={18} />} melhor="menor"
          value={moedaCompacta(dev.valor)} sub={`${formatPercent(percentual(dev.valor, m.faturamento), 2)} do faturamento expedido`}
          delta={devAnt ? variacao(dev.valor, devAnt.valor) : null} vsTexto={devAnt ? `vs. ${moedaCompacta(devAnt.valor)}` : vs} />
        <KpiBI label="Frete de retorno" tone="purple" icon={<Truck size={18} />} melhor="menor"
          value={moedaCompacta(dev.freteReverso)} sub={dev.valor ? `${formatPercent(percentual(dev.freteReverso, dev.valor), 1)} do valor devolvido` : undefined}
          delta={devAnt ? variacao(dev.freteReverso, devAnt.freteReverso) : null} vsTexto={devAnt ? `vs. ${moedaCompacta(devAnt.freteReverso)}` : vs} />
        <KpiBI label="Ainda em aberto" tone="blue" icon={<Clock size={18} />} melhor="menor"
          value={num(dev.abertas)} sub={dev.retornoMedio !== null ? `Retorno médio: ${num(dev.retornoMedio, 1)} dias da emissão até chegar no galpão` : 'Sem datas de chegada para medir o retorno'} />
      </div>
      <div className="chart-grid bi-grid-2">
        <div className="card chart-card">
          <h3><PackageX size={18} color={c.red} /> Motivos das devoluções</h3>
          {lista(motivos, 'qtd', c.red)}
        </div>
        <div className="card chart-card">
          <h3><Users size={18} color={c.orange} /> Clientes que mais devolveram (valor)</h3>
          {lista(clientes, 'valor', c.orange)}
        </div>
      </div>
      {!ap && (
        <div className="bi-ranking__leg">
          {dev.status.map((s) => <span key={s.nome}><b>{s.qtd}</b> {s.nome}</span>)}
          <button className="btn btn-ghost btn-sm" onClick={() => ir('/devolucoes')} data-pdf-ignore>Abrir Devoluções</button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Qualidade dos dados (uso interno — fora da apresentação e do PDF)    */
/* ------------------------------------------------------------------ */
export function Qualidade({ d, c, ir }: CtxSecao) {
  const [copiado, setCopiado] = useState('');
  const problemas = d.qualidade.filter((p) => p.nfs.length);
  const n = d.m.notas;
  // a falta de CTE é atraso normal de lançamento; não conta como "erro de cadastro"
  const comErro = new Set(problemas.filter((p) => p.id !== 'sem_cte').flatMap((p) => p.nfs.map((e) => e.id)));
  const limpas = percentual(n - comErro.size, n);

  const copiar = async (id: string, nfs: string[]) => {
    try { await navigator.clipboard.writeText(nfs.join('\n')); setCopiado(id); setTimeout(() => setCopiado(''), 1800); } catch { /* sem permissão */ }
  };

  return (
    <div className="bi-stack">
      <div className="bi-qual__top">
        <div className="card card-pad bi-qual__score">
          <ShieldCheck size={26} color={limpas >= 95 ? c.green : limpas >= 85 ? c.amber : c.red} />
          <div>
            <strong>{formatPercent(limpas, limpas === 100 ? 0 : 1)}</strong>
            <span>das {num(n)} NFs do período sem nenhum erro de cadastro</span>
          </div>
        </div>
        <p className="muted bi-legenda" style={{ margin: 0 }}>
          Este bloco é para a equipe: ele <strong>não aparece no modo apresentação nem no PDF</strong>. Corrigir estes pontos no Painel de Entregas deixa os números da próxima reunião mais confiáveis.
          Use "Copiar NFs" e cole na busca do Painel.
        </p>
      </div>
      {problemas.length ? (
        <div className="card bi-qual">
          {problemas.map((p) => (
            <div key={p.id} className="bi-qual__row">
              <span className={`bi-qual__grav bi-qual__grav--${p.gravidade}`} title={`Gravidade ${p.gravidade}`}><TriangleAlert size={15} /></span>
              <div className="bi-qual__txt">
                <strong>{p.titulo}</strong>
                <span>{p.impacto}{p.valor !== undefined && p.valor > 0 ? ` Cotado dessas NFs: ${formatMoney(p.valor)}.` : ''}</span>
                <div className="bi-qual__nfs">
                  {p.nfs.slice(0, 10).map((e) => <code key={e.id}>{e.nota_fiscal}</code>)}
                  {p.nfs.length > 10 && <span className="muted">+{p.nfs.length - 10}</span>}
                </div>
              </div>
              <div className="bi-qual__num">
                <strong>{num(p.nfs.length)}</strong>
                <span>{formatPercent(percentual(p.nfs.length, n), 1)}</span>
              </div>
              <div className="bi-qual__acoes">
                <button className="btn btn-sm" onClick={() => copiar(p.id, p.nfs.map((e) => e.nota_fiscal))}>
                  <ClipboardCopy size={14} /> {copiado === p.id ? 'Copiado!' : 'Copiar NFs'}
                </button>
                {p.id === 'sem_cte' && <button className="btn btn-ghost btn-sm" onClick={() => ir('/ctes')}>Registro de CTE</button>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card card-pad bi-vazio"><CircleCheck size={28} color={c.green} /><strong>Nenhuma pendência de cadastro no período.</strong></div>
      )}
    </div>
  );
}
