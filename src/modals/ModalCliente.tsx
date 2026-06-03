import React from 'react';
import { X } from 'lucide-react';

interface ModalClienteProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: any;
  setFormData: (data: any) => void;
  isEditing: boolean;
}

export function ModalCliente({ isOpen, onClose, onSubmit, formData, setFormData, isEditing }: ModalClienteProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '700px' }}>
        <div className="modal-header">
          <h3>{isEditing ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}</h3>
          <button type="button" className="close-btn" onClick={onClose}><X size={24} /></button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Nome Principal (Identificação rápida no sistema)</label>
              <input type="text" className="form-input" placeholder="Ex: DROGA RAIA" required value={formData.nome} onChange={(e) => setFormData({...formData, nome: e.target.value})} />
            </div>

            <div className="form-group">
              <label>CNPJ / CPF</label>
              <input type="text" className="form-input" placeholder="00.000.000/0000-00" value={formData.cnpj_cpf} onChange={(e) => setFormData({...formData, cnpj_cpf: e.target.value})} />
            </div>
            
            <div className="form-group">
              <label>Nome Fantasia</label>
              <input type="text" className="form-input" placeholder="Raia Drogasil" value={formData.nome_fantasia} onChange={(e) => setFormData({...formData, nome_fantasia: e.target.value})} />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Razão Social</label>
              <input type="text" className="form-input" placeholder="RAIA DROGASIL S/A" value={formData.razao_social} onChange={(e) => setFormData({...formData, razao_social: e.target.value})} />
            </div>
            
            <div className="form-group">
              <label>Telefone / WhatsApp Comercial</label>
              <input type="text" className="form-input" placeholder="Ex: (11) 99999-9999" value={formData.telefone} onChange={(e) => setFormData({...formData, telefone: e.target.value})} />
            </div>
            <div className="form-group">
              <label>E-mail de Contato</label>
              <input type="email" className="form-input" placeholder="comprador@cliente.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
            </div>

            <div className="form-group">
              <label>Cidade</label>
              <input type="text" className="form-input" placeholder="Ex: SÃO PAULO" required value={formData.cidade} onChange={(e) => setFormData({...formData, cidade: e.target.value})} />
            </div>
            <div className="form-group">
              <label>UF</label>
              <input type="text" className="form-input" placeholder="Ex: SP" maxLength={2} required value={formData.uf} onChange={(e) => setFormData({...formData, uf: e.target.value})} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary">{isEditing ? 'Atualizar Cliente' : 'Salvar Cliente'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}