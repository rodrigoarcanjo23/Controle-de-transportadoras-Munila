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

  const handleClienteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const clienteId = e.target.value;
    const clienteSelecionado = clientes.find(c => c.id === clienteId);
    
    setFormData({
      ...formData,
      cliente_id: clienteId,
      cidade_destino: clienteSelecionado ? clienteSelecionado.cidade : formData.cidade_destino,
      uf_destino: clienteSelecionado ? clienteSelecionado.uf : formData.uf_destino
    });
  };

  const handleTranspChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const transpId = e.target.value;
    const transpSelecionada = transportadoras.find(t => t.id === transpId);
    setFormData({
      ...formData,
      transportadora_id: transpId,
      modal_frete: transpSelecionada?.modal_padrao || formData.modal_frete
    });
  };

  const estadosBR = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

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

            <div className="form-group">
              <label>Cidade e UF de Destino</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" className="form-input" style={{ flex: 2 }} value={formData.cidade_destino} onChange={(e) => setFormData({...formData, cidade_destino: e.target.value})} placeholder="Ex: SÃO PAULO" />
                <select className="form-select" style={{ flex: 1 }} value={formData.uf_destino} onChange={(e) => setFormData({...formData, uf_destino: e.target.value})}>
                  <option value="">UF</option>
                  {estadosBR.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Transportadora</label>
              <select className="form-select" value={formData.transportadora_id} onChange={handleTranspChange}>
                <option value="">Ainda não definida...</option>
                {transportadoras.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Modal de Envio</label>
              <select className="form-select" value={formData.modal_frete} onChange={(e) => setFormData({...formData, modal_frete: e.target.value})}>
                <option value="">Ainda não definido...</option>
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
              <label>Peso Total (em Kg)</label>
              <input type="number" step="0.01" className="form-input" placeholder="Ex: 2.5" value={formData.peso_kg} onChange={(e) => setFormData({...formData, peso_kg: e.target.value})} />
            </div>

            <div className="form-group">
              <label>Status</label>
              <select className="form-select" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                <option value="Pendente">Pendente</option>
                <option value="Solicitado Agendamento">Solicitado Agendamento</option>
                <option value="Agendado">Agendado</option>
                <option value="Em Transporte">Em Transporte</option>
                <option value="Entregue">Entregue</option>
                <option value="Atrasado">Atrasado</option>
                <option value="Devolução">Devolução</option>
                <option value="Frete Conferido">Frete Conferido</option>
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
            
            <div style={{ 
              display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px', 
              marginTop: '24px', padding: '12px 16px', 
              backgroundColor: formData.tem_agendamento ? '#dcfce7' : '#fffbeb', 
              border: formData.tem_agendamento ? '2px solid #22c55e' : '2px dashed #f59e0b',
              borderRadius: '8px',
              transition: 'all 0.3s ease'
            }}>
              <input 
                type="checkbox" 
                id="agendamento" 
                checked={formData.tem_agendamento} 
                onChange={(e) => setFormData({...formData, tem_agendamento: e.target.checked})} 
                style={{ width: '24px', height: '24px', cursor: 'pointer', accentColor: '#16a34a' }}
              />
              <label htmlFor="agendamento" style={{ cursor: 'pointer', fontWeight: 700, fontSize: '1rem', color: formData.tem_agendamento ? '#166534' : '#b45309', userSelect: 'none', margin: 0 }}>
                {formData.tem_agendamento ? '✅ Entrega com Agendamento' : '⚠️ Esta entrega possui agendamento?'}
              </label>
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