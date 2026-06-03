import { X } from 'lucide-react';

interface ModalClienteProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: { nome: string; cidade: string; uf: string; telefone: string; email: string };
  setFormData: (data: any) => void;
  isEditing: boolean;
}

export function ModalCliente({ isOpen, onClose, onSubmit, formData, setFormData, isEditing }: ModalClienteProps) {
  if (!isOpen) return null; // Se não estiver aberto, não renderiza nada no DOM

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>{isEditing ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}</h3>
          <button type="button" className="close-btn" onClick={onClose}><X size={24} /></button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Nome do Cliente / Rede</label>
              <input type="text" className="form-input" placeholder="Ex: DROGA RAIA" required value={formData.nome} onChange={(e) => setFormData({...formData, nome: e.target.value})} />
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