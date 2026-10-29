import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ClipboardCopy, Receipt, TriangleAlert } from 'lucide-react';
import { SITUACAO_AUDITORIA, type LinhaAuditoria, type SituacaoAuditoria } from '../../lib/tabelaFrete';
import { formatDate, formatMoney } from '../../lib/format';
import { EmptyState } from '../../components/ui/basics';
import { num } from '../bi/fmt';

const ORDEM: SituacaoAuditoria[] = ['acima', 'conforme', 'abaixo', 'sem_tabela', 'sem_peso', 'sem_nf'];

/** Auditoria de cada CTE pela tabela de frete da transportadora. */
export function AuditoriaTabela({ linhas, semTabelas, tolerancia, onCopiado, irTransportadoras }: {
  linhas: LinhaAuditoria[]; semTabelas: boolean; tolerancia: number; onCopiado: () => void; irTransportadoras: () => void;
}) {
  const [sit, setSit] = useState<SituacaoAuditoria | 'todas' | 'duplicadas'>('acima');
  const [aberto, setAberto] = useState<string | null>(null);
  const cont = useMemo(() => {
    const c = Object.fromEntries(ORDEM.map((s) => [s, 0])) as Record<SituacaoAuditoria, number>;
    linhas.forEach((l) => { c[l.situacao]++; });
    return c;
  }, [linhas]);
  const duplicadas = linhas.filter((l) => l.duplicada);
  const visiveis = sit === 'todas' ? linhas : sit === 'duplicadas' ? duplicadas : linhas.filter((l) => l.situacao === sit);
  const acima = linhas.filter((l) => l.situacao === 'acima');
  const aContestar = acima.reduce((s, l) => s + (l.diferenca ?? 0), 0);
  const auditados = linhas.filter((l) => l.esperado);
  const cobradoAud = auditados.reduce((s, l) => s + l.cobrado, 0);
  const esperadoAud = auditados.reduce((s, l) => s + (l.esperado?.total ?? 0), 0);

  function copiar() {
    const grupos = new Map<string, LinhaAuditoria[]>();
    acima.forEach((l) => grupos.set(l.transportadora, [...(grupos.get(l.transportadora) ?? []), l]));
    const txt = [...grupos].map(([t, ls]) => `*${t}* — ${ls.length} CTE(s) acima da tabela (diferença total ${formatMoney(ls.reduce((s, l) => s + (l.diferenca ?? 0), 0))}):\n` +
      ls.map((l) => `• CTE ${l.cte.numero_documento} (NF ${l.nfs.map((e) => e.nota_fiscal).join(', ')}) — cobrado ${formatMoney(l.cobrado)}, tabela ${formatMoney(l.esperado?.total ?? 0)}, diferença ${formatMoney(l.diferenca ?? 0)}`).join('\n')).join('\n\n');
    navigator.clipboard.writeText(`Olá! Na conferência dos CTEs pela tabela de frete acordada, encontramos as diferenças abaixo. Podem verificar e emitir a correção/desconto?\n\n${txt}\n\nObrigado!`).then(onCopiado).catch(() => {});
  }

  if (semTabelas) {
    return (
      <div className="card card-pad bi-vazio">
        <Receipt size={28} />
        <div>
          <strong>Nenhuma tabela de frete cadastrada ainda.</strong>
          <p className="muted">Cadastre a tabela de cada transportadora (frete peso por faixa, ad valorem, GRIS, pedágio, taxas, mínimo e ICMS). A partir daí, cada CTE é recalculado e comparado com o valor cobrado.</p>
        </div>
        <button className="btn btn-primary" onClick={irTransportadoras}>Cadastrar tabelas</button>
      </div>
    );
  }

  return (
    <div className="fin-conf">
      <div className="bi-strip">
        <div className="bi-strip__item"><Receipt size={16} /><span>CTEs auditados</span><strong>{num(auditados.length)}</strong><em>de {num(linhas.length)} no período</em></div>
        <div className="bi-strip__item"><Receipt size={16} /><span>Cobrado × tabela</span><strong className={cobradoAud > esperadoAud ? 'text-red' : 'text-green'}>{cobradoAud > esperadoAud ? '+' : '−'}{formatMoney(Math.abs(cobradoAud - esperadoAud))}</strong><em>{formatMoney(cobradoAud)} cobrado · {formatMoney(esperadoAud)} pela tabela</em></div>
        <div className="bi-strip__item"><TriangleAlert size={16} /><span>A contestar</span><strong className={aContestar > 0 ? 'text-red' : ''}>{formatMoney(aContestar)}</strong><em>{acima.length} CTE(s) acima da tabela (tolerância {tolerancia}%)</em></div>
        <div className="bi-strip__item"><TriangleAlert size={16} /><span>NF em 2+ CTEs</span><strong className={duplicadas.length ? 'text-orange' : ''}>{num(duplicadas.length)}</strong><em>possível cobrança em dobro</em></div>
      </div>

      <div className="fin-abas">
        {ORDEM.map((s) => (
          <button key={s} className={`fin-aba fin-aba--${SITUACAO_AUDITORIA[s].tone} ${sit === s ? 'is-on' : ''}`} onClick={() => setSit(s)} title={SITUACAO_AUDITORIA[s].dica}>
            {SITUACAO_AUDITORIA[s].label}<b>{num(cont[s])}</b>
          </button>
        ))}
        <button className={`fin-aba fin-aba--orange ${sit === 'duplicadas' ? 'is-on' : ''}`} onClick={() => setSit('duplicadas')}>NF em 2+ CTEs<b>{num(duplicadas.length)}</b></button>
        <button className={`fin-aba ${sit === 'todas' ? 'is-on' : ''}`} onClick={() => setSit('todas')}>Todos<b>{num(linhas.length)}</b></button>
        {acima.length > 0 && <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={copiar}><ClipboardCopy size={14} /> Copiar contestação</button>}
      </div>

      {!visiveis.length ? <div className="card"><EmptyState title="Nenhum CTE nesta situação" /></div> : (
        <div className="card bi-ranking">
          <div className="table-scroll" style={{ maxHeight: 620 }}>
            <table className="bi-tabela aud">
              <thead>
                <tr><th /><th>CTE</th><th>Emissão</th><th>Transportadora</th><th>NFs</th><th>UF</th><th className="r">Peso</th><th className="r">Valor NFs</th><th className="r">Cobrado</th><th className="r">Tabela</th><th className="r">Diferença</th><th>Situação</th></tr>
              </thead>
              <tbody>
                {visiveis.map((l) => {
                  const ab = aberto === l.cte.id; const s = SITUACAO_AUDITORIA[l.situacao];
                  return (
                    <Fragment key={l.cte.id}>
                      <tr onClick={() => l.esperado && setAberto(ab ? null : l.cte.id)} style={{ cursor: l.esperado ? 'pointer' : undefined }}>
                        <td>{l.esperado ? (ab ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}</td>
                        <td className="strong">{l.cte.numero_documento}</td>
                        <td>{formatDate(l.cte.data_emissao)}</td>
                        <td>{l.transportadora}</td>
                        <td title={l.nfs.map((e) => e.nota_fiscal).join(', ')}>{l.nfs.length ? l.nfs.map((e) => e.nota_fiscal).slice(0, 2).join(', ') + (l.nfs.length > 2 ? ` +${l.nfs.length - 2}` : '') : '—'}{l.duplicada && <span className="badge tone-orange" style={{ marginLeft: 6 }} title={`Também em outro CTE: ${l.nfsDuplicadas.join(', ')}`}>2+ CTEs</span>}</td>
                        <td>{l.uf || '—'}</td>
                        <td className="r">{l.peso ? `${num(l.peso, 1)} kg` : '—'}</td>
                        <td className="r">{formatMoney(l.valorNf)}</td>
                        <td className="r strong">{formatMoney(l.cobrado)}</td>
                        <td className="r">{l.esperado ? formatMoney(l.esperado.total) : '—'}</td>
                        <td className="r">{l.diferenca === null ? '—' : <span className={l.situacao === 'acima' ? 'text-red strong' : l.situacao === 'abaixo' ? 'text-blue' : 'muted'}>{l.diferenca > 0 ? '+' : l.diferenca < 0 ? '−' : ''}{formatMoney(Math.abs(l.diferenca))}{l.diferencaPct !== null && <small> ({num(l.diferencaPct, 1)}%)</small>}</span>}</td>
                        <td><span className={`badge tone-${s.tone}`} title={s.dica}>{s.label}</span></td>
                      </tr>
                      {ab && l.esperado && (
                        <tr className="aud__det">
                          <td />
                          <td colSpan={11}>
                            <div className="aud__comp">
                              {l.esperado.itens.map((i) => <div key={i.nome}><span>{i.nome}<small>{i.detalhe}</small></span><b>{formatMoney(i.valor)}</b></div>)}
                              <div className="aud__comp-total"><span>Tabela</span><b>{formatMoney(l.esperado.total)}</b></div>
                              <div className="aud__comp-total"><span>Cobrado no CTE</span><b>{formatMoney(l.cobrado)}</b></div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="muted bi-legenda">O frete esperado é calculado com o peso e o valor somados das NFs do CTE e a tabela da transportadora para a UF de destino (ou a tabela geral). Clique numa linha para ver cada componente. A transportadora é a das NFs no Painel.</p>
    </div>
  );
}
