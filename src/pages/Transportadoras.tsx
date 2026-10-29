import { useMemo, useState, type FormEvent } from 'react';
import { Link2, Mail, Pencil, Phone, Plus, Receipt, Trash2, Truck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { registrarLog, mensagemErro } from '../lib/db';
import { MODAIS } from '../lib/constants';
import { formatCnpj, matchesSearch } from '../lib/format';
import { useAppData } from '../state/context';
import { useFeedback } from '../feedback/context';
import { Badge, Field, PageHeader, SearchInput } from '../components/ui/basics';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal, ModalActions } from '../components/ui/Modal';
import type { Transportadora } from '../types';
import { ModalPortal } from './transportadoras/ModalPortal';
import { ModalTabelaFrete } from './transportadoras/ModalTabelaFrete';

const VAZIO = { nome: '', cnpj_cpf: '', razao_social: '', nome_fantasia: '', modal_padrao: '', telefone: '', email: '' };

export default function Transportadoras() {
  const { transportadoras, entregas, recarregarCadastros, loading } = useAppData();
  const { toast, confirm } = useFeedback();
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<Transportadora | null>(null);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [portal, setPortal] = useState<Transportadora | null>(null);
  const [tabela, setTabela] = useState<Transportadora | null>(null);

  const qtd = useMemo(() => {
    const m: Record<string, number> = {};
    entregas.forEach((e) => { if (e.transportadora_id) m[e.transportadora_id] = (m[e.transportadora_id] ?? 0) + 1; });
    return m;
  }, [entregas]);

  const abrir = (t?: Transportadora) => {
    setEditando(t ?? null);
    setForm(t ? {
      nome: t.nome, cnpj_cpf: t.cnpj_cpf ?? '', razao_social: t.razao_social ?? '', nome_fantasia: t.nome_fantasia ?? '',
      modal_padrao: t.modal_padrao ?? '', telefone: t.telefone ?? '', email: t.email ?? '',
    } : VAZIO);
    setAberto(true);
  };

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const payload = {
      nome: form.nome.toUpperCase(), cnpj_cpf: form.cnpj_cpf, razao_social: form.razao_social.toUpperCase(),
      nome_fantasia: form.nome_fantasia.toUpperCase(), modal_padrao: form.modal_padrao, telefone: form.telefone, email: form.email.toLowerCase(),
    };
    try {
      if (editando) {
        const { error } = await supabase.from('transportadoras').update(payload).eq('id', editando.id);
        if (error) throw error;
        await registrarLog('EDITOU', 'TRANSPORTADORAS', `Editou os dados da Transportadora: ${payload.nome}`);
      } else {
        const { error } = await supabase.from('transportadoras').insert([payload]);
        if (error) throw error;
        await registrarLog('CRIOU', 'TRANSPORTADORAS', `Cadastrou uma nova Transportadora: ${payload.nome}`);
      }
      toast({ kind: 'success', title: editando ? 'Transportadora atualizada' : 'Transportadora cadastrada', text: payload.nome });
      setAberto(false);
      recarregarCadastros();
    } catch (err) {
      toast({ kind: 'error', title: 'Erro ao salvar transportadora', text: mensagemErro(err) });
    } finally { setSalvando(false); }
  }

  async function excluir(t: Transportadora) {
    const ok = await confirm({ title: `Excluir ${t.nome}?`, text: 'Esta ação não pode ser desfeita.', danger: true, confirmLabel: 'Excluir' });
    if (!ok) return;
    const { error } = await supabase.from('transportadoras').delete().eq('id', t.id);
    if (error) {
      toast({
        kind: 'error', title: 'Não foi possível excluir',
        text: error.code === '23503' ? 'Esta transportadora já possui notas fiscais ou metas vinculadas a ela.' : mensagemErro(error),
      });
      return;
    }
    await registrarLog('APAGOU', 'TRANSPORTADORAS', `Excluiu a Transportadora: ${t.nome}`);
    toast({ kind: 'success', title: 'Transportadora excluída' });
    recarregarCadastros();
  }

  const cols: Column<Transportadora>[] = [
    { key: 'nome', header: 'Transportadora', render: (t) => <strong style={{ color: 'var(--text)' }}>{t.nome}</strong>, mobile: 'title', sortValue: (t) => t.nome },
    { key: 'cnpj', header: 'CNPJ', render: (t) => t.cnpj_cpf || '-', mobile: 'subtitle', className: 'num' },
    {
      key: 'contato', header: 'Contato (operacional)',
      render: (t) => (t.telefone || t.email ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.8rem' }}>
          {t.telefone && <a href={`tel:${t.telefone}`} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}><Phone size={13} /> {t.telefone}</a>}
          {t.email && <a href={`mailto:${t.email}`} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}><Mail size={13} /> {t.email}</a>}
        </div>) : '-'),
    },
    { key: 'modal', header: 'Modal padrão', render: (t) => <Badge tone="slate" square>{MODAIS.find((m) => m.value === t.modal_padrao)?.label ?? t.modal_padrao ?? 'Não definido'}</Badge>, mobile: 'badge' },
    { key: 'qtd', header: 'Entregas', render: (t) => `${(qtd[t.id] ?? 0).toLocaleString('pt-BR')} entregas`, sortValue: (t) => qtd[t.id] ?? 0, align: 'right', className: 'num' },
  ];

  return (
    <div className="page">
      <PageHeader icon={<Truck size={22} />} title="Transportadoras" subtitle="Parceiros logísticos e modais operacionais"
        actions={<button className="btn btn-primary" onClick={() => abrir()}><Plus size={16} /> Nova transportadora</button>} />

      <div className="toolbar"><SearchInput className="toolbar__search" value={busca} onChange={setBusca} placeholder="Buscar nome, CNPJ ou e-mail…" /></div>

      <div className="card table-card">
        <DataTable rows={transportadoras.filter((t) => matchesSearch(busca, t.nome, t.cnpj_cpf, t.email, t.razao_social))} columns={cols}
          rowKey={(t) => t.id} loading={loading} onRowClick={abrir}
          actions={(t) => (
            <>
              <button className="icon-btn icon-btn--sm" onClick={() => setPortal(t)} title="Portal da transportadora (link para informar ocorrências)"><Link2 size={16} /></button>
              <button className="icon-btn icon-btn--sm" onClick={() => setTabela(t)} title="Tabela de frete"><Receipt size={16} /></button>
              <button className="icon-btn icon-btn--sm" onClick={() => abrir(t)} title="Editar"><Pencil size={16} /></button>
              <button className="icon-btn icon-btn--sm icon-btn--danger" onClick={() => excluir(t)} title="Excluir"><Trash2 size={16} /></button>
            </>
          )} />
      </div>

      {portal && <ModalPortal t={portal} onClose={() => setPortal(null)} />}
      {tabela && <ModalTabelaFrete t={tabela} onClose={() => setTabela(null)} />}

      {aberto && (
        <Modal title={editando ? 'Editar transportadora' : 'Nova transportadora'} onClose={() => setAberto(false)} onSubmit={salvar}
          footer={<ModalActions onCancel={() => setAberto(false)} submitting={salvando} submitLabel={editando ? 'Atualizar parceiro' : 'Salvar parceiro'} />}>
          <div className="form-grid">
            <Field label="Nome principal (identificação rápida)" required className="span-all"><input className="input" required placeholder="Ex: BRASPRESS" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Field>
            <Field label="CNPJ / CPF"><input className="input" placeholder="00.000.000/0000-00" value={form.cnpj_cpf} onChange={(e) => setForm({ ...form, cnpj_cpf: e.target.value })} onBlur={(e) => setForm((f) => ({ ...f, cnpj_cpf: formatCnpj(e.target.value) }))} /></Field>
            <Field label="Nome fantasia"><input className="input" placeholder="Braspress" value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} /></Field>
            <Field label="Razão social" className="span-all"><input className="input" placeholder="BRASPRESS TRANSPORTES URGENTES LTDA" value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} /></Field>
            <Field label="Telefone / WhatsApp"><input className="input" type="tel" placeholder="(11) 99999-9999" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></Field>
            <Field label="E-mail de contato"><input className="input" type="email" placeholder="contato@transportadora.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Modal padrão de envio" required className="span-all">
              <select className="select" required value={form.modal_padrao} onChange={(e) => setForm({ ...form, modal_padrao: e.target.value })}>
                <option value="">Selecione…</option>
                {MODAIS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
