import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalEntregaProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: any;
  setFormData: (data: any) => void;
  isEditing: boolean;
  clientes: any[];
  transportadoras: any[];
}

export function ModalEntrega({ isOpen, onClose, onSubmit, formData, setFormData, isEditing, clientes, transportadoras }: ModalEntregaProps) {
  const [percentInput, setPercentInput] = useState('');

  useEffect(() => {
    const nf = parseFloat(formData.valor_nf) || 0;
    const frete = parseFloat(formData.valor_frete) || 0;
    const currentPercent = parseFloat(percentInput) || 0;
    const calcPercent = (nf > 0 && frete > 0) ? (frete / nf) * 100 : 0;

    if (Math.abs(currentPercent - calcPercent) > 0.01) {
      setPercentInput(calcPercent > 0 ? calcPercent.toFixed(2) : '');
    } else if (frete === 0 || isNaN(frete)) {
      setPercentInput('');
    }
  }, [formData.valor_nf, formData.valor_frete]);

  if (!isOpen) return null;

  const handlePercentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPercentInput(val);

    const pct = parseFloat(val);
    const nf = parseFloat(formData.valor_nf) || 0;

    if (!isNaN(pct) && nf > 0) {
      const freteCalculado = (nf * pct) / 100;
      setFormData({ ...formData, valor_frete: freteCalculado.toFixed(2) });
    } else if (val === '') {
      setFormData({ ...formData, valor_frete: '' });
    }
  };

  // HANDLER INTELIGENTE DO CLIENTE (Auto-preenche a cidade, mas deixa editável)
  const handleClienteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const clienteId = e.target.value;
    const clienteSelecionado = clientes.find(c => c.id === clienteId);
    setFormData({
      ...formData,
      cliente_id: clienteId,
      cidade_destino: clienteSelecionado ? `${clienteSelecionado.cidade} - ${clienteSelecionado.uf}` : formData.cidade_destino
    });
  };

  // HANDLER INTELIGENTE DA TRANSPORTADORA (Auto-preenche o modal, mas deixa editável)
  const handleTranspChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const transpId = e.target.value;
    const transpSelecionada = transportadoras.find(t => t.id === transpId);
    setFormData({
      ...formData,
      transportadora_id: transpId,
      modal_frete: transpSelecionada?.modal_padrao || formData.modal_frete
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h3>{isEditing ? 'Editar Entrega' : 'Cadastrar Nova Entrega'}</h3>
          <button type="button" className="close-btn" onClick={onClose}><X size={24} /></button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            
            <div className="form-group">
              <label>Número da NF</label>
              <input type="text" className="form-input" required value={formData.nota_fiscal} onChange={(e) => setFormData({...formData, nota_fiscal: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Cliente</label>
              <select className="form-select" required value={formData.cliente_id} onChange={handleClienteChange}>
                <option value="">Selecione...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            {/* AQUI ESTÃO OS CAMPOS AGORA EDITÁVEIS */}
            <div className="form-group">
              <label>Cidade / UF do Destino</label>
              <input type="text" className="form-input" value={formData.cidade_destino} onChange={(e) => setFormData({...formData, cidade_destino: e.target.value})} placeholder="Ex: SÃO PAULO - SP" />
            </div>
            <div className="form-group">
              <label>Transportadora</label>
              <select className="form-select" required value={formData.transportadora_id} onChange={handleTranspChange}>
                <option value="">Selecione...</option>
                {transportadoras.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Modal de Envio</label>
              <select className="form-select" required value={formData.modal_frete} onChange={(e) => setFormData({...formData, modal_frete: e.target.value})}>
                <option value="">Selecione o Modal...</option>
                <option value="AÉREO">Aéreo</option>
                <option value="RODOVIÁRIO">Rodoviário</option>
                <option value="PAC">PAC</option>
                <option value="SEDEX">Sedex</option>
              </select>
            </div>
            <div className="form-group">
              <label>Valor da NF (R$)</label>
              <input type="number" step="0.01" className="form-input" value={formData.valor_nf} onChange={(e) => setFormData({...formData, valor_nf: e.target.value})} />
            </div>

            <div className="form-group">
              <label>Valor do Frete (R$)</label>
              <input type="number" step="0.01" className="form-input" value={formData.valor_frete} onChange={(e) => setFormData({...formData, valor_frete: e.target.value})} />
            </div>
            <div className="form-group">
              <label>% do Frete (Calcula Reais)</label>
              <input type="number" step="0.01" className="form-input" value={percentInput} onChange={handlePercentChange} placeholder="Ex: 5.00" style={{ fontWeight: 'bold', color: '#0095DA', borderColor: '#bae6fd' }} />
            </div>

            <div className="form-group">
              <label>Data de Faturamento</label>
              <input type="date" className="form-input" value={formData.data_faturamento} onChange={(e) => setFormData({...formData, data_faturamento: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Data de Coleta</label>
              <input type="date" className="form-input" value={formData.data_coleta} onChange={(e) => setFormData({...formData, data_coleta: e.target.value})} />
            </div>

            <div className="form-group">
              <label>Volume (Qtd. Caixas)</label>
              <input type="number" className="form-input" placeholder="Ex: 5" value={formData.volume} onChange={(e) => setFormData({...formData, volume: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Peso Total (em Gramas)</label>
              <input type="number" step="0.01" className="form-input" placeholder="Ex: 2500" value={formData.peso_gramas} onChange={(e) => setFormData({...formData, peso_gramas: e.target.value})} />
            </div>

            <div className="form-group">
              <label>Status</label>
              <select className="form-select" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                <option value="Pendente">Pendente</option>
                <option value="Agendado">Agendado</option>
                <option value="Em Transporte">Em Transporte</option>
                <option value="Entregue">Entregue</option>
                <option value="Atrasado">Atrasado</option>
              </select>
            </div>
            <div className="form-group">
              <label>Previsão de Entrega</label>
              <input type="date" className="form-input" value={formData.data_previsao} onChange={(e) => setFormData({...formData, data_previsao: e.target.value})} />
            </div>

            <div className="form-group">
              <label>Data Efetiva de Entrega</label>
              <input type="date" className="form-input" value={formData.data_entrega_agendamento} onChange={(e) => setFormData({...formData, data_entrega_agendamento: e.target.value})} />
            </div>
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '30px' }}>
              <input type="checkbox" id="agendamento" checked={formData.tem_agendamento} onChange={(e) => setFormData({...formData, tem_agendamento: e.target.checked})} />
              <label htmlFor="agendamento" style={{ cursor: 'pointer' }}>Possui Agendamento?</label>
            </div>
          </div>

          <div className="modal-body" style={{ paddingTop: 0 }}>
            <div className="form-group">
              <label>Observações</label>
              <input type="text" className="form-input" value={formData.observacoes} onChange={(e) => setFormData({...formData, observacoes: e.target.value})} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary">{isEditing ? 'Atualizar Entrega' : 'Salvar Entrega'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}