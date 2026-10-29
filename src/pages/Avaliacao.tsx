import { useEffect, useMemo, useState } from 'react';
import { Award, ClipboardCopy, Download, Mail, MessageCircle, Printer, Settings2, Star, TriangleAlert, Trophy } from 'lucide-react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { fetchAll, mensagemErro, registrarLog } from '../lib/db';
import { downloadCsv, csvNum } from '../lib/csv';
import { fmtMes } from '../lib/bi';
import { formatDate, hojeISO } from '../lib/format';
import { ufDestino } from '../lib/filtrosEntrega';
import { lerConfigFin } from '../lib/financeiro';
import { aprenderPrazos, lerConfigSLA, CONFIG_SLA_PADRAO, type ConfigSLA } from '../lib/sla';
import {
  CONCEITO, CONFIG_AVALIACAO_PADRAO, CRITERIOS, avaliarMes, historicoNotas, lerConfigAvaliacao, mensagemAvaliacao, mesAnterior,
  type ConfigAvaliacao, type EntradaAvaliacao,
} from '../lib/avaliacao';
import type { Ocorrencia } from '../lib/ocorrencias';
import type { Fatura } from '../lib/faturas';
import type { TabelaFrete } from '../lib/tabelaFrete';
import { useAppData } from '../state/context';
import { useFeedback } from '../feedback/context';
import { EmptyState, PageHeader } from '../components/ui/basics';
import { Modal } from '../components/ui/Modal';
import { KpiBI } from './bi/KpiBI';
import { num } from './bi/fmt';
import { ChipNota, DeltaNota, Sparkline } from './avaliacao/Componentes';
import { fmtNota } from './avaliacao/fmt';
import { RelatorioAvaliacao } from './avaliacao/Relatorio';
import type { Cte } from '../types';
import './bi/bi.css';
import './financeiro/financeiro.css';
import './avaliacao/avaliacao.css';

function ModalPesos({ cfg, onClose, onSalvar }: { cfg: ConfigAvaliacao; onClose: () => void; onSalvar: (c: ConfigAvaliacao) => Promise<void> }) {
  const [f, setF] = useState(cfg);
  const [salvando, setSalvando] = useState(false);
  const total = CRITERIOS.reduce((s, c) => s + f.pesos[c.id], 0);
  const numero = (v: number, set: (n: number) => void, max = 100) => (
    <input type="number" min={0} max={max} className="input" value={v} onChange={(e) => set(Math.max(0, Math.min(max, Number(e.target.value) || 0)))} />
  );
  return (
    <Modal title="Critérios da avaliação" subtitle="Valem para todos os usuários e para todos os meses" onClose={onClose}
      onSubmit={async (e) => { e.preventDefault(); setSalvando(true); try { await onSalvar(f); onClose(); } finally { setSalvando(false); } }}
      footer={<><button type="button" className="btn" onClick={() => setF(CONFIG_AVALIACAO_PADRAO)}>Restaurar padrão</button><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={salvando || total <= 0}>{salvando ? 'Salvando…' : 'Salvar'}</button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h4 className="hist__tit">Peso de cada critério</h4>
          <div className="av-pesos">
            {CRITERIOS.map((c) => (
              <div key={c.id} className="field">
                <label title={c.dica}>{c.label}</label>
                {numero(f.pesos[c.id], (n) => setF({ ...f, pesos: { ...f.pesos, [c.id]: n } }))}
                <small className="muted">{total ? `${Math.round((f.pesos[c.id] / total) * 100)}% da nota` : ''}</small>
              </div>
            ))}
          </div>
          <small className="muted">Peso 0 tira o critério da nota. Critérios sem dados no mês (ex.: sem tabela de frete) também ficam de fora, e os demais são reponderados.</small>
        </div>
        <div className="form-grid form-grid--auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="field"><label>% no prazo que vale nota 10</label>{numero(f.meta_prazo_pct, (n) => setF({ ...f, meta_prazo_pct: n }))}</div>
          <div className="field"><label>% no prazo que vale nota 0</label>{numero(f.piso_prazo_pct, (n) => setF({ ...f, piso_prazo_pct: n }))}</div>
          <div className="field"><label>Taxa de ocorrências que zera a qualidade (%)</label>{numero(f.limite_ocorrencias_pct, (n) => setF({ ...f, limite_ocorrencias_pct: n }))}</div>
          <div className="field"><label>Mínimo de NFs no mês</label>{numero(f.min_nfs, (n) => setF({ ...f, min_nfs: n }), 1000)}<small className="muted">Abaixo disso a nota aparece como "amostra pequena".</small></div>
        </div>
      </div>
    </Modal>
  );
}

export default function Avaliacao() {
  const { entregas, devolucoes, transportadoras, isAdmin, loading } = useAppData();
  const { toast } = useFeedback();
  const hoje = hojeISO();
  const mesAtual = hoje.slice(0, 7);

  const [ctes, setCtes] = useState<Cte[]>([]);
  const [tabelas, setTabelas] = useState<TabelaFrete[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[] | null>(null);
  const [sla, setSla] = useState<ConfigSLA>(CONFIG_SLA_PADRAO);
  const [fin, setFin] = useState({ margem: 10, tol: 2 });
  const [cfg, setCfg] = useState<ConfigAvaliacao>(CONFIG_AVALIACAO_PADRAO);
  const [carregado, setCarregado] = useState(false);
  // padrão: mês anterior fechado (no começo do mês o atual ainda tem poucos dados)
  const [mes, setMes] = useState(() => (+hoje.slice(8, 10) <= 10 ? mesAnterior(mesAtual) : mesAtual));
  const [aberta, setAberta] = useState<string | null>(null);
  const [pesos, setPesos] = useState(false);
  const [imprimir, setImprimir] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data: cfgs } = await supabase.from('configuracoes').select('chave, valor').in('chave', ['sla', 'prazo_coleta_dias', 'financeiro', 'avaliacao']);
      const v = (k: string) => cfgs?.find((x) => x.chave === k)?.valor;
      const col = Number(v('prazo_coleta_dias'));
      const fc = lerConfigFin(v('financeiro'));
      if (vivo) { setSla(lerConfigSLA(v('sla'), Number.isFinite(col) ? col : undefined)); setFin({ margem: fc.margem_cotado_pct, tol: fc.tolerancia_tabela_pct }); setCfg(lerConfigAvaliacao(v('avaliacao'))); }
      const desde = `${mesAnterior(mesAtual, 13)}-01`;
      const [tf, fat, oc] = await Promise.all([
        supabase.from('tabelas_frete').select('*'),
        supabase.from('faturas_frete').select('*'),
        supabase.from('ocorrencias').select('*').gte('data_ocorrencia', desde),
      ]);
      if (!vivo) return;
      if (tf.data) setTabelas(tf.data as TabelaFrete[]);
      if (fat.data) setFaturas(fat.data as Fatura[]);
      setOcorrencias(oc.error ? null : (oc.data ?? []) as Ocorrencia[]);
      try { const l = await fetchAll<Cte>((f, t) => supabase.from('ctes').select('*').gte('data_emissao', desde).order('id').range(f, t)); if (vivo) setCtes(l); }
      catch (err) { console.error(err); }
      if (vivo) setCarregado(true);
    })();
    return () => { vivo = false; };
  }, [mesAtual]);

  // impressão: só o relatório aparece no papel
  useEffect(() => {
    if (!imprimir) return;
    document.documentElement.classList.add('print-avaliacao');
    const t = setTimeout(() => window.print(), 300);
    const fim = () => { document.documentElement.classList.remove('print-avaliacao'); setImprimir(false); };
    window.addEventListener('afterprint', fim, { once: true });
    return () => { clearTimeout(t); window.removeEventListener('afterprint', fim); document.documentElement.classList.remove('print-avaliacao'); };
  }, [imprimir]);

  const apr = useMemo(() => aprenderPrazos(entregas, hoje), [entregas, hoje]);
  // prazo contratado nas tabelas de frete entra como prazo de trânsito (como na Logística & SLA)
  const slaEfetivo = useMemo(() => ({
    ...sla, rotas: [...sla.rotas, ...tabelas.flatMap((x) => {
      const dias = Number(x.componentes?.prazo_dias);
      const nome = transportadoras.find((t) => String(t.id) === String(x.transportadora_id))?.nome;
      return x.ativo && x.uf !== '*' && dias > 0 && nome ? [{ uf: x.uf, transportadora: nome, dias }] : [];
    })],
  }), [sla, tabelas, transportadoras]);
  const entrada: EntradaAvaliacao = useMemo(() => ({
    entregas, devolucoes, transportadoras, ctes, tabelas, faturas, ocorrencias, sla: slaEfetivo, apr, margemCotadoPct: fin.margem, tolTabelaPct: fin.tol, cfg,
  }), [entregas, devolucoes, transportadoras, ctes, tabelas, faturas, ocorrencias, slaEfetivo, apr, fin, cfg]);

  const lista = useMemo(() => (carregado ? avaliarMes(mes, entrada, hoje) : []), [carregado, mes, entrada, hoje]);
  const hist = useMemo(() => (carregado ? historicoNotas(mes, entrada, hoje, 6) : { meses: [], porTransp: new Map<string, (number | null)[]>() }), [carregado, mes, entrada, hoje]);
  const anteriorDe = (id: string) => hist.porTransp.get(id)?.[4] ?? null;

  const meses = useMemo(() => {
    const s = new Set(entregas.map((e) => e.data_faturamento?.slice(0, 7)).filter((m): m is string => !!m && m <= mesAtual));
    s.add(mesAtual);
    return [...s].sort().reverse().slice(0, 18);
  }, [entregas, mesAtual]);
  const emAndamento = mes === mesAtual;
  const rotulo = fmtMes(mes);

  const comNota = lista.filter((a) => a.nota !== null);
  const nfsTot = comNota.reduce((s, a) => s + a.nfs, 0);
  const media = nfsTot ? comNota.reduce((s, a) => s + (a.nota ?? 0) * a.nfs, 0) / nfsTot : null;
  const mediaAnt = (() => {
    let s = 0; let n = 0;
    for (const a of comNota) { const p = anteriorDe(a.id); if (p !== null) { s += p * a.nfs; n += a.nfs; } }
    return n ? s / n : null;
  })();
  const confiaveis = comNota.filter((a) => !a.amostraPequena);
  const melhor = confiaveis[0] ?? comNota[0];
  const pior = confiaveis.length > 1 ? confiaveis[confiaveis.length - 1] : null;
  const criticas = comNota.filter((a) => a.conceito === 'D' || a.conceito === 'C');

  async function salvarCfg(c: ConfigAvaliacao) {
    const { error } = await supabase.from('configuracoes').upsert({ chave: 'avaliacao', valor: c }, { onConflict: 'chave' });
    if (error) { toast({ kind: 'error', title: 'Não foi possível salvar', text: mensagemErro(error) }); throw error; }
    setCfg(c);
    registrarLog('EDITOU', 'TRANSPORTADORAS', `Alterou os critérios da avaliação de transportadoras (pesos: ${CRITERIOS.map((x) => `${x.curto} ${c.pesos[x.id]}`).join(', ')})`);
    toast({ kind: 'success', title: 'Critérios salvos' });
  }

  function exportar() {
    if (!lista.length) { toast({ kind: 'warning', title: 'Não há dados para exportar.' }); return; }
    downloadCsv(`MunilaLog_Avaliacao_Transportadoras_${mes}`,
      ['Transportadora', 'NFs', 'Nota', 'Conceito', 'Mês anterior', ...CRITERIOS.flatMap((c) => [`${c.curto} (nota)`, `${c.curto} (resultado)`]), 'Pontos de atenção'],
      lista.map((a) => [a.nome, a.nfs, a.nota === null ? '-' : csvNum(a.nota.toFixed(1)), a.conceito ?? '-', anteriorDe(a.id) === null ? '-' : csvNum(anteriorDe(a.id)!.toFixed(1)),
        ...CRITERIOS.flatMap((c) => [a.criterios[c.id].nota === null ? '-' : csvNum(a.criterios[c.id].nota!.toFixed(1)), a.criterios[c.id].valor]), a.pontos.join(' | ')]));
  }

  const sel = aberta ? lista.find((a) => a.id === aberta) : undefined;
  const msg = sel ? mensagemAvaliacao(sel, rotulo, anteriorDe(sel.id)) : '';
  const fone = (sel?.transportadora?.telefone ?? '').replace(/\D/g, '');
  const copiar = async () => { try { await navigator.clipboard.writeText(msg); toast({ kind: 'success', title: 'Avaliação copiada' }); } catch { toast({ kind: 'error', title: 'Não foi possível copiar' }); } };
  const registrarEnvio = (canal: string) => { if (sel) registrarLog('CRIOU', 'TRANSPORTADORAS', `Enviou a avaliação de ${rotulo} (nota ${fmtNota(sel.nota)}) para a ${sel.nome} por ${canal}`); };

  return (
    <div className="page av">
      <PageHeader icon={<Award size={22} />} title="Avaliação de transportadoras"
        subtitle="Nota mensal de 0 a 10 por prazo, coleta, qualidade, cobrança e informação — para acompanhar, cobrar e negociar"
        actions={<>
          <select className="select" value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mês">
            {meses.map((m) => <option key={m} value={m}>{fmtMes(m)}{m === mesAtual ? ' (em andamento)' : ''}</option>)}
          </select>
          {isAdmin && <button className="btn" onClick={() => setPesos(true)}><Settings2 size={16} /> Critérios</button>}
          <button className="btn btn-success-outline" onClick={exportar}><Download size={16} /> Exportar</button>
        </>} />

      {emAndamento && <div className="av-aviso"><TriangleAlert size={16} /> {rotulo} ainda está em andamento: as notas mudam até o fim do mês. Para enviar às transportadoras, prefira o mês fechado.</div>}

      {!carregado || loading ? <div className="card card-pad muted">Calculando as avaliações…</div> : !lista.length ? (
        <div className="card"><EmptyState icon={<Award size={32} />} title={`Sem NFs com transportadora em ${rotulo}`} text="Escolha outro mês." /></div>
      ) : (<>
        <div className="bi-kpis">
          <KpiBI label="Nota média (por volume)" tone="blue" icon={<Star size={18} />} value={fmtNota(media)} unit=" / 10" melhor="maior" tipo="num"
            delta={media !== null && mediaAnt !== null ? media - mediaAnt : null} vsTexto={mediaAnt !== null ? `vs. ${fmtNota(mediaAnt)} no mês anterior` : undefined}
            sub={`${num(comNota.length)} transportadora(s) · ${num(nfsTot)} NFs`} />
          {melhor && <KpiBI label="Melhor do mês" tone="green" icon={<Trophy size={18} />} value={melhor.nome} sub={`Nota ${fmtNota(melhor.nota)}${melhor.conceito ? ` · ${CONCEITO[melhor.conceito].label}` : ''} · ${num(melhor.nfs)} NFs`} />}
          {pior && <KpiBI label="Precisa de atenção" tone="red" icon={<TriangleAlert size={18} />} value={pior.nome} sub={`Nota ${fmtNota(pior.nota)} · ${pior.pontos[0] ?? ''}`} />}
          <KpiBI label="Abaixo de 7 (C ou D)" tone="amber" icon={<Award size={18} />} value={num(criticas.length)} unit={` de ${num(comNota.length)}`}
            sub={criticas.length ? criticas.slice(0, 3).map((a) => a.nome).join(', ') + (criticas.length > 3 ? '…' : '') : 'Todas com conceito A ou B'} />
        </div>

        <div className="card bi-ranking">
          <div className="table-scroll">
            <table className="bi-tabela av-tabela">
              <thead>
                <tr>
                  <th>#</th><th>Transportadora</th><th className="r">Nota</th>
                  {CRITERIOS.map((c) => <th key={c.id} className="c" title={c.dica}>{c.curto}<small>{cfg.pesos[c.id]}</small></th>)}
                  <th className="r">NFs</th><th>6 meses</th><th>Principal ponto de atenção</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((a, i) => (
                  <tr key={a.id} onClick={() => setAberta(a.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setAberta(a.id); }}>
                    <td className="bi-tabela__pos">{i + 1}</td>
                    <td className="bi-tabela__nome"><span>{a.nome}{a.conceito && <span className={`badge tone-${CONCEITO[a.conceito].tone}`}>{a.conceito}</span>}{a.amostraPequena && <small className="muted" title={`Menos de ${cfg.min_nfs} NFs no mês`}>amostra pequena</small>}</span></td>
                    <td className="r"><span className="av-nota" style={{ color: a.nota === null ? undefined : `var(--${a.conceito ? CONCEITO[a.conceito].tone : 'slate'})` }}>{fmtNota(a.nota)}</span> <DeltaNota atual={a.nota} anterior={anteriorDe(a.id)} /></td>
                    {CRITERIOS.map((c) => <td key={c.id} className="c"><ChipNota nota={a.criterios[c.id].nota} titulo={`${a.criterios[c.id].valor} — ${a.criterios[c.id].detalhe}`} /></td>)}
                    <td className="r">{num(a.nfs)}</td>
                    <td><Sparkline valores={hist.porTransp.get(a.id) ?? []} /></td>
                    <td className="av-ponto">{a.pontos[0] ?? <span className="text-green">Sem pontos de atenção</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="muted bi-legenda">Clique numa transportadora para ver o relatório completo e enviá-lo. Os números pequenos no cabeçalho são os pesos de cada critério. Passe o mouse sobre as notas para ver o resultado.</p>
      </>)}

      {sel && (
        <Modal size="lg" autoFocus={false} onClose={() => setAberta(null)} title={`${sel.nome} · ${rotulo}`} subtitle="Relatório de desempenho para acompanhar e enviar à transportadora"
          footer={<>
            <button className="btn" onClick={copiar}><ClipboardCopy size={15} /> Copiar resumo</button>
            <a className="btn" href={`https://wa.me/${fone.length >= 10 ? (fone.startsWith('55') ? fone : '55' + fone) : ''}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" onClick={() => registrarEnvio('WhatsApp')}><MessageCircle size={15} /> WhatsApp</a>
            <a className="btn" href={`mailto:${sel.transportadora?.email ?? ''}?subject=${encodeURIComponent(`Avaliação de desempenho ${rotulo} — Munila`)}&body=${encodeURIComponent(msg)}`} onClick={() => registrarEnvio('e-mail')}><Mail size={15} /> E-mail</a>
            <button className="btn btn-primary" onClick={() => setImprimir(true)}><Printer size={15} /> Imprimir / PDF</button>
          </>}>
          <RelatorioAvaliacao a={sel} rotuloMes={rotulo} anterior={anteriorDe(sel.id)} meses={hist.meses} historico={hist.porTransp.get(sel.id) ?? []} emAndamento={emAndamento} />
          {(sel.coletasAtrasadas.length > 0 || sel.semCanhoto.length > 0) && (
            <div className="av-extra">
              {sel.coletasAtrasadas.length > 0 && (
                <details><summary>Coletas depois do D+{sla.coleta_dias} ({sel.coletasAtrasadas.length})</summary>
                  <ul>{sel.coletasAtrasadas.slice(0, 40).map(({ e, dias }) => <li key={e.id}>NF {e.nota_fiscal} · {e.clientes?.nome ?? '—'} ({ufDestino(e)}) · faturada {formatDate(e.data_faturamento)} · coleta {e.data_coleta ? formatDate(e.data_coleta) : 'pendente'} · {dias} d.u. depois</li>)}</ul>
                </details>
              )}
              {sel.semCanhoto.length > 0 && (
                <details><summary>Entregas sem canhoto no portal ({sel.semCanhoto.length})</summary>
                  <ul>{sel.semCanhoto.slice(0, 40).map((e) => <li key={e.id}>NF {e.nota_fiscal} · {e.clientes?.nome ?? '—'} · entregue {formatDate(e.data_entrega_agendamento)}</li>)}</ul>
                </details>
              )}
            </div>
          )}
        </Modal>
      )}
      {sel && imprimir && createPortal(
        <div className="av-print">
          <RelatorioAvaliacao a={sel} rotuloMes={rotulo} anterior={anteriorDe(sel.id)} meses={hist.meses} historico={hist.porTransp.get(sel.id) ?? []} emAndamento={emAndamento} />
        </div>, document.body)}
      {pesos && <ModalPesos cfg={cfg} onClose={() => setPesos(false)} onSalvar={salvarCfg} />}
    </div>
  );
}

