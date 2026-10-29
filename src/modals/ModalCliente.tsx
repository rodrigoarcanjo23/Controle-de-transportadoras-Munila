import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { registrarLog, mensagemErro } from '../lib/db';
import { UFS } from '../lib/constants';
import { formatCnpj } from '../lib/format';
import { useAppData } from '../state/context';
import { useFeedback } from '../feedback/context';
import { Modal, ModalActions } from '../components/ui/Modal';
import { Check, Field } from '../components/ui/basics';
import type { Cliente } from '../types';

export function ModalCliente({ cliente, onClose }: { cliente?: Cliente | null; onClose: () => void }) {
  const { setClientes, clientes } = useAppData();
  const temAvisos = clientes.some((c) => 'recebe_avisos' in c);
  const { toast } = useFeedback();
  const [salvando, setSalvando] = useState(false);
  const [f, setF] = useState({
    nome: cliente?.nome ?? '', cnpj_cpf: cliente?.cnpj_cpf ?? '', razao_social: cliente?.razao_social ?? '',
    nome_fantasia: cliente?.nome_fantasia ?? '', cidade: cliente?.cidade ?? '', uf: cliente?.uf ?? '',
    telefone: cliente?.telefone ?? '', email: cliente?.email ?? '', exige_agendamento: !!cliente?.exige_agendamento,
    recebe_avisos: cliente?.recebe_avisos !== false,
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const payload = {
      nome: f.nome.toUpperCase(), cnpj_cpf: f.cnpj_cpf, razao_social: f.razao_social.toUpperCase(),
      nome_fantasia: f.nome_fantasia.toUpperCase(), cidade: f.cidade.toUpperCase(), uf: f.uf.toUpperCase(),
      telefone: f.telefone, email: f.email.toLowerCase(), exige_agendamento: f.exige_agendamento,
      // só envia a coluna nova quando ela já existe no banco (SQL do rastreio rodado)
      ...(temAvisos ? { recebe_avisos: f.recebe_avisos } : {}),
    };
    try {
      if (cliente) {
        const { data, error } = await supabase.from('clientes').update(payload).eq('id', cliente.id).select('*');
        if (error) throw error;
        if (data?.[0]) setClientes((l) => l.map((c) => (c.id === cliente.id ? data[0] : c)));
        await registrarLog('EDITOU', 'CLIENTES', `Editou os dados do Cliente: ${payload.nome}`);
      } else {
        const { data, error } = await supabase.from('clientes').insert([payload]).select('*');
        if (error) throw error;
        if (data?.[0]) setClientes((l) => [...l, data[0]].sort((a, b) => a.nome.localeCompare(b.nome)));
        await registrarLog('CRIOU', 'CLIENTES', `Registrou um novo Cliente: ${payload.nome}`);
      }
      toast({ kind: 'success', title: cliente ? 'Cliente atualizado' : 'Cliente cadastrado', text: payload.nome });
      onClose();
    } catch (err) {
      toast({ kind: 'error', title: 'Erro ao salvar cliente', text: mensagemErro(err) });
    } finally { setSalvando(false); }
  }

  return (
    <Modal title={cliente ? 'Editar cliente' : 'Novo cliente'} onClose={onClose} onSubmit={salvar}
      footer={<ModalActions onCancel={onClose} submitting={salvando} submitLabel={cliente ? 'Atualizar cliente' : 'Salvar cliente'} />}>
      <div className="form-grid">
        <Field label="Nome principal (identificação no sistema)" required className="span-all">
          <input className="input" required placeholder="Ex: Farmácia São João" value={f.nome} onChange={(e) => set('nome', e.target.value)} />
        </Field>
        <Field label="CNPJ / CPF">
          <input className="input" placeholder="00.000.000/0000-00" value={f.cnpj_cpf} onChange={(e) => set('cnpj_cpf', e.target.value)} onBlur={(e) => set('cnpj_cpf', formatCnpj(e.target.value))} />
        </Field>
        <Field label="Nome fantasia">
          <input className="input" value={f.nome_fantasia} onChange={(e) => set('nome_fantasia', e.target.value)} />
        </Field>
        <Field label="Razão social" className="span-all">
          <input className="input" placeholder="Razão Social LTDA" value={f.razao_social} onChange={(e) => set('razao_social', e.target.value)} />
        </Field>
        <Field label="Cidade">
          <input className="input" placeholder="Ex: Fortaleza" value={f.cidade} onChange={(e) => set('cidade', e.target.value)} />
        </Field>
        <Field label="UF">
          <select className="select" value={f.uf} onChange={(e) => set('uf', e.target.value)}>
            <option value="">Selecione…</option>
            {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </Field>
        <Field label="Telefone / WhatsApp">
          <input className="input" type="tel" placeholder="(00) 00000-0000" value={f.telefone} onChange={(e) => set('telefone', e.target.value)} />
        </Field>
        <Field label="E-mail">
          <input className="input" type="email" placeholder="contato@cliente.com" value={f.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <div className="span-all" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Check id="exige_agendamento" checked={f.exige_agendamento} onChange={(v) => set('exige_agendamento', v)}>
            Este cliente exige agendamento de entrega (marca automaticamente nas novas entregas)
          </Check>
          {temAvisos && (
            <Check id="recebe_avisos" checked={f.recebe_avisos} onChange={(v) => set('recebe_avisos', v)}>
              Enviar e-mails automáticos de pedido coletado e entregue (com link de rastreio e canhoto) para o e-mail acima
            </Check>
          )}
        </div>
      </div>
    </Modal>
  );
}
