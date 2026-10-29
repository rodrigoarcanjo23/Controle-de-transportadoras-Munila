import { CONCEITO, CRITERIOS, type AvaliacaoTransportadora } from '../../lib/avaliacao';
import { formatDate, formatMoney } from '../../lib/format';
import { ufDestino } from '../../lib/filtrosEntrega';
import { ocorrenciaDe } from '../../lib/ocorrencias';
import { AnelNota, BarrasHistorico, ChipNota, DeltaNota } from './Componentes';
import { fmtNota } from './fmt';

/** Relatório da avaliação mensal (mesmo conteúdo na tela e no papel/PDF). */
export function RelatorioAvaliacao({ a, rotuloMes, anterior, meses, historico, emAndamento }: {
  a: AvaliacaoTransportadora; rotuloMes: string; anterior: number | null; meses: string[]; historico: (number | null)[]; emAndamento: boolean;
}) {
  const conc = a.conceito ? CONCEITO[a.conceito] : null;
  return (
    <div className="av-rel">
      <header className="av-rel__top">
        <img src="/favicon.png" alt="" />
        <div>
          <h1>Avaliação de desempenho</h1>
          <p>Munila · {rotuloMes}{emAndamento ? ' (mês em andamento)' : ''}</p>
        </div>
        <div className="av-rel__transp"><span>Transportadora</span><strong>{a.nome}</strong></div>
      </header>

      <section className="av-rel__resumo">
        <AnelNota nota={a.nota} tamanho={110} />
        <div className="av-rel__resumo-txt">
          <div className="av-rel__nota">
            Nota geral <b>{fmtNota(a.nota)}</b> / 10
            {conc && <span className={`badge tone-${conc.tone}`}>{a.conceito} · {conc.label}</span>}
            <DeltaNota atual={a.nota} anterior={anterior} />
          </div>
          <p>{a.nfs} NFs no mês · {formatMoney(a.faturamento)} em mercadoria transportada{a.amostraPequena ? ' · amostra pequena (nota com cautela)' : ''}</p>
          <p className="av-rel__escala">Escala: A ≥ 8,5 (excelente) · B ≥ 7 (bom) · C ≥ 5 (regular) · D &lt; 5 (crítico)</p>
        </div>
        <div className="av-rel__hist"><span>Últimos 6 meses</span><BarrasHistorico meses={meses} valores={historico} /></div>
      </section>

      <table className="av-rel__crit">
        <thead><tr><th>Critério</th><th>Resultado</th><th>Detalhe</th><th className="r">Nota</th></tr></thead>
        <tbody>
          {CRITERIOS.map((c) => {
            const r = a.criterios[c.id];
            return (
              <tr key={c.id} className={r.nota === null ? 'is-off' : ''}>
                <td><b>{c.label}</b></td>
                <td>{r.valor}</td>
                <td>{r.detalhe}</td>
                <td className="r"><ChipNota nota={r.nota} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="av-rel__cols">
        {a.pontos.length > 0 && (
          <section><h2>Pontos de atenção</h2><ul>{a.pontos.map((p) => <li key={p}>{p}</li>)}</ul></section>
        )}
        {a.destaques.length > 0 && (
          <section><h2>Destaques</h2><ul>{a.destaques.map((p) => <li key={p}>{p}</li>)}</ul></section>
        )}
      </div>

      {a.atrasos.length > 0 && (
        <section className="av-rel__lista">
          <h2>Entregas com atraso ({a.atrasos.length})</h2>
          <table>
            <thead><tr><th>NF</th><th>Cliente</th><th>Destino</th><th>Previsão</th><th>Entrega</th><th className="r">Atraso (d.u.)</th></tr></thead>
            <tbody>
              {a.atrasos.slice(0, 20).map(({ e, dias, aberta }) => (
                <tr key={e.id}><td>{e.nota_fiscal}</td><td>{e.clientes?.nome ?? '—'}</td><td>{ufDestino(e)}</td><td>{formatDate(e.data_previsao)}</td><td>{aberta ? 'em aberto' : formatDate(e.data_entrega_agendamento)}</td><td className="r">{dias}</td></tr>
              ))}
            </tbody>
          </table>
          {a.atrasos.length > 20 && <p className="muted">… e mais {a.atrasos.length - 20}</p>}
        </section>
      )}

      {a.ocorrencias.length > 0 && (
        <section className="av-rel__lista">
          <h2>Ocorrências ({a.ocorrencias.length})</h2>
          <table>
            <thead><tr><th>NF</th><th>Cliente</th><th>Ocorrência</th><th>Data</th></tr></thead>
            <tbody>{a.ocorrencias.slice(0, 20).map((o) => <tr key={o.e.id}><td>{o.e.nota_fiscal}</td><td>{o.e.clientes?.nome ?? '—'}</td><td>{ocorrenciaDe(o.codigo)?.label ?? o.descricao}</td><td>{formatDate(o.data)}</td></tr>)}</tbody>
          </table>
        </section>
      )}

      {a.acimaTabela.length > 0 && (
        <section className="av-rel__lista">
          <h2>CTEs acima da tabela ({a.acimaTabela.length} · {formatMoney(a.valorAcimaTabela)})</h2>
          <table>
            <thead><tr><th>CTE</th><th>Emissão</th><th>NFs</th><th className="r">Cobrado</th><th className="r">Tabela</th><th className="r">Diferença</th></tr></thead>
            <tbody>{a.acimaTabela.slice(0, 20).map((l) => <tr key={l.cte.id}><td>{l.cte.numero_documento}</td><td>{formatDate(l.cte.data_emissao)}</td><td>{l.nfs.map((e) => e.nota_fiscal).join(', ')}</td><td className="r">{formatMoney(l.cobrado)}</td><td className="r">{formatMoney(l.esperado?.total ?? 0)}</td><td className="r">{formatMoney(l.diferenca ?? 0)}</td></tr>)}</tbody>
          </table>
        </section>
      )}

      <footer className="av-rel__rodape">
        Como a nota é calculada: {CRITERIOS.map((c) => c.curto).join(', ')} — prazos em dias úteis (sem fins de semana e feriados nacionais), comparados à previsão da NF,
        ao prazo contratado ou ao tempo que as transportadoras levam para a UF. Gerado pelo MunilaLog.
      </footer>
    </div>
  );
}
