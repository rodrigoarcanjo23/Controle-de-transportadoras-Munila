import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Edit, Trash2, Phone, Mail, X } from 'lucide-react';

interface TransportadorasProps {
  transportadoras: any[];
  entregas: any[];
  onUpdate: () => void;
}

export function Transportadoras({ transportadoras, entregas, onUpdate }: TransportadorasProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: '', cnpj_cpf: '', razao_social: '', nome_fantasia: '', modal_padrao: '', telefone: '', email: ''
  });

  function abrirModalNova() {
    setEditingId(null);
    setFormData({ nome: '', cnpj_cpf: '', razao_social: '', nome_fantasia: '', modal_padrao: '', telefone: '', email: '' });
    setIsModalOpen(true);
  }

  function abrirModalEdicao(transp: any) {
    setEditingId(transp.id);
    setFormData({
      nome: transp.nome, cnpj_cpf: transp.cnpj_cpf || '', razao_social: transp.razao_social || '', 
      nome_fantasia: transp.nome_fantasia || '', modal_padrao: transp.modal_padrao || '', 
      telefone: transp.telefone || '', email: transp.email || ''
    });
    setIsModalOpen(true);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Tem certeza que deseja excluir esta transportadora?")) return;
    try {
      const { error } = await supabase.from('transportadoras').delete().eq('id', id);
      if (error) {
        if (error.code === '23503') alert("Não é possível excluir! Esta transportadora já possui notas fiscais ou metas vinculadas a ela.");
        else throw error;
      } else {
        onUpdate(); // Atualiza a lista global puxando do banco novamente
      }
    } catch (error) { console.error(error); alert("Erro ao excluir transportadora."); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { 
      nome: formData.nome.toUpperCase(), cnpj_cpf: formData.cnpj_cpf, razao_social: formData.razao_social.toUpperCase(), 
      nome_fantasia: formData.nome_fantasia.toUpperCase(), modal_padrao: formData.modal_padrao, telefone: formData.telefone, 
      email: formData.email.toLowerCase() 
    };
    try {
      if (editingId) {
        const { error } = await supabase.from('transportadoras').update([payload]).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('transportadoras').insert([payload]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      onUpdate(); // Atualiza a lista global puxando do banco novamente
    } catch (error) { console.error(error); alert("Erro ao salvar transportadora."); }
  }

  return (
    <>
      <header className="header">
        <div><h2>Gestão de Transportadoras</h2><p>Cadastro de parceiros logísticos e modais operacionais</p></div>
        <button className="btn-primary" onClick={abrirModalNova}>+ Nova Transportadora</button>
      </header>
      
      <div className="table-container" style={{ maxWidth: '1000px' }}>
        <table>
          <thead><tr><th>Nome da Transportadora</th><th>Contato (Operacional)</th><th>Modal Padrão</th><th>Entregas Realizadas</th><th style={{ textAlign: 'center' }}>Ações</th></tr></thead>
          <tbody>
            {transportadoras.map((transp) => {
              const qtdEntregas = entregas.filter(e => e.transportadora_id === transp.id).length;
              return (
                <tr key={transp.id}>
                  <td style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{transp.nome}</td>
                  <td>
                    {transp.telefone && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}><Phone size={14} /> {transp.telefone}</div>}
                    {transp.email && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}><Mail size={14} /> {transp.email}</div>}
                    {(!transp.telefone && !transp.email) && <span style={{ color: '#cbd5e1' }}>-</span>}
                  </td>
                  <td><span className="status-badge" style={{ backgroundColor: '#f1f5f9' }}>{transp.modal_padrao || 'Não definido'}</span></td>
                  <td>{qtdEntregas} entregas</td>
                  <td style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    <button onClick={() => abrirModalEdicao(transp)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }} title="Editar Transportadora"><Edit size={18} /></button>
                    <button onClick={() => handleDelete(transp.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }} title="Excluir Transportadora"><Trash2 size={18} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <div className="modal-header"><h3>{editingId ? 'Editar Transportadora' : 'Cadastrar Nova Transportadora'}</h3><button className="close-btn" onClick={() => setIsModalOpen(false)}><X size={24} /></button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Nome Principal (Identificação rápida no sistema)</label><input type="text" className="form-input" placeholder="Ex: BRASPRESS" required value={formData.nome} onChange={(e) => setFormData({...formData, nome: e.target.value})} /></div>
                <div className="form-group"><label>CNPJ / CPF</label><input type="text" className="form-input" placeholder="00.000.000/0000-00" value={formData.cnpj_cpf} onChange={(e) => setFormData({...formData, cnpj_cpf: e.target.value})} /></div>
                <div className="form-group"><label>Nome Fantasia</label><input type="text" className="form-input" placeholder="Braspress" value={formData.nome_fantasia} onChange={(e) => setFormData({...formData, nome_fantasia: e.target.value})} /></div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Razão Social</label><input type="text" className="form-input" placeholder="BRASPRESS TRANSPORTES URGENTES LTDA" value={formData.razao_social} onChange={(e) => setFormData({...formData, razao_social: e.target.value})} /></div>
                <div className="form-group"><label>Telefone / WhatsApp Comercial</label><input type="text" className="form-input" placeholder="Ex: (11) 99999-9999" value={formData.telefone} onChange={(e) => setFormData({...formData, telefone: e.target.value})} /></div>
                <div className="form-group"><label>E-mail de Contato</label><input type="email" className="form-input" placeholder="contato@transportadora.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} /></div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Modal Padrão de Envio</label><select className="form-select" required value={formData.modal_padrao} onChange={(e) => setFormData({...formData, modal_padrao: e.target.value})}><option value="">Selecione...</option><option value="AÉREO">Aéreo</option><option value="RODOVIÁRIO">Rodoviário</option><option value="PAC">PAC</option><option value="SEDEX">Sedex</option></select></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button><button type="submit" className="btn-primary">{editingId ? 'Atualizar Parceiro' : 'Salvar Parceiro'}</button></div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}