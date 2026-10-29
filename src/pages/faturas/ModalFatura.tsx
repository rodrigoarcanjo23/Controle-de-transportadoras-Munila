import { useMemo, useState, type FormEvent } from 'react';
import { CircleCheck, FileUp, TriangleAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { mensagemErro, registrarLog } from '../../lib/db';
import { formatDate, formatMoney, hojeISO, parseDecimalBR, toInputDecimal } from '../../lib/format';
import { extrairNFs } from '../../lib/integracaoCte';
import {
  SITUACAO_CONF, conferirFatura, ctesSemFatura, lerNumerosCte, normCte, type ContextoConferencia, type EventoFatura, type Fatura,
} from '../../lib/faturas';
import { useAppData } from '../../state/context';
import { useFeedback } from '../../feedback/context';
import { Modal } from '../../components/ui/Modal';
import { Field } from '../../components/ui/basics';

export type RascunhoFatura = Partial<Fatura> & { transportadora_id?: string };

/** Envia o PDF/imagem da fatura para o Storage e devolve o caminho. */
async function enviarArquivoFatura(transportadoraId: string, faturaId: string, arq: File): Promise<string> {
  const ext = (arq.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf';
  const caminho = `${transportadoraId}/${faturaId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('faturas').upload(caminho, arq, { contentType: arq.type || 'application/pdf' });
  if (error) throw error;
  return caminho;
}

/** Registrar ou editar uma fatura de frete, com a conferência ao vivo. */
export function ModalFatura({ inicial, ctx, onClose, onSalvo }: {
  inicial: RascunhoFatura; ctx: ContextoConferencia; onClose: () => void; onSalvo: (f: Fatura) => void;
}) {
  const { transportadoras, email } = useAppData();
  const { toast } = useFeedback();
  const editando = !!inicial.id;
  const [transp, setTransp] = useState(inicial.transportadora_id ?? '');
  const [numero, setNumero] = useState(inicial.numero ?? '');
  const [emissao, setEmissao] = useState(inicial.emissao ?? hojeISO());
  const [vencimento, setVencimento] = useState(inicial.vencimento ?? '');
  const [valor, setValor] = useState(inicial.valor !== undefined && inicial.valor !== null ? toInputDecimal(inicial.valor) : '');
  const [texto, setTexto] = useState((inicial.ctes ?? []).join(' '));
  const [obs, setObs] = useState(inicial.observacao ?? '');
  const [arq, setArq] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);

  const numeros = useMemo(() => lerNumerosCte(texto), [texto]);
  const valorNum = parseDecimalBR(valor) ?? 0;
  const conf = useMemo(() => (transp && numeros.length
    ? conferirFatura({ id: inicial.id ?? '__nova__', valor: valorNum, ctes: numeros, transportadora_id: transp }, ctx) : null),
  [transp, numeros, valorNum, ctx, inicial.id]);

  // CTEs desta transportadora que ainda não foram cobrados em nenhuma fatura
  const disponiveis = useMemo(() => {
    if (!transp) return [];
    const outras = ctx.faturas.filter((f) => f.id !== inicial.id);
    return ctesSemFatura(ctx.ctes, outras, ctx.transportadoras, transp)
      .sort((a, b) => String(b.data_emissao ?? '').localeCompare(String(a.data_emissao ?? '')))
      .slice(0, 200);
  }, [transp, ctx, inicial.id]);
  const marcados = new Set(numeros);
  const alternar = (n: string) => {
    if (marcados.has(n)) setTexto(numeros.filter((x) => x !== n).join(' '));
    else setTexto([...numeros, n].join(' '));
  };
  const todosMarcados = disponiveis.length > 0 && disponiveis.every((c) => marcados.has(normCte(c.numero_documento)));
  const marcarTodos = () => {
    if (todosMarcados) { const fora = new Set(disponiveis.map((c) => normCte(c.numero_documento))); setTexto(numeros.filter((n) => !fora.has(n)).join(' ')); }
    else setTexto([...new Set([...numeros, ...disponiveis.map((c) => normCte(c.numero_documento))])].join(' '));
  };

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!transp || !numero.trim() || !vencimento || valor === '') { toast({ kind: 'warning', title: 'Preencha transportadora, número, vencimento e valor.' }); return; }
    if (!numeros.length) { toast({ kind: 'warning', title: 'Informe os CTEs cobrados na fatura.' }); return; }
    setSalvando(true);
    try {
      const nomeT = transportadoras.find((t) => String(t.id) === transp)?.nome ?? '';
      const ev: EventoFatura = editando
        ? { em: new Date().toISOString(), por: email, acao: 'Editada', detalhe: `${numeros.length} CTEs · ${formatMoney(valorNum)}` }
        : { em: new Date().toISOString(), por: email, acao: 'Recebida', detalhe: `Registrada com ${numeros.length} CTE(s) · ${formatMoney(valorNum)}` };
      const payload = {
        numero: numero.trim(), transportadora_id: transp, emissao: emissao || null, vencimento, valor: valorNum, ctes: numeros,
        observacao: obs.trim() || null, eventos: [...(inicial.eventos ?? []), ev],
        ...(editando ? {} : { criado_por: email, status: 'recebida' as const }),
      };
      const q = editando
        ? supabase.from('faturas_frete').update(payload).eq('id', inicial.id!).select('*').single()
        : supabase.from('faturas_frete').insert(payload).select('*').single();
      const { data, error } = await q;
      if (error) throw error;
      let f = data as Fatura;
      if (arq) {
        try {
          const caminho = await enviarArquivoFatura(transp, f.id, arq);
          const { data: d2, error: e2 } = await supabase.from('faturas_frete').update({ arquivo_path: caminho }).eq('id', f.id).select('*').single();
          if (e2) throw e2;
          f = d2 as Fatura;
        } catch (err) { toast({ kind: 'warning', title: 'Fatura salva, mas o arquivo não foi enviado', text: mensagemErro(err) }); }
      }
      registrarLog(editando ? 'EDITOU' : 'CRIOU', 'FATURAS', `${editando ? 'Editou' : 'Registrou'} a fatura ${f.numero} da ${nomeT}: ${formatMoney(valorNum)}, vencimento ${formatDate(vencimento)}, ${numeros.length} CTE(s)`);
      toast({ kind: 'success', title: editando ? 'Fatura atualizada' : 'Fatura registrada', text: conf ? SITUACAO_CONF[conf.situacao].label : undefined });
      onSalvo(f);
    } catch (err) {
      toast({ kind: 'error', title: 'Não foi possível salvar', text: mensagemErro(err) });
    } finally { setSalvando(false); }
  }

  const sit = conf ? SITUACAO_CONF[conf.situacao] : null;
  return (
    <Modal size="lg" title={editando ? `Editar fatura ${inicial.numero}` : 'Registrar fatura de frete'} subtitle="Boleto/fatura da transportadora com os CTEs cobrados"
      onClose={onClose} onSubmit={salvar}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={salvando}>{salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Registrar fatura'}</button></>}>
      <div className="fat-form">
        <div className="fat-form__dados">
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <Field label="Transportadora" required>
              <select className="select" value={transp} onChange={(e) => setTransp(e.target.value)} disabled={editando}>
                <option value="">Escolha…</option>
                {transportadoras.map((t) => <option key={t.id} value={String(t.id)}>{t.nome}</option>)}
              </select>
            </Field>
            <Field label="Nº da fatura / boleto" required><input className="input" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex.: 104522" /></Field>
            <Field label="Emissão"><input type="date" className="input" value={emissao ?? ''} onChange={(e) => setEmissao(e.target.value)} /></Field>
            <Field label="Vencimento" required><input type="date" className="input" value={vencimento} onChange={(e) => setVencimento(e.target.value)} /></Field>
            <Field label="Valor cobrado (R$)" required
              hint={conf && conf.somaCtes > 0 && Math.abs(conf.somaCtes - valorNum) > 0.005
                ? <button type="button" className="link-btn" onClick={() => setValor(conf.somaCtes.toFixed(2).replace('.', ','))}>Usar a soma dos CTEs ({formatMoney(conf.somaCtes)})</button> : undefined}>
              <input className="input" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
            </Field>
          </div>
          <Field label="CTEs cobrados" required hint="Cole os números do boleto/e-mail (separados por espaço, vírgula ou linha) ou marque na lista ao lado. Chaves de 44 dígitos também valem.">
            <textarea className="input" rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: 12345 12346 12350" style={{ height: 'auto', paddingTop: 8 }} />
          </Field>
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <Field label="Observação"><input className="input" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" /></Field>
            <Field label="PDF da fatura" hint={inicial.arquivo_path && !arq ? 'Já existe um arquivo; escolha outro para substituir.' : 'Opcional (PDF ou foto)'}>
              <label className="fat-arq">
                <FileUp size={16} /> <span>{arq ? arq.name : 'Escolher arquivo'}</span>
                <input type="file" accept="application/pdf,image/*" onChange={(e) => setArq(e.target.files?.[0] ?? null)} hidden />
              </label>
            </Field>
          </div>

          {conf && sit && (
            <div className={`fat-previa fat-previa--${sit.tone}`}>
              <div className="fat-previa__top">
                {conf.situacao === 'ok' ? <CircleCheck size={18} /> : <TriangleAlert size={18} />}
                <strong>Conferência: {sit.label}</strong>
                <span className="muted">{conf.itens.length} CTE(s) · {conf.itens.length - conf.naoEncontrados} localizados · soma {formatMoney(conf.somaCtes)}</span>
              </div>
              {conf.diferencaSoma !== null && Math.abs(conf.diferencaSoma) > 0.05 && (
                <div>Fatura {conf.diferencaSoma > 0 ? 'maior' : 'menor'} que a soma dos CTEs em <b>{formatMoney(Math.abs(conf.diferencaSoma))}</b></div>
              )}
              {conf.aContestar > 0 && <div>A contestar (sugestão): <b className="text-red">{formatMoney(conf.aContestar)}</b></div>}
              {conf.motivos.length > 0 && <ul>{conf.motivos.map((m) => <li key={m}>{m}</li>)}</ul>}
            </div>
          )}
        </div>

        <div className="fat-form__lista">
          <div className="fat-form__lista-top">
            <strong>CTEs sem fatura{transp ? '' : ''}</strong>
            {disponiveis.length > 0 && <button type="button" className="link-btn" onClick={marcarTodos}>{todosMarcados ? 'Desmarcar todos' : `Marcar todos (${disponiveis.length})`}</button>}
          </div>
          {!transp ? <p className="muted">Escolha a transportadora para ver os CTEs dela que ainda não foram cobrados.</p>
            : !disponiveis.length ? <p className="muted">Nenhum CTE desta transportadora sem fatura. Registre os XMLs em Registro de CTE.</p>
            : (
              <ul className="fat-ctes">
                {disponiveis.map((c) => {
                  const n = normCte(c.numero_documento);
                  const nfs = extrairNFs(c.chave_acesso);
                  return (
                    <li key={c.id}>
                      <label className={marcados.has(n) ? 'is-on' : ''}>
                        <input type="checkbox" checked={marcados.has(n)} onChange={() => alternar(n)} />
                        <span className="fat-ctes__n">CTE {c.numero_documento}</span>
                        <span className="fat-ctes__v">{formatMoney(c.valor_total_servico)}</span>
                        <small>{formatDate(c.data_emissao)}{nfs.length ? ` · NF ${nfs.slice(0, 3).join(', ')}${nfs.length > 3 ? '…' : ''}` : ''}</small>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
        </div>
      </div>
    </Modal>
  );
}
