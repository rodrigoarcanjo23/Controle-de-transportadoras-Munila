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

  const estadosBR = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h3>{isEditing ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}</h3>
          <button type="button" className="close-btn" onClick={onClose}><X size={24} /></button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Nome Principal (Identificação no sistema)</label>
              <input type="text" className="form-input" placeholder="Ex: Farmácia São João" required value={formData.nome} onChange={(e) => setFormData({...formData, nome: e.target.value})} />
            </div>
            <div className="form-group">
              <label>CNPJ / CPF</label>
              <input type="text" className="form-input" placeholder="00.000.000/0000-00" value={formData.cnpj_cpf} onChange={(e) => setFormData({...formData, cnpj_cpf: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Razão Social</label>
              <input type="text" className="form-input" placeholder="Razão Social LTDA" value={formData.razao_social} onChange={(e) => setFormData({...formData, razao_social: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Nome Fantasia</label>
              <input type="text" className="form-input" placeholder="Nome Fantasia" value={formData.nome_fantasia} onChange={(e) => setFormData({...formData, nome_fantasia: e.target.value})} />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Cidade (Opcional)</label>
                <input type="text" className="form-input" placeholder="Ex: Fortaleza" value={formData.cidade} onChange={(e) => setFormData({...formData, cidade: e.target.value})} />
              </div>
              <div className="form-group">
                <label>UF (Opcional)</label>
                <select className="form-select" value={formData.uf} onChange={(e) => setFormData({...formData, uf: e.target.value})}>
                  <option value="">Selecione...</option>
                  {estadosBR.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Telefone / WhatsApp</label>
              <input type="text" className="form-input" placeholder="(00) 00000-0000" value={formData.telefone} onChange={(e) => setFormData({...formData, telefone: e.target.value})} />
            </div>
            <div className="form-group">
              <label>E-mail</label>
              <input type="email" className="form-input" placeholder="contato@cliente.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
            </div>

            {/* NOVO CAMPO: AUTOMAÇÃO DE AGENDAMENTO */}
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', padding: '12px', backgroundColor: '#f1f5f9', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <input 
                type="checkbox" 
                id="exige_agendamento_cliente" 
                checked={formData.exige_agendamento} 
                onChange={(e) => setFormData({...formData, exige_agendamento: e.target.checked})} 
                style={{ width: '18px', height: '18px', cursor: 'pointer' }} 
              />
              <label htmlFor="exige_agendamento_cliente" style={{ margin: 0, cursor: 'pointer', fontWeight: 'bold', color: 'var(--munila-blue)' }}>
                Este cliente exige agendamento de entrega padrão?
              </label>
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