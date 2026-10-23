import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ChevronDown, CirclePlus, DollarSign, Download, Eraser, FileText, Link2, Pencil, Printer, RefreshCcw, Save, Trash2, UploadCloud, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchAll, registrarLog, mensagemErro } from '../lib/db';
import { SITUACOES_CTE } from '../lib/constants';
import { formatDate, formatInt, formatMoney, matchesSearch, parseDecimalBR, toNumber } from '../lib/format';
import { downloadCsv, csvNum } from '../lib/csv';
import { lerArquivoTexto, nfsDasChaves, obterListaNFs, parseCteXml, variacoesNF } from '../lib/xml';
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
  const { transportadoras, recarregarEntregas } = useAppData();
  const { toast, confirm } = useFeedback();
  const [ctes, setCtes] = useState<Cte[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sync, setSync] = useState<{ atual: number; total: number } | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(VAZIO);
  const [f, setF] = useState(FILTROS);
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

  const filtrados = useMemo(() => ctes.filter((c) => {
    if (f.dataInicio && (c.data_emissao ?? '') < f.dataInicio) return false;
    if (f.dataFim && (c.data_emissao ?? '') > f.dataFim) return false;
    if (f.numero && !matchesSearch(f.numero, c.numero_documento)) return false;
    if (f.chave && !matchesSearch(f.chave, c.chave_acesso, nfsDasChaves(c.chave_acesso))) return false;
    if (f.emitente && !matchesSearch(f.emitente, c.razao_social_emitente)) return false;
    if (f.cfop && !matchesSearch(f.cfop, c.cfop)) return false;
    if (f.situacao && c.situacao !== f.situacao) return false;
    return true;
  }), [ctes, f]);

  const totalServico = filtrados.reduce((a, c) => a + toNumber(c.valor_total_servico), 0);
  const temFiltro = Object.values(f).some(Boolean);
  const nfsIdentificadas = obterListaNFs(form.chave_acesso.join(','));

  /** CTE → Painel: rateia o valor do CTE entre as NFs e marca o frete como confirmado. */
  async function integrarFrete(cte: Cte, silencioso = false): Promise<number> {
    const nfs = obterListaNFs(cte.chave_acesso);
    if (!nfs.length) return 0;
    const rateado = parseFloat((toNumber(cte.valor_total_servico) / nfs.length).toFixed(2));
    const { data, error } = await supabase.from('entregas')
      .update({ valor_frete_real: rateado, frete_confirmado: true })
      .in('nota_fiscal', variacoesNF(nfs))
      .select('nota_fiscal');
    if (error) { console.error('Erro na integração CTE → Entrega', error); return 0; }
    if (!silencioso) {
      if (data?.length) {
        toast({ kind: 'success', title: 'Integração concluída', duration: 9000,
          text: `NF(s) atualizadas no Painel: ${data.map((d) => d.nota_fiscal).join(', ')}\nFrete real de ${formatMoney(rateado)} aplicado e frete confirmado.` });
      } else {
        toast({ kind: 'warning', title: 'CTE salvo, mas sem NF correspondente', duration: 10000,
          text: `As NFs (${nfs.join(', ')}) não foram encontradas no Painel de Entregas. Lance a NF com o mesmo número para a integração funcionar.` });
      }
    }
    return data?.length ?? 0;
  }

  async function sincronizarHistorico() {
    const ok = await confirm({
      title: 'Sincronização retroativa',
      text: `O sistema vai ler os ${ctes.length} CTEs e copiar o valor rateado para o "Frete real" das NFs correspondentes no Painel.\nNenhum dado do CTE será alterado.`,
      confirmLabel: 'Sincronizar',
    });
    if (!ok) return;
    let total = 0;
    setSync({ atual: 0, total: ctes.length });
    try {
      for (let i = 0; i < ctes.length; i++) {
        total += await integrarFrete(ctes[i], true);
        setSync({ atual: i + 1, total: ctes.length });
      }
      toast({ kind: 'success', title: 'Sincronização concluída', text: `${total} notas fiscais atualizadas no Painel de Entregas.` });
      await registrarLog('EDITOU', 'CTES', `Executou a sincronização retroativa de CTEs (${total} NFs atualizadas no Painel Principal)`);
      recarregarEntregas();
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
      if (salvo) { await integrarFrete(salvo); recarregarEntregas(); }
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
          <div className="card-title">Histórico de CTEs</div>
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
