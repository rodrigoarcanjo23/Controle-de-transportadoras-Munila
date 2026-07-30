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
  const [buscaCliente, setBuscaCliente] = useState('');
  const [mostrarDropdownCliente, setMostrarDropdownCliente] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (formData.cliente_id) {
        const clienteEncontrado = clientes.find(c => c.id === formData.cliente_id);
        setBuscaCliente(clienteEncontrado ? clienteEncontrado.nome : '');
      } else {
        setBuscaCliente('');
      }
    }
  }, [isOpen, formData.cliente_id, clientes]);

  if (!isOpen) return null;

  const clientesFiltradosDropdown = clientes.filter(c => 
    c.nome.toLowerCase().includes(buscaCliente.toLowerCase()) || 
    (c.cnpj_cpf && c.cnpj_cpf.includes(buscaCliente))
  );

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
            
            <div className="form-group" style={{ position: 'relative', gridColumn: '1 / -1' }}>
              <label>Cliente</label>
              <input
                type="text"
                className="form-input"
                placeholder="Digite o nome ou CNPJ..."
                required={!formData.cliente_id}
                value={buscaCliente}
                onChange={(e) => {
                  setBuscaCliente(e.target.value);
                  setMostrarDropdownCliente(true);
                  setFormData({...formData, cliente_id: ''}); 
                }}
                onFocus={() => setMostrarDropdownCliente(true)}
                onBlur={() => setTimeout(() => setMostrarDropdownCliente(false), 200)}
              />
              {mostrarDropdownCliente && (
                <ul style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  backgroundColor: 'white', border: '1px solid var(--border-color)', borderRadius: '6px',
                  maxHeight: '200px', overflowY: 'auto', margin: '4px 0 0 0', padding: 0, listStyle: 'none',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                }}>
                  {clientesFiltradosDropdown.map(c => (
                    <li
                      key={c.id}
                      style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem', color: 'var(--text-main)' }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setBuscaCliente(c.nome);
                        setFormData({
                          ...formData, 
                          cliente_id: c.id,
                          tem_agendamento: c.exige_agendamento || false
                        });
                        setMostrarDropdownCliente(false);
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div style={{ fontWeight: 'bold' }}>{c.nome}</div>
                      {c.cnpj_cpf && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.cnpj_cpf}</div>}
                    </li>
                  ))}
                  {clientesFiltradosDropdown.length === 0 && (
                    <li style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhum cliente encontrado</li>
                  )}
                </ul>
              )}
            </div>

            <div className="form-group"><label>Nota Fiscal</label><input type="text" className="form-input" required value={formData.nota_fiscal} onChange={(e) => setFormData({...formData, nota_fiscal: e.target.value})} /></div>
            
            <div className="form-group">
              <label>Transportadora</label>
              <select 
                className="form-select" 
                value={formData.transportadora_id} 
                onChange={(e) => {
                  const selectedId = e.target.value;
                  const transportadoraSelecionada = transportadoras.find(t => t.id === selectedId);
                  
                  setFormData({
                    ...formData, 
                    transportadora_id: selectedId,
                    modal_frete: transportadoraSelecionada?.modal_padrao || ''
                  });
                }}
              >
                <option value="">Selecione...</option>
                {transportadoras.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>

            <div className="form-group"><label>Cidade de Destino</label><input type="text" className="form-input" value={formData.cidade_destino} onChange={(e) => setFormData({...formData, cidade_destino: e.target.value})} /></div>
            <div className="form-group"><label>UF Destino</label>
              <select className="form-select" value={formData.uf_destino} onChange={(e) => setFormData({...formData, uf_destino: e.target.value})}>
                <option value="">Selecione...</option>
                {estadosBR.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>

            <div className="form-group"><label>Data Faturamento</label><input type="date" className="form-input" value={formData.data_faturamento} onChange={(e) => setFormData({...formData, data_faturamento: e.target.value})} /></div>
            <div className="form-group"><label>Data Coleta</label><input type="date" className="form-input" value={formData.data_coleta} onChange={(e) => setFormData({...formData, data_coleta: e.target.value})} /></div>

            <div className="form-group"><label>Valor da NF (R$)</label><input type="number" step="0.01" className="form-input" value={formData.valor_nf} onChange={(e) => setFormData({...formData, valor_nf: e.target.value})} /></div>
            <div className="form-group"><label>Custo do Frete (R$)</label><input type="number" step="0.01" className="form-input" value={formData.valor_frete} onChange={(e) => setFormData({...formData, valor_frete: e.target.value})} /></div>

            <div className="form-group"><label>Volume (Caixas)</label><input type="number" className="form-input" value={formData.volume} onChange={(e) => setFormData({...formData, volume: e.target.value})} /></div>
            
            {/* ATUALIZADO: Regra de bloqueio aplicada ao campo Peso */}
            <div className="form-group">
              <label>Peso (Kg) <span style={{ color: '#ef4444' }}>*</span></label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Ex: 1500 (apenas números)"
                required 
                value={formData.peso_kg} 
                onChange={(e) => {
                  const valorLimpo = e.target.value.replace(/[\s,.]/g, '');
                  setFormData({...formData, peso_kg: valorLimpo});
                }} 
              />
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" id="tem_agendamento" checked={formData.tem_agendamento} onChange={(e) => setFormData({...formData, tem_agendamento: e.target.checked})} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
              <label htmlFor="tem_agendamento" style={{ margin: 0, cursor: 'pointer', fontWeight: 'bold', color: 'var(--munila-blue)' }}>Possui Agendamento?</label>
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" id="frete_confirmado" checked={formData.frete_confirmado} onChange={(e) => setFormData({...formData, frete_confirmado: e.target.checked})} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#16a34a' }} />
              <label htmlFor="frete_confirmado" style={{ margin: 0, cursor: 'pointer', fontWeight: 'bold', color: '#166534' }}>Frete Confirmado/Auditado?</label>
            </div>

            <div className="form-group"><label>Data Previsão</label><input type="date" className="form-input" value={formData.data_previsao} onChange={(e) => setFormData({...formData, data_previsao: e.target.value})} /></div>
            
            <div className="form-group">
              <label>Data Entrega</label>
              <input 
                type="date" 
                className="form-input" 
                value={formData.data_entrega_agendamento} 
                onChange={(e) => {
                  const novaData = e.target.value;
                  setFormData({
                    ...formData, 
                    data_entrega_agendamento: novaData,
                    status: novaData ? 'Entregue' : formData.status
                  });
                }} 
              />
            </div>

            <div className="form-group">
              <label>Modal de Frete</label>
              <select className="form-select" value={formData.modal_frete} onChange={(e) => setFormData({...formData, modal_frete: e.target.value})}>
                <option value="">Padrão da Transportadora</option>
                <option value="AÉREO">Aéreo</option>
                <option value="RODOVIÁRIO">Rodoviário</option>
                <option value="PAC">PAC</option>
                <option value="SEDEX">Sedex</option>
              </select>
            </div>

            <div className="form-group"><label>Status da Entrega</label>
              <select className="form-select" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                <option value="Pendente">Pendente</option>
                <option value="Pendente agendamento">Pendente agendamento</option>
                <option value="Aguardando coleta">Aguardando coleta</option>
                <option value="Solicitado Agendamento">Solicitado Agendamento</option>
                <option value="Agendado">Agendado</option>
                <option value="Em Transporte">Em Transporte</option>
                <option value="Entregue">Entregue</option>
                <option value="Atrasado">Atrasado</option>
                <option value="Devolução">Devolução</option>
                <option value="Frete Conferido">Frete Conferido</option>
              </select>
            </div>

          </div>

          <div className="modal-body" style={{ paddingTop: 0 }}>
            <div className="form-group"><label>Observações</label><textarea className="form-input" rows={2} value={formData.observacoes} onChange={(e) => setFormData({...formData, observacoes: e.target.value})} /></div>
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