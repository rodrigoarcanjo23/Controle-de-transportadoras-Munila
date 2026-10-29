import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { Mail, Pencil, Phone, Plus, Target, Trash2, Upload, UserSquare2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { registrarLog, mensagemErro, SELECT_META } from '../lib/db';
import { matchesSearch } from '../lib/format';
import { splitCsvLine } from '../lib/csv';
import { lerArquivoTexto } from '../lib/xml';
import { useAppData } from '../state/context';
import { useFeedback } from '../feedback/context';
import { Badge, Field, PageHeader, SearchInput } from '../components/ui/basics';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal, ModalActions } from '../components/ui/Modal';
import { ModalCliente } from '../modals/ModalCliente';
import type { Cliente } from '../types';

export default function Clientes() {
  const { clientes, setClientes, metas, setMetas, transportadoras, recarregarCadastros, loading } = useAppData();
  const { toast, confirm } = useFeedback();
  const [busca, setBusca] = useState('');
  // aberto pela busca global: já filtra pelo cliente
  const location = useLocation();
  useEffect(() => {
    const b = (location.state as { busca?: string } | null)?.busca;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (b) setBusca(b);
  }, [location.key, location.state]);
  const [modalCliente, setModalCliente] = useState<{ cliente?: Cliente } | null>(null);
  const [modalMeta, setModalMeta] = useState(false);
  const [meta, setMeta] = useState({ cliente_id: '', transportadora_id: '', meta_percentual: '' });
  const [salvandoMeta, setSalvandoMeta] = useState(false);
  const [importando, setImportando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtrados = clientes.filter((c) => matchesSearch(busca, c.nome, c.cnpj_cpf, c.razao_social, c.cidade));

  async function excluir(c: Cliente) {
    const ok = await confirm({ title: `Excluir o cliente ${c.nome}?`, text: 'Esta ação não pode ser desfeita.', danger: true, confirmLabel: 'Excluir' });
    if (!ok) return;
    const { error } = await supabase.from('clientes').delete().eq('id', c.id);
    if (error) { toast({ kind: 'error', title: 'Não foi possível excluir', text: mensagemErro(error) }); return; }
    setClientes((l) => l.filter((x) => x.id !== c.id));
    await registrarLog('APAGOU', 'CLIENTES', `Apagou o Cliente: ${c.nome}`);
    toast({ kind: 'success', title: 'Cliente excluído' });
  }

  async function salvarMeta(e: FormEvent) {
    e.preventDefault();
    setSalvandoMeta(true);
    try {
      const { data, error } = await supabase.from('metas_frete')
        .insert([{ cliente_id: meta.cliente_id, transportadora_id: meta.transportadora_id, meta_percentual: parseFloat(meta.meta_percentual.replace(',', '.')) }])
        .select(SELECT_META);
      if (error) throw error;
      if (data?.[0]) setMetas((l) => [...l, data[0]]);
      await registrarLog('CRIOU', 'CLIENTES', `Criou nova meta de frete de ${meta.meta_percentual}%`);
      toast({ kind: 'success', title: 'Meta cadastrada' });
      setModalMeta(false);
    } catch (err) {
      toast({ kind: 'error', title: 'Erro ao cadastrar meta', text: mensagemErro(err) });
    } finally { setSalvandoMeta(false); }
  }

  async function importarCsv(file: File) {
    setImportando(true);
    try {
      const texto = await lerArquivoTexto(file);
      const linhas = texto.split(/\r?\n/);
      const sep: ',' | ';' = (linhas[0]?.split(';').length ?? 0) > (linhas[0]?.split(',').length ?? 0) ? ';' : ',';
      const payloads = linhas.slice(1).map((l) => l.trim()).filter(Boolean).map((l) => {
        const [nome, cnpj = '', razao = '', fantasia = '', cidade = '', uf = '', tel = '', email = ''] = splitCsvLine(l, sep);
        return nome ? {
          nome: nome.toUpperCase(), cnpj_cpf: cnpj, razao_social: razao.toUpperCase(), nome_fantasia: fantasia.toUpperCase(),
          cidade: cidade ? cidade.toUpperCase() : null, uf: uf ? uf.toUpperCase() : null, telefone: tel || null, email: email ? email.toLowerCase() : null,
        } : null;
      }).filter((x): x is NonNullable<typeof x> => x !== null);

      if (!payloads.length) { toast({ kind: 'warning', title: 'Nenhum cliente válido encontrado na planilha.' }); return; }
      const ok = await confirm({ title: `Importar ${payloads.length} clientes?`, text: 'Colunas esperadas: Nome, CNPJ, Razão social, Nome fantasia, Cidade, UF, Telefone, E-mail (a 1ª linha é o cabeçalho).', confirmLabel: 'Importar' });
      if (!ok) return;
      const { error } = await supabase.from('clientes').insert(payloads);
      if (error) throw error;
      toast({ kind: 'success', title: 'Importação concluída', text: `${payloads.length} clientes foram importados.` });
      await recarregarCadastros();
    } catch (err) {
      toast({ kind: 'error', title: 'Erro ao importar CSV', text: mensagemErro(err, 'Verifique a formatação do arquivo.') });
    } finally {
      setImportando(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const cols: Column<Cliente>[] = [
    {
      key: 'nome', header: 'Nome / razão social', mobile: 'title', sortValue: (c) => c.nome,
      render: (c) => <div><div className="strong" style={{ color: 'var(--text)' }}>{c.nome}</div>{c.razao_social && <div className="muted" style={{ fontSize: '0.75rem' }}>{c.razao_social}</div>}</div>,
    },
    { key: 'cnpj', header: 'CNPJ / CPF', render: (c) => c.cnpj_cpf || '-', mobile: 'subtitle', className: 'num' },
    { key: 'local', header: 'Localização', render: (c) => (c.cidade ? `${c.cidade} - ${c.uf ?? ''}` : '-'), sortValue: (c) => c.cidade },
    {
      key: 'contato', header: 'Contato',
      render: (c) => (c.telefone || c.email ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.8rem' }}>
          {c.telefone && <a href={`tel:${c.telefone}`} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}><Phone size={13} /> {c.telefone}</a>}
          {c.email && <a href={`mailto:${c.email}`} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}><Mail size={13} /> {c.email}</a>}
        </div>) : '-'),
    },
    { key: 'agend', header: 'Agendamento', render: (c) => (c.exige_agendamento ? <Badge tone="purple" square>Exige</Badge> : <span className="muted">—</span>), align: 'center' },
    {
      key: 'metas', header: 'Metas ativas', mobile: 'full', className: 'wrap',
      render: (c) => {
        const ms = metas.filter((m) => m.cliente_id === c.id);
        return ms.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{ms.map((m) => <Badge key={m.id} tone="blue" square>{m.transportadoras?.nome}: {m.meta_percentual}%</Badge>)}</div> : <span className="muted">Nenhuma meta</span>;
      },
    },
  ];

  return (
    <div className="page">
      <PageHeader icon={<UserSquare2 size={22} />} title="Clientes e Metas" subtitle={`Carteira de clientes e teto de frete autorizado · ${clientes.length} clientes`}
        actions={
          <>
            <input type="file" accept=".csv,text/csv" ref={fileRef} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importarCsv(f); }} />
            <button className="btn" onClick={() => fileRef.current?.click()} disabled={importando}><Upload size={16} /> {importando ? 'Importando…' : 'Importar CSV'}</button>
            <button className="btn" onClick={() => { setMeta({ cliente_id: '', transportadora_id: '', meta_percentual: '' }); setModalMeta(true); }}><Target size={16} /> Nova meta</button>
            <button className="btn btn-primary" onClick={() => setModalCliente({})}><Plus size={16} /> Novo cliente</button>
          </>
        } />

      <div className="toolbar"><SearchInput className="toolbar__search" value={busca} onChange={setBusca} placeholder="Buscar por nome, CNPJ, razão social ou cidade…" /></div>

      <div className="card table-card">
        <DataTable rows={filtrados} columns={cols} rowKey={(c) => c.id} loading={loading} fill onRowClick={(c) => setModalCliente({ cliente: c })}
          actions={(c) => (
            <>
              <button className="icon-btn icon-btn--sm" onClick={() => setModalCliente({ cliente: c })} title="Editar"><Pencil size={16} /></button>
              <button className="icon-btn icon-btn--sm icon-btn--danger" onClick={() => excluir(c)} title="Excluir"><Trash2 size={16} /></button>
            </>
          )} />
      </div>

      {modalCliente && <ModalCliente cliente={modalCliente.cliente} onClose={() => setModalCliente(null)} />}

      {modalMeta && (
        <Modal size="sm" title="Nova meta de frete" subtitle="Percentual máximo de frete autorizado por cliente e transportadora" onClose={() => setModalMeta(false)} onSubmit={salvarMeta}
          footer={<ModalActions onCancel={() => setModalMeta(false)} submitting={salvandoMeta} submitLabel="Salvar meta" />}>
          <div className="form-grid" style={{ ['--cols' as string]: 1 }}>
            <Field label="Cliente" required>
              <select className="select" required value={meta.cliente_id} onChange={(e) => setMeta({ ...meta, cliente_id: e.target.value })}>
                <option value="">Selecione o cliente…</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Field>
            <Field label="Transportadora" required>
              <select className="select" required value={meta.transportadora_id} onChange={(e) => setMeta({ ...meta, transportadora_id: e.target.value })}>
                <option value="">Selecione a transportadora…</option>
                {transportadoras.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </Field>
            <Field label="Meta de frete autorizada (%)" required>
              <input className="input num" required inputMode="decimal" placeholder="Ex: 5,50" value={meta.meta_percentual} onChange={(e) => setMeta({ ...meta, meta_percentual: e.target.value.replace(/[^\d.,]/g, '') })} />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
