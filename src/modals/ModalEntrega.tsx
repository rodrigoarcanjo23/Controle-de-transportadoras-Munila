import { X } from 'lucide-react';
import { useState, useEffect } from 'react';

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
  // Estado local para permitir a digitação livre no campo de porcentagem
  const [percentInput, setPercentInput] = useState('');

  // Efeito 1: Sincroniza a porcentagem caso o usuário digite no campo "Valor do Frete"
  useEffect(() => {
    const nf = parseFloat(formData.valor_nf) || 0;
    const frete = parseFloat(formData.valor_frete) || 0;
    const currentPercent = parseFloat(percentInput) || 0;
    const calcPercent = (nf > 0 && frete > 0) ? (frete / nf) * 100 : 0;

    // Atualiza apenas se a diferença for real, para não bugar o cursor enquanto você digita
    if (Math.abs(currentPercent - calcPercent) > 0.01) {
      setPercentInput(calcPercent > 0 ? calcPercent.toFixed(2) : '');
    } else if (frete === 0 || isNaN(frete)) {
      setPercentInput('');
    }
  }, [formData.valor_nf, formData.valor_frete]);

  if (!isOpen) return null;

  // Lógica de Auto-Preenchimento Visual (Cidade e Modal)
  const clienteSelecionado = clientes.find(c => c.id === formData.cliente_id);
  const transpSelecionada = transportadoras.find(t => t.id === formData.transportadora_id);

  // Efeito 2: Calcula o "Valor do Frete" caso o usuário digite no campo "% do Frete"
  const handlePercentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPercentInput(val); // Atualiza o texto na tela imediatamente

    const pct = parseFloat(val);
    const nf = parseFloat(formData.valor_nf) || 0;

    // Se ele digitou uma porcentagem válida e já tem valor de NF
    if (!isNaN(pct) && nf > 0) {
      const freteCalculado = (nf * pct) / 100;
      setFormData({ ...formData, valor_frete: freteCalculado.toFixed(2) });
    } else if (val === '') {
      setFormData({ ...formData, valor_frete: '' });
    }
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
            
            {/* LINHA 1 */}
            <div className="form-group">
              <label>Número da NF</label>
              <input type="text" className="form-input" required value={formData.nota_fiscal} onChange={(e) => setFormData({...formData, nota_fiscal: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Cliente</label>
              <select className="form-select" required value={formData.cliente_id} onChange={(e) => setFormData({...formData, cliente_id: e.target.value})}>
                <option value="">Selecione...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            {/* LINHA 2: Cidade e Transportadora */}
            <div className="form-group">
              <label>Cidade / UF (Auto-preenchido)</label>
              <input type="text" className="form-input" disabled value={clienteSelecionado ? `${clienteSelecionado.cidade} - ${clienteSelecionado.uf}` : ''} style={{ backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 'bold' }} placeholder="Selecione um cliente..." />
            </div>
            <div className="form-group">
              <label>Transportadora</label>
              <select className="form-select" required value={formData.transportadora_id} onChange={(e) => setFormData({...formData, transportadora_id: e.target.value})}>
                <option value="">Selecione...</option>
                {transportadoras.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>

            {/* LINHA 3: Modal e Valor da NF */}
            <div className="form-group">
              <label>Modal (Auto-preenchido)</label>
              <input type="text" className="form-input" disabled value={transpSelecionada?.modal_padrao || ''} style={{ backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 'bold' }} placeholder="Selecione a transportadora..." />
            </div>
            <div className="form-group">
              <label>Valor da NF (R$)</label>
              <input type="number" step="0.01" className="form-input" value={formData.valor_nf} onChange={(e) => setFormData({...formData, valor_nf: e.target.value})} />
            </div>

            {/* LINHA 4: Valor do Frete e Porcentagem */}
            <div className="form-group">
              <label>Valor do Frete (R$)</label>
              <input type="number" step="0.01" className="form-input" value={formData.valor_frete} onChange={(e) => setFormData({...formData, valor_frete: e.target.value})} />
            </div>
            <div className="form-group">
              <label>% do Frete (Calcula Reais)</label>
              {/* CAMPO AGORA LIBERADO PARA DIGITAÇÃO */}
              <input type="number" step="0.01" className="form-input" value={percentInput} onChange={handlePercentChange} placeholder="Ex: 5.00" style={{ fontWeight: 'bold', color: '#0095DA', borderColor: '#bae6fd' }} />
            </div>

            {/* LINHA 5: Datas */}
            <div className="form-group">
              <label>Data de Faturamento</label>
              <input type="date" className="form-input" value={formData.data_faturamento} onChange={(e) => setFormData({...formData, data_faturamento: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Data de Coleta</label>
              <input type="date" className="form-input" value={formData.data_coleta} onChange={(e) => setFormData({...formData, data_coleta: e.target.value})} />
            </div>

            {/* LINHA 6: Volume e Peso */}
            <div className="form-group">
              <label>Volume (Qtd. Caixas)</label>
              <input type="number" className="form-input" placeholder="Ex: 5" value={formData.volume} onChange={(e) => setFormData({...formData, volume: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Peso Total (em Gramas)</label>
              <input type="number" step="0.01" className="form-input" placeholder="Ex: 2500" value={formData.peso_gramas} onChange={(e) => setFormData({...formData, peso_gramas: e.target.value})} />
            </div>

            {/* LINHA 7: Status e Previsão */}
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

            {/* LINHA 8: Efetiva e Agendamento */}
            <div className="form-group">
              <label>Data Efetiva de Entrega</label>
              <input type="date" className="form-input" value={formData.data_entrega_agendamento} onChange={(e) => setFormData({...formData, data_entrega_agendamento: e.target.value})} />
            </div>
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '30px' }}>
              <input type="checkbox" id="agendamento" checked={formData.tem_agendamento} onChange={(e) => setFormData({...formData, tem_agendamento: e.target.checked})} />
              <label htmlFor="agendamento" style={{ cursor: 'pointer' }}>Possui Agendamento?</label>
            </div>
          </div>

          {/* LINHA 9: Observações */}
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