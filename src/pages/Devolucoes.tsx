import { useMemo, useRef, useState, type FormEvent } from 'react';
import { CircleAlert, DollarSign, Download, Package, Pencil, Plus, Printer, RefreshCcw, Scale, Trash2, TrendingDown, UploadCloud, Eraser } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { registrarLog, mensagemErro } from '../lib/db';
import { STATUS_DEVOLUCAO } from '../lib/constants';
import { formatDate, formatDecimal, formatInt, formatMoney, maskDecimal, matchesSearch, parseDecimalBR, toInputDecimal, toNumber } from '../lib/format';
import { downloadCsv, csvNum } from '../lib/csv';
import { lerArquivoTexto, parseNfeDevolucaoXml } from '../lib/xml';
import { useAppData } from '../state/context';
import { useFeedback } from '../feedback/context';
import { FilterCard, Field, KpiCard, PageHeader, SearchInput, StatusBadge } from '../components/ui/basics';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal, ModalActions } from '../components/ui/Modal';
import { ClienteCombobox } from '../components/ui/ClienteCombobox';
import type { Devolucao } from '../types';

const VAZIO = {
  data_emissao: '', data_coleta: '', data_previsao: '', data_chegada: '', cliente_id: '', transportadora_cliente: '',
  nf_venda: '', notas_fiscais: '', valor_total_nf: '', volume: '', peso_kg: '', valor_frete_reverso: '', motivo: '', status: 'Pendente',
};
const FINALIZADOS = ['Chegou no Galpão', 'Entregue', 'Recusa'];

export default function Devolucoes() {
  const { devolucoes, clientes, recarregarDevolucoes, loading } = useAppData();
  const { toast, confirm } = useFeedback();
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Devolucao | null>(null);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const xmlRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof VAZIO, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const filtradas = useMemo(() => devolucoes.filter((d) =>
    matchesSearch(busca, d.nf_venda, d.notas_fiscais, d.clientes?.nome, d.clientes?.cnpj_cpf, d.transportadora_cliente)
    && (!status || d.status === status)
    && (!dataInicio || (d.data_emissao ?? '') >= dataInicio)
    && (!dataFim || (d.data_emissao ?? '') <= dataFim)), [devolucoes, busca, status, dataInicio, dataFim]);

  const k = useMemo(() => {
    let valor = 0, custo = 0, vol = 0, peso = 0;
    filtradas.forEach((d) => { valor += toNumber(d.valor_total_nf); custo += toNumber(d.valor_frete_reverso); vol += toNumber(d.volume); peso += toNumber(d.peso_kg); });
    return { valor, custo, vol, peso, naRua: filtradas.filter((d) => !FINALIZADOS.includes(d.status)).length };
  }, [filtradas]);

  const temFiltro = busca || status || dataInicio || dataFim;

  function abrir(d?: Devolucao) {
    setEditando(d ?? null);
    setForm(d ? {
      data_emissao: d.data_emissao ?? '', data_coleta: d.data_coleta ?? '', data_previsao: d.data_previsao ?? '', data_chegada: d.data_chegada ?? '',
      cliente_id: d.cliente_id, transportadora_cliente: d.transportadora_cliente ?? '', nf_venda: d.nf_venda ?? '', notas_fiscais: d.notas_fiscais ?? '',
      valor_total_nf: toInputDecimal(d.valor_total_nf), volume: d.volume?.toString() ?? '', peso_kg: toInputDecimal(d.peso_kg),
      valor_frete_reverso: toInputDecimal(d.valor_frete_reverso), motivo: d.motivo ?? '', status: d.status ?? 'Pendente',
    } : VAZIO);
    setAberto(true);
  }

  async function lerXml(file: File) {
    try {
      const x = parseNfeDevolucaoXml(await lerArquivoTexto(file), clientes);
      setForm((p) => ({
        ...p,
        data_emissao: x.data_emissao || p.data_emissao, notas_fiscais: x.notas_fiscais || p.notas_fiscais, nf_venda: x.nf_venda || p.nf_venda,
        valor_total_nf: x.valor_total_nf ? toInputDecimal(x.valor_total_nf) : p.valor_total_nf, volume: x.volume || p.volume,
        peso_kg: x.peso_kg ? toInputDecimal(x.peso_kg) : p.peso_kg, motivo: x.motivo || p.motivo, cliente_id: x.cliente?.id ?? p.cliente_id,
      }));
      if (x.cliente) toast({ kind: 'success', title: 'XML processado', text: `NF devolução: ${x.notas_fiscais}\nCliente vinculado: ${x.cliente.nome}` });
      else toast({ kind: 'warning', title: 'XML processado — selecione o cliente', text: `O CNPJ do emitente (${x.cnpj_emitente || '—'}) não está cadastrado. Escolha o cliente manualmente.` });
      registrarLog('CRIOU', 'DEVOLUCOES', `Fez a leitura de um XML para autofill da NF de Devolução: ${x.notas_fiscais}`);
    } catch {
      toast({ kind: 'error', title: 'Erro ao ler o XML', text: 'Certifique-se de que é um XML válido de NF-e.' });
    } finally {
      if (xmlRef.current) xmlRef.current.value = '';
    }
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!form.cliente_id) { toast({ kind: 'warning', title: 'Selecione um cliente válido na lista.' }); return; }
    setSalvando(true);
    const payload = {
      data_emissao: form.data_emissao || null, data_coleta: form.data_coleta || null, data_previsao: form.data_previsao || null, data_chegada: form.data_chegada || null,
      cliente_id: form.cliente_id, transportadora_cliente: form.transportadora_cliente ? form.transportadora_cliente.toUpperCase() : null, transportadora_id: null,
      nf_venda: form.nf_venda || null, notas_fiscais: form.notas_fiscais, valor_total_nf: parseDecimalBR(form.valor_total_nf) ?? 0,
      volume: parseInt(form.volume) || null, peso_kg: parseDecimalBR(form.peso_kg) || null, valor_frete_reverso: parseDecimalBR(form.valor_frete_reverso) ?? 0,
      motivo: form.motivo, status: form.status,
    };
    try {
      if (editando) {
        const { error } = await supabase.from('devolucoes').update(payload).eq('id', editando.id);
        if (error) throw error;
        await registrarLog('EDITOU', 'DEVOLUCOES', `Editou a Logística Reversa (NFs Referência: ${payload.notas_fiscais})`);
      } else {
        const { error } = await supabase.from('devolucoes').insert([payload]);
        if (error) throw error;
        await registrarLog('CRIOU', 'DEVOLUCOES', `Registrou nova Logística Reversa (NFs Referência: ${payload.notas_fiscais})`);
      }
      toast({ kind: 'success', title: editando ? 'Devolução atualizada' : 'Devolução registrada' });
      setAberto(false);
      recarregarDevolucoes();
    } catch (err) {
      toast({ kind: 'error', title: 'Erro ao salvar a logística reversa', text: mensagemErro(err) });
    } finally { setSalvando(false); }
  }

  async function excluir(d: Devolucao) {
    const ok = await confirm({ title: 'Excluir este registro de devolução?', text: `NFs: ${d.notas_fiscais}`, danger: true, confirmLabel: 'Excluir' });
    if (!ok) return;
    const { error } = await supabase.from('devolucoes').delete().eq('id', d.id);
    if (error) { toast({ kind: 'error', title: 'Erro ao excluir a devolução', text: mensagemErro(error) }); return; }
    await registrarLog('APAGOU', 'DEVOLUCOES', `Excluiu o registo de Devolução (NFs Referência: ${d.notas_fiscais})`);
    toast({ kind: 'success', title: 'Devolução excluída' });
    recarregarDevolucoes();
  }

  function exportar() {
    if (!filtradas.length) { toast({ kind: 'warning', title: 'Não há dados para exportar com estes filtros.' }); return; }
    downloadCsv('MunilaLog_Devolucoes',
      ['Dt Emissão', 'Dt Coleta', 'Cliente', 'Transportadora', 'NF Venda', 'NFs (Devolução)', 'Valor NFs (R$)', 'Volume', 'Peso (Kg)', 'Custo Reverso (R$)', 'Dt Previsão', 'Dt Chegada', 'Status', 'Motivo/Avaria'],
      filtradas.map((d) => [formatDate(d.data_emissao), formatDate(d.data_coleta), d.clientes?.nome || '-', d.transportadora_cliente || d.transportadoras?.nome || '-',
        d.nf_venda || '-', d.notas_fiscais, csvNum(d.valor_total_nf), d.volume ?? '-', csvNum(d.peso_kg, '-'), csvNum(d.valor_frete_reverso),
        formatDate(d.data_previsao), formatDate(d.data_chegada), d.status, d.motivo || '-']));
  }

  const cols: Column<Devolucao>[] = [
    { key: 'nfs', header: 'NFs (devolução)', render: (d) => <strong style={{ color: 'var(--text)' }}>{d.notas_fiscais}</strong>, mobile: 'title', sortValue: (d) => d.notas_fiscais },
    { key: 'cliente', header: 'Cliente', render: (d) => d.clientes?.nome || '-', className: 'strong', mobile: 'subtitle', sortValue: (d) => d.clientes?.nome },
    { key: 'emissao', header: 'Dt emissão', render: (d) => formatDate(d.data_emissao), sortValue: (d) => d.data_emissao },
    { key: 'coleta', header: 'Dt coleta', render: (d) => formatDate(d.data_coleta), sortValue: (d) => d.data_coleta },
    { key: 'transp', header: 'Transportadora', render: (d) => d.transportadora_cliente || d.transportadoras?.nome || '-' },
    { key: 'nfVenda', header: 'NF venda', render: (d) => <span className="strong text-brand">{d.nf_venda || '-'}</span> },
    { key: 'valor', header: 'Valor NFs', render: (d) => formatMoney(d.valor_total_nf), align: 'right', className: 'num', sortValue: (d) => toNumber(d.valor_total_nf) },
    { key: 'vol', header: 'Volume', render: (d) => (d.volume ? `${d.volume} cx` : '-'), align: 'right', className: 'num', mobile: 'hide' },
    { key: 'peso', header: 'Peso (kg)', render: (d) => (d.peso_kg ? `${formatDecimal(d.peso_kg)} kg` : '-'), align: 'right', className: 'num', mobile: 'hide' },
    { key: 'custo', header: 'Custo reverso', render: (d) => formatMoney(d.valor_frete_reverso), align: 'right', className: 'num strong text-red', sortValue: (d) => toNumber(d.valor_frete_reverso) },
    { key: 'prev', header: 'Dt previsão', render: (d) => formatDate(d.data_previsao), sortValue: (d) => d.data_previsao },
    { key: 'cheg', header: 'Dt chegada', render: (d) => formatDate(d.data_chegada), sortValue: (d) => d.data_chegada },
    { key: 'status', header: 'Status', render: (d) => <StatusBadge status={d.status} />, mobile: 'badge', sortValue: (d) => d.status },
    { key: 'motivo', header: 'Motivo', render: (d) => <span title={d.motivo ?? ''}>{d.motivo || '-'}</span>, className: 'ellipsis muted', mobile: 'full' },
  ];

  return (
    <div className="page">
      <PageHeader icon={<RefreshCcw size={22} />} title="Logística Reversa" subtitle="Devoluções, coletas e custos de frete reverso"
        actions={
          <>
            <button className="btn hide-mobile" onClick={() => window.print()}><Printer size={16} /> PDF</button>
            <button className="btn btn-success-outline" onClick={exportar}><Download size={16} /> Excel</button>
            <button className="btn btn-primary" onClick={() => abrir()}><Plus size={16} /> Nova devolução</button>
          </>
        } />

      <FilterCard ativos={[busca, status, dataInicio, dataFim].filter(Boolean).length}>
          <Field label="Emissão — de"><input type="date" className="input" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} /></Field>
          <Field label="Emissão — até"><input type="date" className="input" value={dataFim} onChange={(e) => setDataFim(e.target.value)} /></Field>
          <Field label="Status">
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos os status</option>
              {STATUS_DEVOLUCAO.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Buscar" className="span-2"><SearchInput value={busca} onChange={setBusca} placeholder="NF, cliente, CNPJ ou transportadora…" /></Field>
          {temFiltro && <button className="btn btn-danger-outline" onClick={() => { setBusca(''); setStatus(''); setDataInicio(''); setDataFim(''); }}><Eraser size={16} /> Limpar</button>}
      </FilterCard>

      <div className="kpi-grid">
        <KpiCard label="Total devoluções" value={formatInt(filtradas.length)} unit=" registros" icon={<RefreshCcw size={16} />} tone="blue" />
        <KpiCard label="Valor retornando" value={formatMoney(k.valor)} icon={<DollarSign size={16} />} tone="green" />
        <KpiCard label="Custo frete reverso" value={formatMoney(k.custo)} valueClass="text-red" icon={<TrendingDown size={16} />} tone="red" />
        <KpiCard label="Volume retornando" value={formatInt(k.vol)} unit=" cx" icon={<Package size={16} />} tone="purple" />
        <KpiCard label="Peso retornando" value={formatDecimal(k.peso)} unit=" kg" icon={<Scale size={16} />} tone="amber" />
        <KpiCard label="Aguardando chegada" value={k.naRua} unit=" NFs na rua" valueClass="text-orange" icon={<CircleAlert size={16} />} tone="orange" />
      </div>

      <div className="card table-card">
        <DataTable rows={filtradas} columns={cols} rowKey={(d) => d.id} loading={loading} fill minWidth={1500} onRowClick={abrir}
          actions={(d) => (
            <>
              <button className="icon-btn icon-btn--sm" onClick={() => abrir(d)} title="Editar"><Pencil size={16} /></button>
              <button className="icon-btn icon-btn--sm icon-btn--danger" onClick={() => excluir(d)} title="Excluir"><Trash2 size={16} /></button>
            </>
          )} />
      </div>

      {aberto && (
        <Modal size="lg" title={editando ? 'Editar logística reversa' : 'Registrar logística reversa'} onClose={() => setAberto(false)} onSubmit={salvar}
          banner={
            <>
              <div>
                <strong style={{ fontSize: '0.9rem' }}>Preenchimento inteligente</strong>
                <div className="muted" style={{ fontSize: '0.78rem' }}>Envie o XML da NF de devolução para preencher os campos.</div>
              </div>
              <input type="file" accept=".xml,text/xml" ref={xmlRef} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) lerXml(f); }} />
              <button type="button" className="btn" onClick={() => xmlRef.current?.click()}><UploadCloud size={16} /> Ler XML</button>
            </>
          }
          footer={<ModalActions onCancel={() => setAberto(false)} submitting={salvando} submitLabel={editando ? 'Atualizar reversa' : 'Salvar reversa'} />}>
          <div className="form-grid" style={{ ['--cols' as string]: 3 }}>
            <Field label="Cliente" required className="span-2">
              <ClienteCombobox clientes={clientes} value={form.cliente_id} required onSelect={(c) => set('cliente_id', c?.id ?? '')} />
            </Field>
            <Field label="Status">
              <select className="select" value={form.status} onChange={(e) => set('status', e.target.value)}>
                {STATUS_DEVOLUCAO.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="NFs de referência (devolução)" required><input className="input" required placeholder="Ex: 12661, 13196" value={form.notas_fiscais} onChange={(e) => set('notas_fiscais', e.target.value)} /></Field>
            <Field label="NF de venda (origem)"><input className="input" placeholder="Ex: 12500" value={form.nf_venda} onChange={(e) => set('nf_venda', e.target.value)} /></Field>
            <Field label="Transportadora (texto livre)"><input className="input" placeholder="Ex: Correios, Loggi…" value={form.transportadora_cliente} onChange={(e) => set('transportadora_cliente', e.target.value)} /></Field>

            <div className="form-section-title">Datas</div>
            <Field label="Emissão (NF devolução)"><input type="date" className="input" value={form.data_emissao} onChange={(e) => set('data_emissao', e.target.value)} /></Field>
            <Field label="Coleta (reversa)"><input type="date" className="input" value={form.data_coleta} onChange={(e) => set('data_coleta', e.target.value)} /></Field>
            <Field label="Previsão"><input type="date" className="input" value={form.data_previsao} onChange={(e) => set('data_previsao', e.target.value)} /></Field>
            <Field label="Chegada (galpão)"><input type="date" className="input" value={form.data_chegada} onChange={(e) => set('data_chegada', e.target.value)} /></Field>

            <div className="form-section-title">Valores e carga</div>
            <Field label="Valor total das NFs (R$)"><input className="input num" inputMode="decimal" placeholder="0,00" value={form.valor_total_nf} onChange={(e) => set('valor_total_nf', maskDecimal(e.target.value))} /></Field>
            <Field label="Custo do frete reverso (R$)" hint="Valor que a Munila vai pagar"><input className="input num" inputMode="decimal" placeholder="0,00" value={form.valor_frete_reverso} onChange={(e) => set('valor_frete_reverso', maskDecimal(e.target.value))} /></Field>
            <Field label="Volume (cx)"><input type="number" min="0" className="input num" placeholder="Ex: 2" value={form.volume} onChange={(e) => set('volume', e.target.value)} /></Field>
            <Field label="Peso (kg)"><input className="input num" inputMode="decimal" placeholder="Ex: 1,5" value={form.peso_kg} onChange={(e) => set('peso_kg', maskDecimal(e.target.value))} /></Field>

            <Field label="Motivo da devolução / avaria" className="span-all">
              <textarea className="textarea" rows={3} placeholder="Ex: validade curta, caixa rasgada, cliente recusou…" value={form.motivo} onChange={(e) => set('motivo', e.target.value)} />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
