import { useState } from 'react';
import {
  Ban, CircleCheck, ClipboardCopy, FileText, Mail, MessageCircle, Pencil, RotateCcw, Send, Trash2, TriangleAlert, Wallet,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { mensagemErro, registrarLog } from '../../lib/db';
import { formatDate, formatDateTimeBR, formatMoney, hojeISO, parseDecimalBR, toNumber } from '../../lib/format';
import {
  PROBLEMA, SITUACAO_CONF, STATUS_FATURA, diasParaVencer, mensagemContestacao, valorAPagar,
  type Conferencia, type EventoFatura, type Fatura, type StatusFatura,
} from '../../lib/faturas';
import { useAppData } from '../../state/context';
import { useFeedback } from '../../feedback/context';
import { Modal } from '../../components/ui/Modal';
import { Field } from '../../components/ui/basics';
import type { Transportadora } from '../../types';

export function PrazoFatura({ f, hoje = hojeISO() }: { f: Pick<Fatura, 'vencimento' | 'status'>; hoje?: string }) {
  if (f.status === 'paga' || f.status === 'cancelada') return <span className="muted">{formatDate(f.vencimento)}</span>;
  const d = diasParaVencer(f.vencimento, hoje);
  const [tom, txt] = d < 0 ? ['red', `vencida há ${-d} dia${d < -1 ? 's' : ''}`] : d === 0 ? ['red', 'vence hoje'] : d <= 7 ? ['amber', `vence em ${d} dia${d > 1 ? 's' : ''}`] : ['slate', `em ${d} dias`];
  return <span className="fat-prazo">{formatDate(f.vencimento)} <span className={`badge tone-${tom}`}>{txt}</span></span>;
}

const ETAPAS: [StatusFatura[], string][] = [[['recebida'], 'Recebida'], [['conferida', 'contestada'], 'Conferida / contestada'], [['aprovada'], 'Aprovada'], [['paga'], 'Paga']];

/** Detalhe da fatura: conferência CTE a CTE, contestação, aprovação, pagamento e lançamento no Infarma. */
export function ModalDetalheFatura({ f, conf, transp, onClose, onAtualizada, onExcluida, onEditar, onCtesLancados }: {
  f: Fatura; conf: Conferencia; transp?: Transportadora; onClose: () => void;
  onAtualizada: (f: Fatura) => void; onExcluida: (id: string) => void; onEditar: () => void; onCtesLancados: (ids: string[]) => void;
}) {
  const { isAdmin, email } = useAppData();
  const { toast, confirm } = useFeedback();
  const nomeT = transp?.nome ?? 'Transportadora';
  const valor = toNumber(f.valor);
  const [contestado, setContestado] = useState(() => String((toNumber(f.valor_contestado) || conf.aContestar).toFixed(2)).replace('.', ','));
  const [motivo, setMotivo] = useState(f.motivo_contestacao ?? '');
  const contestadoNum = Math.min(valor, Math.max(0, parseDecimalBR(contestado) ?? 0));
  const [aprovado, setAprovado] = useState(() => (Math.max(0, valor - (f.status === 'contestada' ? toNumber(f.valor_contestado) : 0))).toFixed(2).replace('.', ','));
  const [pagoEm, setPagoEm] = useState(hojeISO());
  const [ocupado, setOcupado] = useState(false);
  const sit = SITUACAO_CONF[conf.situacao];
  const st = STATUS_FATURA[f.status];
  const msg = mensagemContestacao(f, conf, nomeT, contestadoNum, motivo);
  const fone = (transp?.telefone ?? '').replace(/\D/g, '');
  const aLancar = [...new Map(conf.itens.filter((i) => i.cte && !i.lancado).map((i) => [i.cte!.id, i.cte!])).values()];
  const etapaAtual = ETAPAS.findIndex(([s]) => s.includes(f.status));

  async function mudar(patch: Partial<Fatura>, acao: string, detalhe?: string) {
    setOcupado(true);
    try {
      const ev: EventoFatura = { em: new Date().toISOString(), por: email, acao, detalhe };
      const { data, error } = await supabase.from('faturas_frete').update({ ...patch, eventos: [...(f.eventos ?? []), ev] }).eq('id', f.id).select('*').single();
      if (error) throw error;
      registrarLog('EDITOU', 'FATURAS', `Fatura ${f.numero} (${nomeT}): ${acao}${detalhe ? ` — ${detalhe}` : ''}`);
      onAtualizada(data as Fatura);
      toast({ kind: 'success', title: acao });
    } catch (err) { toast({ kind: 'error', title: 'Não foi possível atualizar', text: mensagemErro(err) }); }
    finally { setOcupado(false); }
  }

  async function conferir() {
    if (conf.situacao === 'divergente' && !(await confirm({ title: 'Marcar como conferida?', text: `A conferência aponta ${formatMoney(conf.aContestar)} a contestar. Use "Registrar contestação" se for cobrar a transportadora.`, confirmLabel: 'Marcar mesmo assim' }))) return;
    mudar({ status: 'conferida' }, 'Conferida', conf.motivos.length ? `com observações: ${conf.motivos.join('; ')}` : 'sem divergências');
  }
  async function contestar() {
    if (contestadoNum <= 0) { toast({ kind: 'warning', title: 'Informe o valor contestado.' }); return; }
    await mudar({ status: 'contestada', valor_contestado: contestadoNum, motivo_contestacao: motivo.trim() || null }, 'Contestação registrada', `${formatMoney(contestadoNum)} contestados`);
  }
  async function aprovar() {
    const v = parseDecimalBR(aprovado);
    if (v === null || v < 0) { toast({ kind: 'warning', title: 'Informe o valor aprovado.' }); return; }
    if (v > valor + 0.005) { toast({ kind: 'warning', title: 'O valor aprovado não pode ser maior que o da fatura.' }); return; }
    if (f.status === 'recebida' && conf.situacao === 'divergente' && !(await confirm({ title: 'Aprovar com divergências?', text: `A conferência aponta ${formatMoney(conf.aContestar)} a contestar.`, confirmLabel: 'Aprovar' }))) return;
    mudar({ status: 'aprovada', valor_aprovado: v }, 'Pagamento aprovado', `${formatMoney(v)}${v < valor ? ` (economia de ${formatMoney(valor - v)})` : ''}`);
  }
  const pagar = () => mudar({ status: 'paga', pago_em: pagoEm }, 'Pagamento registrado', `pago em ${formatDate(pagoEm)} · ${formatMoney(valorAPagar(f))}`);
  async function voltar(para: StatusFatura, acao: string) {
    if (!(await confirm({ title: `${acao}?`, text: 'A fatura volta para a etapa anterior. Fica registrado na linha do tempo.', confirmLabel: acao }))) return;
    mudar({ status: para, ...(para === 'recebida' || para === 'contestada' || para === 'conferida' ? { valor_aprovado: null, pago_em: null } : { pago_em: null }) }, acao);
  }
  async function cancelar() {
    if (!(await confirm({ title: 'Cancelar esta fatura?', text: 'Use quando a transportadora substituir a fatura por outra. Os CTEs voltam a ficar "sem fatura".', confirmLabel: 'Cancelar fatura', danger: true }))) return;
    mudar({ status: 'cancelada' }, 'Fatura cancelada');
  }
  async function excluir() {
    if (!(await confirm({ title: 'Excluir a fatura?', text: 'O registro e a linha do tempo serão apagados. Prefira "Cancelar" para manter o histórico.', confirmLabel: 'Excluir', danger: true }))) return;
    const { error } = await supabase.from('faturas_frete').delete().eq('id', f.id);
    if (error) { toast({ kind: 'error', title: 'Não foi possível excluir', text: mensagemErro(error) }); return; }
    if (f.arquivo_path) supabase.storage.from('faturas').remove([f.arquivo_path]).then(() => {});
    registrarLog('APAGOU', 'FATURAS', `Excluiu a fatura ${f.numero} da ${nomeT} (${formatMoney(valor)})`);
    onExcluida(f.id);
  }
  async function lancarInfarma() {
    if (!(await confirm({ title: `Marcar ${aLancar.length} CTE(s) como lançados no Infarma?`, text: 'A situação dos CTEs muda de ABERTO para FECHADO no Registro de CTE.', confirmLabel: 'Marcar como lançados' }))) return;
    setOcupado(true);
    const ids = aLancar.map((c) => c.id);
    const { error } = await supabase.from('ctes').update({ situacao: 'FECHADO' }).in('id', ids);
    setOcupado(false);
    if (error) { toast({ kind: 'error', title: 'Não foi possível atualizar os CTEs', text: mensagemErro(error) }); return; }
    registrarLog('EDITOU', 'CTES', `Marcou como lançados no Infarma (FECHADO) os CTEs da fatura ${f.numero} (${nomeT}): ${aLancar.map((c) => c.numero_documento).join(', ')}`);
    onCtesLancados(ids.map(String));
    await mudar({}, 'CTEs lançados no Infarma', `${aLancar.length} CTE(s)`);
  }
  async function verArquivo() {
    if (!f.arquivo_path) return;
    const { data, error } = await supabase.storage.from('faturas').createSignedUrl(f.arquivo_path, 300);
    if (error || !data) { toast({ kind: 'error', title: 'Não foi possível abrir o arquivo', text: error?.message }); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  }
  const copiar = async () => { try { await navigator.clipboard.writeText(msg); toast({ kind: 'success', title: 'Mensagem copiada' }); } catch { toast({ kind: 'error', title: 'Não foi possível copiar' }); } };

  const aberta = f.status !== 'paga' && f.status !== 'cancelada';
  return (
    <Modal size="lg" onClose={onClose} autoFocus={false}
      title={<span className="fat-tit">Fatura {f.numero} <span className={`badge tone-${st.tone}`} title={st.dica}>{st.label}</span></span>}
      subtitle={<>{nomeT} · emitida {formatDate(f.emissao)} · vencimento <PrazoFatura f={f} /></>}
      footer={<>
        {isAdmin && (f.status === 'recebida' || f.status === 'cancelada') && <button className="btn btn-ghost text-red" onClick={excluir}><Trash2 size={15} /> Excluir</button>}
        {isAdmin && aberta && <button className="btn btn-ghost" onClick={cancelar}><Ban size={15} /> Cancelar fatura</button>}
        {f.arquivo_path && <button className="btn" onClick={verArquivo}><FileText size={15} /> Ver PDF</button>}
        {isAdmin && ['recebida', 'conferida', 'contestada'].includes(f.status) && <button className="btn" onClick={onEditar}><Pencil size={15} /> Editar</button>}
        <button className="btn btn-primary" onClick={onClose}>Fechar</button>
      </>}>
      <div className="fat-det">
        {f.status !== 'cancelada' && (
          <ol className="fat-etapas">
            {ETAPAS.map(([s, l], i) => (
              <li key={l} className={i < etapaAtual ? 'is-ok' : i === etapaAtual ? 'is-on' : ''}>
                <span>{i < etapaAtual ? <CircleCheck size={14} /> : i + 1}</span>{i === 1 && f.status === 'contestada' ? 'Contestada' : i === 1 && f.status === 'conferida' ? 'Conferida' : l}
                {s.includes('paga') && f.pago_em && <small>{formatDate(f.pago_em)}</small>}
              </li>
            ))}
          </ol>
        )}

        <div className="bi-strip">
          <div className="bi-strip__item"><Wallet size={16} /><span>Valor da fatura</span><strong>{formatMoney(valor)}</strong><em>{conf.itens.length} CTE(s) cobrados</em></div>
          <div className="bi-strip__item"><FileText size={16} /><span>Soma dos CTEs</span><strong>{formatMoney(conf.somaCtes)}</strong><em>{conf.itens.length - conf.naoEncontrados} de {conf.itens.length} localizados no sistema</em></div>
          <div className="bi-strip__item"><TriangleAlert size={16} /><span>A contestar</span><strong className={conf.aContestar > 0 ? 'text-red' : 'text-green'}>{formatMoney(conf.aContestar)}</strong><em><span className={`badge tone-${sit.tone}`}>{sit.label}</span></em></div>
          <div className="bi-strip__item"><CircleCheck size={16} /><span>{f.status === 'paga' ? 'Pago' : 'A pagar'}</span><strong>{formatMoney(valorAPagar(f))}</strong>
            <em>{toNumber(f.valor_contestado) > 0 ? `${formatMoney(toNumber(f.valor_contestado))} contestados` : f.valor_aprovado !== null ? 'valor aprovado' : 'valor da fatura'}</em></div>
        </div>

        {conf.motivos.length > 0 && (
          <div className={`fat-motivos fat-motivos--${sit.tone}`}>
            <TriangleAlert size={16} />
            <ul>
              {conf.diferencaSoma === null && conf.naoEncontrados > 0 && <li>A soma não pode ser conferida enquanto houver CTE não registrado (registre o XML em Registro de CTE).</li>}
              {conf.motivos.map((m) => <li key={m}>{m}</li>)}
            </ul>
          </div>
        )}

        <div className="card bi-ranking">
          <div className="table-scroll" style={{ maxHeight: 340 }}>
            <table className="bi-tabela">
              <thead><tr><th>CTE</th><th>Emissão</th><th>NFs</th><th className="r">Cobrado</th><th className="r">Tabela</th><th className="r">A contestar</th><th>Conferência</th><th>Infarma</th></tr></thead>
              <tbody>
                {conf.itens.map((i, k) => (
                  <tr key={`${i.numero}-${k}`}>
                    <td className="strong">{i.cte?.numero_documento ?? i.numero}</td>
                    <td>{formatDate(i.cte?.data_emissao)}</td>
                    <td>{i.nfs.length ? i.nfs.map((e) => e.nota_fiscal).slice(0, 3).join(', ') + (i.nfs.length > 3 ? '…' : '') : <span className="muted">—</span>}</td>
                    <td className="r">{i.cte ? formatMoney(i.valor) : '—'}</td>
                    <td className="r">{i.aud?.esperado ? formatMoney(i.aud.esperado.total) : <span className="muted" title={i.aud ? 'Sem tabela ou sem peso' : undefined}>—</span>}</td>
                    <td className="r">{i.aContestar > 0 ? <b className="text-red">{formatMoney(i.aContestar)}</b> : <span className="muted">—</span>}</td>
                    <td>
                      {i.problemas.length
                        ? <span className="fat-probs">{i.problemas.map((p) => <span key={p} className={`badge tone-${PROBLEMA[p].tone}`} title={p === 'outra_fatura' && i.outraFatura ? `Já cobrado na fatura ${i.outraFatura}` : PROBLEMA[p].dica}>{PROBLEMA[p].label}</span>)}</span>
                        : <span className="badge tone-green">OK</span>}
                    </td>
                    <td>{i.cte ? <span className={`badge tone-${i.lancado ? 'green' : 'orange'}`}>{i.lancado ? 'Lançado' : 'A lançar'}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {isAdmin && f.status !== 'cancelada' && (
          <div className="fat-acoes">
            {['recebida', 'conferida', 'contestada'].includes(f.status) && (
              <section className="fat-acao">
                <h4><Send size={16} /> Contestar com a transportadora</h4>
                <div className="form-grid" style={{ gridTemplateColumns: 'minmax(140px, 200px) 1fr' }}>
                  <Field label="Valor contestado (R$)" hint={conf.aContestar > 0 ? `Sugestão da conferência: ${formatMoney(conf.aContestar)}` : undefined}>
                    <input className="input" inputMode="decimal" value={contestado} onChange={(e) => setContestado(e.target.value)} />
                  </Field>
                  <Field label="Observação para a transportadora (opcional)"><input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: aguardamos a fatura corrigida até sexta." /></Field>
                </div>
                <details className="fat-msg"><summary>Ver a mensagem</summary><pre>{msg}</pre></details>
                <div className="fat-acao__btns">
                  <button className="btn" onClick={copiar}><ClipboardCopy size={15} /> Copiar</button>
                  <a className="btn" href={`https://wa.me/${fone.length >= 10 ? (fone.startsWith('55') ? fone : '55' + fone) : ''}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp</a>
                  <a className="btn" href={`mailto:${transp?.email ?? ''}?subject=${encodeURIComponent(`Contestação da fatura ${f.numero} — Munila`)}&body=${encodeURIComponent(msg)}`}><Mail size={15} /> E-mail</a>
                  <button className="btn btn-warning" onClick={contestar} disabled={ocupado}>{f.status === 'contestada' ? 'Atualizar contestação' : 'Registrar contestação'}</button>
                </div>
              </section>
            )}

            {['recebida', 'conferida', 'contestada'].includes(f.status) && (
              <section className="fat-acao">
                <h4><CircleCheck size={16} /> {f.status === 'contestada' ? 'Transportadora respondeu' : 'Liberar o pagamento'}</h4>
                <div className="fat-acao__linha">
                  <Field label="Valor aprovado para pagar (R$)" hint={f.status === 'contestada' ? 'Fatura corrigida ou desconto aceito: informe o valor final.' : undefined}>
                    <input className="input" inputMode="decimal" value={aprovado} onChange={(e) => setAprovado(e.target.value)} />
                  </Field>
                  <div className="fat-acao__btns">
                    {f.status === 'recebida' && <button className="btn" onClick={conferir} disabled={ocupado}>Marcar como conferida</button>}
                    <button className="btn btn-primary" onClick={aprovar} disabled={ocupado}>Aprovar pagamento</button>
                  </div>
                </div>
              </section>
            )}

            {f.status === 'aprovada' && (
              <section className="fat-acao">
                <h4><Wallet size={16} /> Registrar pagamento</h4>
                <div className="fat-acao__linha">
                  <Field label="Pago em"><input type="date" className="input" value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} /></Field>
                  <div className="fat-acao__btns">
                    <button className="btn btn-ghost" onClick={() => voltar('recebida', 'Voltar para conferência')} disabled={ocupado}><RotateCcw size={14} /> Voltar para conferência</button>
                    <button className="btn btn-primary" onClick={pagar} disabled={ocupado}>Registrar pagamento de {formatMoney(valorAPagar(f))}</button>
                  </div>
                </div>
              </section>
            )}

            {f.status === 'paga' && (
              <section className="fat-acao fat-acao--ok">
                <h4><CircleCheck size={16} /> Paga em {formatDate(f.pago_em)} · {formatMoney(valorAPagar(f))}</h4>
                <button className="btn btn-ghost btn-sm" onClick={() => voltar('aprovada', 'Desfazer pagamento')} disabled={ocupado}><RotateCcw size={14} /> Desfazer pagamento</button>
              </section>
            )}

            {aLancar.length > 0 && (
              <section className="fat-acao fat-acao--infarma">
                <h4><FileText size={16} /> {aLancar.length} CTE(s) desta fatura ainda não lançados no Infarma</h4>
                <button className="btn" onClick={lancarInfarma} disabled={ocupado}>Marcar como lançados (FECHADO)</button>
              </section>
            )}
          </div>
        )}

        {f.observacao && <p className="muted"><b>Observação:</b> {f.observacao}</p>}
        {(f.eventos?.length ?? 0) > 0 && (
          <div>
            <h4 className="hist__tit">Linha do tempo</h4>
            <ul className="fat-eventos">
              {[...(f.eventos ?? [])].reverse().map((ev, i) => (
                <li key={i}><b>{ev.acao}</b>{ev.detalhe && <span> — {ev.detalhe}</span>}<small>{formatDateTimeBR(ev.em)} · {ev.por}</small></li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
