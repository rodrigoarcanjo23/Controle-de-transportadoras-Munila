import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ChevronDown, CirclePlus, DollarSign, Download, Eraser, FileText, Link2, Pencil, Printer, RefreshCcw, Save, Trash2, UploadCloud, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchAll, registrarLog, mensagemErro } from '../lib/db';
import { SITUACOES_CTE } from '../lib/constants';
import { formatDate, formatInt, formatMoney, matchesSearch, parseDecimalBR, toNumber } from '../lib/format';
import { downloadCsv, csvNum } from '../lib/csv';
import { lerArquivoTexto, parseCteXml } from '../lib/xml';
import { atualizacoesPendentes, calcularIntegracao, extrairNFs } from '../lib/integracaoCte';
import { loadPrefRaw, savePref } from '../lib/storage';
import { useAppData } from '../state/context';
import { useFeedback } from '../feedback/context';
import { Badge, FilterCard, Field, KpiCard, PageHeader } from '../components/ui/basics';
import { DataTable, type Column } from '../components/ui/DataTable';
import type { Cte } from '../types';

const VAZIO = {
  numero_documento: '', chave_acesso: [''] as string[], razao_social_emitente: '', cnpj_emitente: '',
  cfop: '', valor_total_servico: '', situacao: 'ABERTO', data_emissao: '', observacao: '',
};
const FILTROS = { dataInicio: '', dataFim: '', numero: '', chave: '', emitente: '', cfop: '', situacao: '' };

export default function Ctes() {
  const { transportadoras, entregas, setEntregas } = useAppData();
  const { toast, confirm } = useFeedback();
  const [ctes, setCtes] = useState<Cte[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sync, setSync] = useState<{ atual: number; total: number } | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(VAZIO);
  const [f, setF] = useState(FILTROS);
  const [soNaoEncontrados, setSoNaoEncontrados] = useState(false);
  const [formAberto, setFormAberto] = useState<boolean>(() => loadPrefRaw('cteFormAberto', window.innerWidth >= 768));
  const fileRef = useRef<HTMLInputElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAll<Cte>((from, to) => supabase.from('ctes').select('*').order('created_at', { ascending: false }).order('id').range(from, to))
      .then(setCtes)
      .catch((err) => toast({ kind: 'error', title: 'Erro ao buscar CTEs', text: mensagemErro(err) }))
      .finally(() => setLoading(false));
  }, [toast]);

  const abrirForm = (v: boolean) => { setFormAberto(v); savePref('cteFormAberto', v); };

  // Correspondência CTE ↔ Painel (NF a NF, aceita entregas com "17248 / 17252")
  const calc = useMemo(() => calcularIntegracao(ctes, entregas), [ctes, entregas]);
  const nfsDasChaves = (ch?: string | null) => { const n = extrairNFs(ch); return n.length ? n.join(' / ') : '-'; };
  const naoEncontrados = useMemo(() => ctes.filter((c) => (calc.porCte.get(c.id)?.faltando.length ?? 0) > 0).length, [ctes, calc]);

  const filtrados = useMemo(() => ctes.filter((c) => {
    if (soNaoEncontrados && !(calc.porCte.get(c.id)?.faltando.length)) return false;
    if (f.dataInicio && (c.data_emissao ?? '') < f.dataInicio) return false;
    if (f.dataFim && (c.data_emissao ?? '') > f.dataFim) return false;
    if (f.numero && !matchesSearch(f.numero, c.numero_documento)) return false;
    if (f.chave && !matchesSearch(f.chave, c.chave_acesso, nfsDasChaves(c.chave_acesso))) return false;
    if (f.emitente && !matchesSearch(f.emitente, c.razao_social_emitente)) return false;
    if (f.cfop && !matchesSearch(f.cfop, c.cfop)) return false;
    if (f.situacao && c.situacao !== f.situacao) return false;
    return true;
  }), [ctes, f, soNaoEncontrados, calc]);

  const totalServico = filtrados.reduce((a, c) => a + toNumber(c.valor_total_servico), 0);
  const temFiltro = Object.values(f).some(Boolean);
  const nfsIdentificadas = extrairNFs(form.chave_acesso.join(','));

  /** Grava o frete real nas entregas (em lotes paralelos) e atualiza a tela. */
  async function gravarFretes(lista: { id: string; valor: number }[], progresso?: (n: number) => void, origem?: string) {
    let ok = 0;
    const gravadas = new Map<string, number>();
    for (let i = 0; i < lista.length; i += 8) {
      const lote = lista.slice(i, i + 8);
      const res = await Promise.all(lote.map((u) =>
        supabase.from('entregas').update({ valor_frete_real: u.valor, frete_confirmado: true }).eq('id', u.id)));
      res.forEach((r, j) => { if (!r.error) { ok++; gravadas.set(lote[j].id, lote[j].valor); } else console.error('Erro na integração CTE → Entrega', r.error); });
      progresso?.(Math.min(i + 8, lista.length));
    }
    if (gravadas.size) {
      setEntregas((l) => l.map((e) => (gravadas.has(e.id) ? { ...e, valor_frete_real: gravadas.get(e.id)!, frete_confirmado: true } : e)));
      // registra NF por NF (em blocos) para aparecer no histórico de cada entrega
      const nfDe = new Map(entregas.map((e) => [e.id, e.nota_fiscal]));
      const linhas = [...gravadas].map(([id, v]) => `NF ${nfDe.get(id) ?? id} = ${formatMoney(v)}`);
      for (let i = 0; i < linhas.length; i += 30) {
        await registrarLog('EDITOU', 'ENTREGAS', `Frete real aplicado pelo CTE${origem ? ` ${origem}` : ''}: ${linhas.slice(i, i + 30).join('; ')}`);
      }
    }
    return ok;
  }

  /** CTE → Painel: rateia o valor do CTE entre as NFs e marca o frete como confirmado. */
  async function integrarFrete(cte: Cte, todosCtes: Cte[]) {
    const c = calcularIntegracao(todosCtes, entregas);
    const r = c.porCte.get(cte.id);
    if (!r || !r.nfs.length) return;
    const pend = atualizacoesPendentes(c, entregas, new Set(r.entregas));
    const ok = await gravarFretes(pend, undefined, `Nº ${cte.numero_documento}`);
    const nfsAtualizadas = entregas.filter((e) => r.entregas.includes(e.id)).map((e) => e.nota_fiscal);
    if (r.encontradas.length && !r.faltando.length) {
      toast({ kind: 'success', title: 'Integração concluída', duration: 9000,
        text: `Entrega(s) no Painel: ${nfsAtualizadas.join(', ')}\nFrete real de ${formatMoney(r.rateioPorNF)} por NF aplicado e frete confirmado${ok < pend.length ? ' (algumas falharam, tente sincronizar)' : ''}.` });
    } else if (r.encontradas.length) {
      toast({ kind: 'warning', title: 'Integração parcial', duration: 12000,
        text: `Atualizadas: ${nfsAtualizadas.join(', ')}\nNão encontradas no Painel: ${r.faltando.join(', ')}. Lance essas NFs no Painel e clique em “Sincronizar histórico”.` });
    } else {
      toast({ kind: 'warning', title: 'CTE salvo, mas sem NF correspondente', duration: 12000,
        text: `As NFs (${r.nfs.join(', ')}) não foram encontradas no Painel de Entregas. Lance a NF no Painel e depois clique em “Sincronizar histórico”.` });
    }
  }

  async function sincronizarHistorico() {
    const pend = atualizacoesPendentes(calc, entregas);
    const corretas = calc.porEntrega.size - pend.length;
    if (!pend.length) {
      toast({ kind: 'success', title: 'Tudo sincronizado', text: `As ${calc.porEntrega.size} entregas ligadas a CTEs já estão com o frete real correto.${naoEncontrados ? `\n${naoEncontrados} CTE(s) têm NFs que não estão no Painel.` : ''}` });
      return;
    }
    const ok = await confirm({
      title: 'Sincronização retroativa',
      text: `${pend.length} entrega(s) do Painel vão receber o frete real dos CTEs (incluindo entregas com várias NFs, como "17248 / 17252").\n${corretas} já estão corretas e não serão alteradas.${calc.nfsRepetidas.length ? `\n\nAtenção: ${calc.nfsRepetidas.length} NF(s) aparecem em mais de um CTE (ex.: ${calc.nfsRepetidas.slice(0, 5).join(', ')}) — os fretes delas serão SOMADOS. Elas ficam marcadas como “NF em 2+ CTEs” na tabela.` : ''}\nNenhum dado do CTE será alterado.`,
      confirmLabel: `Atualizar ${pend.length} entrega(s)`,
    });
    if (!ok) return;
    setSync({ atual: 0, total: pend.length });
    try {
      const total = await gravarFretes(pend, (n) => setSync({ atual: n, total: pend.length }), '(sincronização)');
      toast({ kind: total === pend.length ? 'success' : 'warning', title: 'Sincronização concluída', duration: 10000,
        text: `${total} entrega(s) atualizadas no Painel${total < pend.length ? ` (${pend.length - total} falharam)` : ''}.${naoEncontrados ? `\n${naoEncontrados} CTE(s) têm NFs que não estão no Painel — use o filtro “NF não encontrada”.` : ''}` });
      await registrarLog('EDITOU', 'CTES', `Executou a sincronização retroativa de CTEs (${total} entregas atualizadas no Painel Principal)`);
    } catch (err) {
      toast({ kind: 'error', title: 'Erro durante a sincronização', text: mensagemErro(err) });
    } finally { setSync(null); }
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const chaves = form.chave_acesso.map((c) => c.trim()).filter(Boolean);
    const duplicado = ctes.find((c) => {
      if (editandoId && c.id === editandoId) return false;
      const salvas = (c.chave_acesso ?? '').split(',').map((x) => x.trim());
      return chaves.some((ch) => salvas.includes(ch));
    });
    if (duplicado) {
      toast({ kind: 'error', title: 'Duplicidade detectada — registro bloqueado', duration: 10000,
        text: `Uma ou mais chaves já pertencem ao CTE nº ${duplicado.numero_documento} (${duplicado.razao_social_emitente || 'emitente desconhecido'}).` });
      return;
    }

    setSalvando(true);
    const payload = {
      numero_documento: form.numero_documento, chave_acesso: chaves.join(','), razao_social_emitente: form.razao_social_emitente.toUpperCase(),
      cnpj_emitente: form.cnpj_emitente, cfop: form.cfop, valor_total_servico: parseDecimalBR(form.valor_total_servico) ?? 0,
      situacao: form.situacao, data_emissao: form.data_emissao || null, observacao: form.observacao,
    };
    try {
      let salvo: Cte | undefined;
      if (editandoId) {
        const { data, error } = await supabase.from('ctes').update(payload).eq('id', editandoId).select('*');
        if (error) throw error;
        salvo = data?.[0];
        if (salvo) setCtes((l) => l.map((c) => (c.id === editandoId ? salvo! : c)));
        await registrarLog('EDITOU', 'CTES', `Editou o CTE Nº ${payload.numero_documento} (${payload.razao_social_emitente})`);
      } else {
        const { data, error } = await supabase.from('ctes').insert([payload]).select('*');
        if (error) throw error;
        salvo = data?.[0];
        if (salvo) setCtes((l) => [salvo!, ...l]);
        await registrarLog('CRIOU', 'CTES', `Registrou um novo CTE Nº ${payload.numero_documento} (${payload.razao_social_emitente})`);
      }
      if (salvo) {
        const s = salvo;
        const lista = editandoId ? ctes.map((c) => (c.id === s.id ? s : c)) : [s, ...ctes];
        await integrarFrete(s, lista);
      }
      cancelar();
    } catch (err) {
      toast({ kind: 'error', title: 'Erro ao processar o CTE', text: mensagemErro(err) });
    } finally { setSalvando(false); }
  }

  function editar(c: Cte) {
    setEditandoId(c.id);
    setForm({
      numero_documento: c.numero_documento ?? '', chave_acesso: c.chave_acesso ? c.chave_acesso.split(',') : [''],
      razao_social_emitente: c.razao_social_emitente ?? '', cnpj_emitente: c.cnpj_emitente ?? '', cfop: c.cfop ?? '',
      valor_total_servico: c.valor_total_servico?.toString().replace('.', ',') ?? '', situacao: c.situacao ?? 'ABERTO',
      data_emissao: c.data_emissao ?? '', observacao: c.observacao ?? '',
    });
    abrirForm(true);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelar() { setEditandoId(null); setForm(VAZIO); }

  async function excluir(c: Cte) {
    const ok = await confirm({ title: `Excluir o CTE nº ${c.numero_documento}?`, text: 'O frete já aplicado nas entregas não é desfeito.', danger: true, confirmLabel: 'Excluir' });
    if (!ok) return;
    const { error } = await supabase.from('ctes').delete().eq('id', c.id);
    if (error) { toast({ kind: 'error', title: 'Não foi possível excluir', text: mensagemErro(error) }); return; }
    setCtes((l) => l.filter((x) => x.id !== c.id));
    await registrarLog('APAGOU', 'CTES', `Excluiu o CTE Nº ${c.numero_documento} (${c.razao_social_emitente})`);
    toast({ kind: 'success', title: 'CTE excluído' });
  }

  async function importarXml(file: File) {
    try {
      const x = parseCteXml(await lerArquivoTexto(file));
      setForm((p) => ({ ...p, ...x, valor_total_servico: x.valor_total_servico.replace('.', ',') }));
      abrirForm(true);
      toast({ kind: 'success', title: 'XML lido com sucesso', text: `${x.chave_acesso.filter(Boolean).length} chave(s) vinculada(s) encontrada(s). Confira e clique em Registrar.` });
      registrarLog('CRIOU', 'CTES', `Importou XML para preenchimento de CTE (Emissor: ${x.razao_social_emitente})`);
    } catch {
      toast({ kind: 'error', title: 'Erro ao ler o XML', text: 'Certifique-se de que é um arquivo XML válido.' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function exportar() {
    if (!filtrados.length) { toast({ kind: 'warning', title: 'Não há dados para exportar com estes filtros.' }); return; }
    downloadCsv('MunilaLog_CTEs',
      ['Data', 'Nº Doc', 'Emitente', 'CNPJ', 'CFOP', 'NFs Vinculadas', 'Chaves Vinculadas', 'Valor Serv. (R$)', 'Situação', 'Observação'],
      filtrados.map((c) => [formatDate(c.data_emissao), c.numero_documento, c.razao_social_emitente || '-', c.cnpj_emitente || '-', c.cfop || '-',
        nfsDasChaves(c.chave_acesso), c.chave_acesso ? c.chave_acesso.replace(/,/g, ' | ') : '-', csvNum(c.valor_total_servico), c.situacao, c.observacao || '-']));
  }

  const setChave = (i: number, v: string) => setForm((p) => ({ ...p, chave_acesso: p.chave_acesso.map((c, j) => (j === i ? v : c)) }));

  const cols: Column<Cte>[] = [
    { key: 'num', header: 'Nº doc', render: (c) => <strong className="text-brand">CTE {c.numero_documento}</strong>, mobile: 'title', sortValue: (c) => Number(c.numero_documento) || c.numero_documento },
    { key: 'data', header: 'Data', render: (c) => formatDate(c.data_emissao), sortValue: (c) => c.data_emissao },
    { key: 'emit', header: 'Emitente', render: (c) => c.razao_social_emitente || '-', className: 'strong', mobile: 'subtitle', sortValue: (c) => c.razao_social_emitente },
    { key: 'cnpj', header: 'CNPJ', render: (c) => c.cnpj_emitente || '-', className: 'num', mobile: 'hide' },
    { key: 'cfop', header: 'CFOP', render: (c) => c.cfop || '-' },
    { key: 'nfs', header: 'NFs (origem)', render: (c) => <span className="strong text-green">{nfsDasChaves(c.chave_acesso)}</span> },
    {
      key: 'painel', header: 'No Painel', label: 'No Painel', align: 'center', title: 'NFs do CTE encontradas no Painel de Entregas',
      sortValue: (c) => { const r = calc.porCte.get(c.id); return r && r.nfs.length ? r.encontradas.length / r.nfs.length : -1; },
      render: (c) => {
        const r = calc.porCte.get(c.id);
        if (!r || !r.nfs.length) return <span className="muted">-</span>;
        const repetida = r.emOutrosCtes.length > 0 && (
          <span title={`NF ${r.emOutrosCtes.join(', ')} também aparece em outro CTE — os fretes foram somados. Confira se não é CTE cancelado/substituído.`}>
            <Badge tone="purple" square>NF em 2+ CTEs</Badge>
          </span>
        );
        if (!r.faltando.length) return <span style={{ display: 'inline-flex', gap: 4 }}><Badge tone="green" square>✓ {r.encontradas.length}/{r.nfs.length}</Badge>{repetida}</span>;
        return (
          <span style={{ display: 'inline-flex', gap: 4 }} title={`Não encontradas no Painel: ${r.faltando.join(', ')}`}>
            <Badge tone={r.encontradas.length ? 'amber' : 'red'} square>{r.encontradas.length}/{r.nfs.length} · falta {r.faltando.join(', ')}</Badge>{repetida}
          </span>
        );
      },
    },
    {
      key: 'chaves', header: 'Chaves vinculadas', className: 'wrap', mobile: 'hide',
      render: (c) => (c.chave_acesso ? <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{c.chave_acesso.split(',').map((ch, i) => <span key={i} className="mono text-brand">{ch}</span>)}</div> : '-'),
    },
    { key: 'valor', header: 'Valor serviço', render: (c) => formatMoney(c.valor_total_servico), align: 'right', className: 'num strong', sortValue: (c) => toNumber(c.valor_total_servico) },
    { key: 'sit', header: 'Situação', render: (c) => <Badge square>{c.situacao}</Badge>, mobile: 'badge', sortValue: (c) => c.situacao },
  ];

  return (
    <div className="page" ref={topRef}>
      <PageHeader icon={<FileText size={22} />} title="Registro de CTE" subtitle="Conhecimentos de transporte e conferência automática do frete nas entregas"
        actions={
          <>
            <input type="file" accept=".xml,text/xml" ref={fileRef} hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) importarXml(file); }} />
            <button className="btn btn-purple-outline" onClick={sincronizarHistorico} disabled={!!sync || loading}>
              <RefreshCcw size={16} className={sync ? 'spin' : ''} /> {sync ? `Sincronizando ${sync.atual}/${sync.total}` : 'Sincronizar histórico'}
            </button>
            <button className="btn btn-primary" onClick={() => fileRef.current?.click()}><UploadCloud size={16} /> Importar XML</button>
          </>
        } />

      <div className="card no-print">
        <button type="button" className="card-header" style={{ width: '100%', flexWrap: 'nowrap', background: 'none', border: 0, borderBottom: formAberto ? '1px solid var(--border)' : 0, cursor: 'pointer', textAlign: 'left' }}
          onClick={() => abrirForm(!formAberto)} aria-expanded={formAberto}>
          <div>
            <div className="card-title">{editandoId ? <><Pencil size={16} /> Editando CTE nº {form.numero_documento}</> : <><CirclePlus size={16} /> Lançar CTE manualmente</>}</div>
            <div className="card-subtitle">Ou use “Importar XML” para preencher automaticamente.</div>
          </div>
          <ChevronDown size={18} style={{ transform: formAberto ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        </button>

        {formAberto && (
          <form onSubmit={salvar} className="card-pad">
            <div className="form-grid form-grid--auto">
              <Field label="Nº documento fiscal" required><input className="input" required placeholder="Ex: 9029" value={form.numero_documento} onChange={(e) => setForm({ ...form, numero_documento: e.target.value })} /></Field>
              <Field label="Razão social do emitente" required className="span-2">
                <input className="input" list="transp-sugestoes" required placeholder="Digite o nome da transportadora…" value={form.razao_social_emitente} onChange={(e) => setForm({ ...form, razao_social_emitente: e.target.value })} />
                <datalist id="transp-sugestoes">{transportadoras.map((t) => <option key={t.id} value={t.nome} />)}</datalist>
              </Field>
              <Field label="CNPJ"><input className="input" placeholder="00.000.000/0000-00" value={form.cnpj_emitente} onChange={(e) => setForm({ ...form, cnpj_emitente: e.target.value })} /></Field>
              <Field label="CFOP"><input className="input" placeholder="Ex: 5351" value={form.cfop} onChange={(e) => setForm({ ...form, cfop: e.target.value })} /></Field>
              <Field label="Valor total do serviço (R$)" required><input className="input num" required inputMode="decimal" placeholder="0,00" value={form.valor_total_servico} onChange={(e) => setForm({ ...form, valor_total_servico: e.target.value.replace(/[^\d.,]/g, '') })} /></Field>
              <Field label="Data de emissão" required><input type="date" className="input" required value={form.data_emissao} onChange={(e) => setForm({ ...form, data_emissao: e.target.value })} /></Field>
              <Field label="Situação">
                <select className="select" value={form.situacao} onChange={(e) => setForm({ ...form, situacao: e.target.value })}>
                  {SITUACOES_CTE.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>

              <div className="fieldset span-all">
                <div className="fieldset__title"><Link2 size={14} /> Chaves de acesso (NFs vinculadas)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {form.chave_acesso.map((ch, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8 }}>
                      <input className="input mono" style={{ fontSize: '0.85rem' }} placeholder="Chave de 44 dígitos ou nº da NF" value={ch} onChange={(e) => setChave(i, e.target.value)} />
                      {form.chave_acesso.length > 1 && (
                        <button type="button" className="icon-btn icon-btn--danger" onClick={() => setForm((p) => ({ ...p, chave_acesso: p.chave_acesso.filter((_, j) => j !== i) }))} title="Remover chave"><X size={16} /></button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-sm btn-ghost text-brand" style={{ marginTop: 8 }} onClick={() => setForm((p) => ({ ...p, chave_acesso: [...p.chave_acesso, ''] }))}>
                  <CirclePlus size={15} /> Adicionar chave
                </button>
                {nfsIdentificadas.length > 0 && (
                  <div className="callout tone-green" style={{ marginTop: 10 }}><FileText size={16} /> NFs prontas para integração: {nfsIdentificadas.join(' / ')}</div>
                )}
              </div>

              <Field label="Observações do transporte" className="span-all"><input className="input" placeholder="Apólice, seguro, agendamentos…" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} /></Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              {(editandoId || form.numero_documento) && <button type="button" className="btn" onClick={cancelar}><X size={16} /> {editandoId ? 'Cancelar edição' : 'Limpar'}</button>}
              <button type="submit" className="btn btn-primary" disabled={salvando}>
                <Save size={16} /> {salvando ? 'Integrando…' : editandoId ? 'Atualizar e integrar CTE' : 'Registrar e integrar CTE'}
              </button>
            </div>
          </form>
        )}
      </div>

      <FilterCard ativos={Object.values(f).filter(Boolean).length} minCol={135}>
          <Field label="Emissão — de"><input type="date" className="input" value={f.dataInicio} onChange={(e) => setF({ ...f, dataInicio: e.target.value })} /></Field>
          <Field label="Emissão — até"><input type="date" className="input" value={f.dataFim} onChange={(e) => setF({ ...f, dataFim: e.target.value })} /></Field>
          <Field label="Nº documento"><input className="input" placeholder="Buscar…" value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} /></Field>
          <Field label="Chave ou nº da NF"><input className="input" placeholder="Buscar…" value={f.chave} onChange={(e) => setF({ ...f, chave: e.target.value })} /></Field>
          <Field label="Emitente"><input className="input" placeholder="Nome…" value={f.emitente} onChange={(e) => setF({ ...f, emitente: e.target.value })} /></Field>
          <Field label="CFOP"><input className="input" placeholder="Ex: 5351" value={f.cfop} onChange={(e) => setF({ ...f, cfop: e.target.value })} /></Field>
          <Field label="Situação">
            <select className="select" value={f.situacao} onChange={(e) => setF({ ...f, situacao: e.target.value })}>
              <option value="">Todas</option>
              {SITUACOES_CTE.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          {temFiltro && <button className="btn btn-danger-outline" onClick={() => setF(FILTROS)}><Eraser size={16} /> Limpar</button>}
      </FilterCard>

      <div className="kpi-grid">
        <KpiCard label="Valor total do serviço" value={formatMoney(totalServico)} icon={<DollarSign size={16} />} tone="green" hint="Soma dos CTEs filtrados" />
        <KpiCard label="Quantidade de CTEs" value={formatInt(filtrados.length)} unit=" documentos" icon={<FileText size={16} />} tone="blue" hint="Registros encontrados" />
      </div>

      <div className="card table-card">
        <div className="card-header no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="card-title">Histórico de CTEs</div>
            {naoEncontrados > 0 && (
              <button className={`chip ${soNaoEncontrados ? 'chip--on' : ''}`} onClick={() => setSoNaoEncontrados((v) => !v)} aria-pressed={soNaoEncontrados}
                title="CTEs com alguma NF que não existe no Painel de Entregas">
                NF não encontrada no Painel ({naoEncontrados})
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm hide-mobile" onClick={() => window.print()}><Printer size={15} /> PDF</button>
            <button className="btn btn-sm btn-success-outline" onClick={exportar}><Download size={15} /> Excel</button>
          </div>
        </div>
        <DataTable rows={filtrados} columns={cols} rowKey={(c) => c.id} loading={loading} fill onRowClick={editar}
          actions={(c) => (
            <>
              <button className="icon-btn icon-btn--sm" onClick={() => editar(c)} title="Editar"><Pencil size={16} /></button>
              <button className="icon-btn icon-btn--sm icon-btn--danger" onClick={() => excluir(c)} title="Excluir"><Trash2 size={16} /></button>
            </>
          )} />
      </div>
    </div>
  );
}
