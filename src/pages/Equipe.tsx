import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { registrarLog, mensagemErro } from '../lib/db';
import { iniciais, matchesSearch } from '../lib/format';
import { useAppData } from '../state/context';
import { useFeedback } from '../feedback/context';
import { Badge, Field, PageHeader, SearchInput } from '../components/ui/basics';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal, ModalActions } from '../components/ui/Modal';
import type { Perfil } from '../types';

const VAZIO = { nome: '', email: '', cargo: '', nivel_acesso: 'Operador' };

export default function Equipe() {
  const { perfis, setPerfis, email: meuEmail } = useAppData();
  const { toast, confirm } = useFeedback();
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<Perfil | null>(null);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);

  const abrir = (p?: Perfil) => {
    setEditando(p ?? null);
    setForm(p ? { nome: p.nome, email: p.email, cargo: p.cargo, nivel_acesso: p.nivel_acesso } : VAZIO);
    setAberto(true);
  };

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const payload = { nome: form.nome.trim(), email: form.email.trim().toLowerCase(), cargo: form.cargo.trim(), nivel_acesso: form.nivel_acesso };
    try {
      if (editando) {
        const { data, error } = await supabase.from('perfis').update(payload).eq('id', editando.id).select('*');
        if (error) throw error;
        if (data?.[0]) setPerfis((l) => l.map((p) => (p.id === editando.id ? data[0] : p)));
        await registrarLog('EDITOU', 'EQUIPE', `Editou o perfil de acesso: ${payload.nome}`);
      } else {
        const { data, error } = await supabase.from('perfis').insert([payload]).select('*');
        if (error) throw error;
        if (data?.[0]) setPerfis((l) => [...l, data[0]].sort((a, b) => a.nome.localeCompare(b.nome)));
        await registrarLog('CRIOU', 'EQUIPE', `Registrou novo membro da equipe: ${payload.nome}`);
      }
      toast({ kind: 'success', title: editando ? 'Perfil atualizado' : 'Funcionário cadastrado' });
      setAberto(false);
    } catch (err) {
      toast({ kind: 'error', title: 'Erro ao salvar perfil', text: mensagemErro(err) });
    } finally { setSalvando(false); }
  }

  async function excluir(p: Perfil) {
    const proprio = p.email?.toLowerCase() === meuEmail.toLowerCase();
    const ok = await confirm({
      title: `Excluir o perfil de ${p.nome}?`, danger: true, confirmLabel: 'Excluir',
      text: proprio ? 'Atenção: este é o SEU perfil. Você pode perder o acesso de administrador.' : 'A pessoa perderá o nível de acesso configurado.',
    });
    if (!ok) return;
    const { error } = await supabase.from('perfis').delete().eq('id', p.id);
    if (error) { toast({ kind: 'error', title: 'Não foi possível excluir', text: mensagemErro(error) }); return; }
    setPerfis((l) => l.filter((x) => x.id !== p.id));
    await registrarLog('APAGOU', 'EQUIPE', `Apagou o perfil de acesso: ${p.nome}`);
    toast({ kind: 'success', title: 'Perfil excluído' });
  }

  const cols: Column<Perfil>[] = [
    {
      key: 'nome', header: 'Nome', mobile: 'title', sortValue: (p) => p.nome,
      render: (p) => (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><span className="avatar" style={{ background: 'var(--brand-soft)', color: 'var(--brand)', border: 0 }}>{iniciais(p.nome)}</span><strong style={{ color: 'var(--text)' }}>{p.nome}</strong></span>),
    },
    { key: 'email', header: 'E-mail (login)', render: (p) => p.email, mobile: 'subtitle', sortValue: (p) => p.email },
    { key: 'cargo', header: 'Cargo', render: (p) => p.cargo || '-', sortValue: (p) => p.cargo },
    { key: 'nivel', header: 'Nível de acesso', render: (p) => <Badge>{p.nivel_acesso}</Badge>, align: 'center', mobile: 'badge', sortValue: (p) => p.nivel_acesso },
  ];

  return (
    <div className="page">
      <PageHeader icon={<Users size={22} />} title="Gestão de Equipe" subtitle="Controle de acessos e perfis operacionais"
        actions={<button className="btn btn-primary" onClick={() => abrir()}><Plus size={16} /> Novo funcionário</button>} />

      <div className="toolbar"><SearchInput className="toolbar__search" value={busca} onChange={setBusca} placeholder="Buscar nome, e-mail ou cargo…" /></div>

      <div className="card table-card">
        <DataTable rows={perfis.filter((p) => matchesSearch(busca, p.nome, p.email, p.cargo))} columns={cols} rowKey={(p) => p.id}
          onRowClick={abrir}
          actions={(p) => (
            <>
              <button className="icon-btn icon-btn--sm" onClick={() => abrir(p)} title="Editar"><Pencil size={16} /></button>
              <button className="icon-btn icon-btn--sm icon-btn--danger" onClick={() => excluir(p)} title="Excluir"><Trash2 size={16} /></button>
            </>
          )} />
      </div>

      {aberto && (
        <Modal size="sm" title={editando ? 'Editar funcionário' : 'Novo funcionário'} onClose={() => setAberto(false)} onSubmit={salvar}
          footer={<ModalActions onCancel={() => setAberto(false)} submitting={salvando} submitLabel="Salvar perfil" />}>
          <div className="form-grid" style={{ ['--cols' as string]: 1 }}>
            <Field label="Nome completo" required><input className="input" required placeholder="Ex: João Silva" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Field>
            <Field label="E-mail" required hint="Deve ser o mesmo e-mail do usuário criado no Supabase (Authentication)."><input type="email" className="input" required placeholder="joao@munila.com.br" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Cargo" required><input className="input" required placeholder="Ex: Analista de Logística" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} /></Field>
            <Field label="Nível de acesso" required>
              <select className="select" value={form.nivel_acesso} onChange={(e) => setForm({ ...form, nivel_acesso: e.target.value })}>
                <option value="Operador">Operador (uso diário)</option>
                <option value="Administrador">Administrador (gestão total)</option>
              </select>
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
