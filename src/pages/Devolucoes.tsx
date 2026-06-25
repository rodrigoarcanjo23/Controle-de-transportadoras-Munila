import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Filter, Edit, Trash2, X, Upload } from 'lucide-react';

interface DevolucoesProps {
  devolucoes: any[];
  clientes: any[];
  onUpdate: () => void;
  formatarData: (d: string) => string;
  getStatusColor: (s: string) => React.CSSProperties;
}

export function Devolucoes({ devolucoes, clientes, onUpdate, formatarData, getStatusColor }: DevolucoesProps) {
  const [searchTermDev, setSearchTermDev] = useState('');
  const [filtroStatusDev, setFiltroStatusDev] = useState('');
  const [isDevolucaoModalOpen, setIsDevolucaoModalOpen] = useState(false);
  const [editingDevolucaoId, setEditingDevolucaoId] = useState<string | null>(null);
  
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [devolucaoFormData, setDevolucaoFormData] = useState({
    data_emissao: '', data_coleta: '', data_previsao: '', data_chegada: '', 
    cliente_id: '', transportadora_cliente: '', nf_venda: '', notas_fiscais: '',
    valor_total_nf: '', volume: '', peso_kg: '', valor_frete_reverso: '', motivo: '', status: 'Pendente'
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const linhas = text.split('\n');
        
        const payloads = [];
        let clientesNaoEncontrados = 0;

        const limpaCNPJ = (cnpj: string) => cnpj.replace(/\D/g, '');

        for (let i = 1; i < linhas.length; i++) {
          const linha = linhas[i].trim();
          if (!linha) continue;

          const colunas = linha.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
          
          const cnpjCSV = colunas[0]; 
          const dataEmissaoCSV = colunas[4]; 
          const notasFiscaisCSV = colunas[5]; 
          const valorNfCSV = parseFloat(colunas[6]) || 0; 
          const situacaoCSV = colunas[9]; 
          const statusCSV = colunas[11]; 
          const produtoCSV = colunas[13]; 
          const pedidoCSV = colunas[14]; 

          const clienteMatch = clientes.find(c => limpaCNPJ(c.cnpj_cpf || '') === limpaCNPJ(cnpjCSV));

          if (!clienteMatch) {
            clientesNaoEncontrados++;
            continue; 
          }

          let statusMapeado = 'Aguardando Chegada';
          if (statusCSV?.toLowerCase() === 'pendente') statusMapeado = 'Pendente';

          payloads.push({
            cliente_id: clienteMatch.id,
            data_emissao: dataEmissaoCSV || null,
            notas_fiscais: notasFiscaisCSV || '',
            valor_total_nf: valorNfCSV,
            motivo: `Produto: ${produtoCSV || '-'} | Situação: ${situacaoCSV || '-'}`,
            nf_venda: pedidoCSV || null,
            status: statusMapeado,
            valor_frete_reverso: 0, 
            transportadora_cliente: null
          });
        }

        if (payloads.length > 0) {
          const { error } = await supabase.from('devolucoes').insert(payloads);
          if (error) throw error;
          
          alert(`✅ Importação Concluída!\n\n${payloads.length} devoluções cadastradas com sucesso.\n⚠️ ${clientesNaoEncontrados} ignoradas pois o CNPJ não estava cadastrado na aba Clientes.`);
          onUpdate(); 
        } else {
          alert("Nenhuma devolução válida encontrada. Verifique se os CNPJs do arquivo já estão cadastrados na aba 'Clientes'.");
        }
      } catch (error) {
        console.error(error);
        alert("Erro crítico ao ler o arquivo CSV. Verifique a formatação da planilha.");
      } finally {
        setImportLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  function abrirModalNovaDevolucao() {
    setEditingDevolucaoId(null);
    setDevolucaoFormData({ 
      data_emissao: '', data_coleta: '', data_previsao: '', data_chegada: '', 
      cliente_id: '', transportadora_cliente: '', nf_venda: '', notas_fiscais: '', 
      valor_total_nf: '', volume: '', peso_kg: '', valor_frete_reverso: '', motivo: '', status: 'Pendente' 
    });
    setIsDevolucaoModalOpen(true);
  }

  function abrirModalEdicaoDevolucao(dev: any) {
    setEditingDevolucaoId(dev.id);
    setDevolucaoFormData({
      data_emissao: dev.data_emissao || '', data_coleta: dev.data_coleta || '', data_previsao: dev.data_previsao || '', data_chegada: dev.data_chegada || '',
      cliente_id: dev.cliente_id, transportadora_cliente: dev.transportadora_cliente || '', nf_venda: dev.nf_venda || '', notas_fiscais: dev.notas_fiscais || '',
      valor_total_nf: dev.valor_total_nf?.toString() || '', volume: dev.volume?.toString() || '', peso_kg: dev.peso_kg?.toString() || '',
      valor_frete_reverso: dev.valor_frete_reverso?.toString() || '', motivo: dev.motivo || '', status: dev.status || 'Pendente'
    });
    setIsDevolucaoModalOpen(true);
  }

  async function handleDeleteDevolucao(id: string) {
    if (!window.confirm("⚠️ ATENÇÃO: Tem certeza que deseja excluir este registro de devolução?")) return;
    try {
      const { error } = await supabase.from('devolucoes').delete().eq('id', id);
      if (error) throw error;
      onUpdate();
    } catch (error) { console.error(error); alert("Erro ao excluir a devolução."); }
  }

  async function handleDevolucaoSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        data_emissao: devolucaoFormData.data_emissao || null, data_coleta: devolucaoFormData.data_coleta || null, 
        data_previsao: devolucaoFormData.data_previsao || null, data_chegada: devolucaoFormData.data_chegada || null, 
        cliente_id: devolucaoFormData.cliente_id, 
        transportadora_cliente: devolucaoFormData.transportadora_cliente ? devolucaoFormData.transportadora_cliente.toUpperCase() : null,
        transportadora_id: null, nf_venda: devolucaoFormData.nf_venda || null, notas_fiscais: devolucaoFormData.notas_fiscais, 
        valor_total_nf: parseFloat(devolucaoFormData.valor_total_nf) || 0, volume: parseInt(devolucaoFormData.volume) || null, 
        peso_kg: parseFloat(devolucaoFormData.peso_kg) || null, valor_frete_reverso: parseFloat(devolucaoFormData.valor_frete_reverso) || 0, 
        motivo: devolucaoFormData.motivo, status: devolucaoFormData.status
      };

      if (editingDevolucaoId) {
        await supabase.from('devolucoes').update([payload]).eq('id', editingDevolucaoId);
      } else {
        await supabase.from('devolucoes').insert([payload]);
      }
      setIsDevolucaoModalOpen(false);
      onUpdate();
    } catch (error) { console.error(error); alert("Erro ao salvar a logística reversa."); }
  }

  const devolucoesFiltradas = devolucoes.filter(dev => {
    const termo = searchTermDev.toLowerCase();
    const nfVenda = dev.nf_venda?.toLowerCase() || '';
    const nfRef = dev.notas_fiscais?.toLowerCase() || '';
    const clienteNome = dev.clientes?.nome?.toLowerCase() || '';
    const clienteCnpj = dev.clientes?.cnpj_cpf?.toLowerCase() || ''; 
    const transp = dev.transportadora_cliente?.toLowerCase() || '';

    const passaTexto = nfVenda.includes(termo) || nfRef.includes(termo) || clienteNome.includes(termo) || clienteCnpj.includes(termo) || transp.includes(termo);
    const passaStatus = filtroStatusDev ? dev.status === filtroStatusDev : true;

    return passaTexto && passaStatus;
  });

  const thStyle: React.CSSProperties = { position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, borderBottom: '2px solid #e2e8f0', padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', whiteSpace: 'nowrap' };
  const thAcoesStyle: React.CSSProperties = { ...thStyle, right: 0, zIndex: 11, textAlign: 'center', borderLeft: '1px solid #e2e8f0' };
  const tdStyle: React.CSSProperties = { padding: '10px 16px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap', fontSize: '0.85rem', color: '#334155' };
  const tdAcoesStyle: React.CSSProperties = { ...tdStyle, textAlign: 'center', position: 'sticky', right: 0, backgroundColor: 'white', zIndex: 1, borderLeft: '1px solid #e2e8f0' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
      <header className="header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <div><h2>Logística Reversa (Devoluções)</h2><p>Auditoria de coletas e custos de frete reverso</p></div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              style={{ display: 'none' }} 
            />
            
            <button 
              className="btn-secondary" 
              onClick={() => fileInputRef.current?.click()}
              disabled={importLoading}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Upload size={18} /> {importLoading ? 'A Processar...' : 'Importar CSV'}
            </button>
            
            <button className="btn-primary" onClick={abrirModalNovaDevolucao}>+ Nova Devolução</button>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', width: '100%', alignItems: 'center', backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
            <input type="text" className="form-input" placeholder="Buscar por NF, Cliente, CNPJ/CPF..." value={searchTermDev} onChange={e => setSearchTermDev(e.target.value)} style={{ paddingLeft: '36px', width: '100%' }} />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={18} color="var(--text-muted)"/>
            <select className="form-select" value={filtroStatusDev} onChange={e => setFiltroStatusDev(e.target.value)} style={{ width: '220px' }}>
              <option value="">Todos os Status</option>
              <option value="Pendente">Pendente</option>
              {/* AS DUAS NOVAS OPÇÕES NO FILTRO AQUI */}
              <option value="Lançada">Lançada</option>
              <option value="Emitida">Emitida</option>
              <option value="Solic. Coleta">Solic. Coleta</option>
              <option value="Coletada">Coletada</option>
              <option value="Coletada pelo representante.">Coletada pelo representante.</option>
              <option value="Aguardando Chegada">Aguardando Chegada</option>
              <option value="Chegou no Galpão">Chegou no Galpão</option>
              <option value="Entregue">Entregue</option>
              <option value="Recusa">Recusa</option>
            </select>
          </div>
        </div>
      </header>

      <div className="table-container" style={{ flex: 1, minHeight: 0, overflow: 'auto', position: 'relative' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={thStyle}>Dt Emissão</th><th style={thStyle}>Dt Coleta</th><th style={thStyle}>Cliente</th><th style={thStyle}>Transportadora</th><th style={thStyle}>NF Venda</th><th style={thStyle}>NFs (Devolução)</th><th style={thStyle}>Valor NFs</th><th style={thStyle}>Volume</th><th style={thStyle}>Peso (Kg)</th><th style={thStyle}>Custo Reverso</th><th style={thStyle}>Dt Previsão</th><th style={thStyle}>Dt Chegada</th><th style={thStyle}>Status</th><th style={thAcoesStyle}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {devolucoesFiltradas.length === 0 ? ( <tr><td colSpan={14} style={{ textAlign: 'center', padding: '32px' }}>Nenhuma devolução encontrada.</td></tr> ) : devolucoesFiltradas.map((dev) => (
              <tr key={dev.id} className="trow-hover">
                <td style={tdStyle}>{formatarData(dev.data_emissao)}</td><td style={tdStyle}>{formatarData(dev.data_coleta)}</td><td style={{ ...tdStyle, fontWeight: 'bold' }}>{dev.clientes?.nome || '-'}</td><td style={tdStyle}>{dev.transportadora_cliente || dev.transportadoras?.nome || '-'}</td><td style={{ ...tdStyle, color: 'var(--munila-blue)', fontWeight: 'bold' }}>{dev.nf_venda || '-'}</td><td style={{ ...tdStyle, fontWeight: 'bold' }}>{dev.notas_fiscais}</td><td style={tdStyle}>R$ {Number(dev.valor_total_nf).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td><td style={{ ...tdStyle, fontWeight: 'bold' }}>{dev.volume ? `${dev.volume} Cx` : '-'}</td><td style={{ ...tdStyle, fontWeight: 'bold' }}>{dev.peso_kg ? `${dev.peso_kg} Kg` : '-'}</td><td style={{ ...tdStyle, fontWeight: 'bold', color: '#ef4444' }}>R$ {Number(dev.valor_frete_reverso).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td><td style={tdStyle}>{formatarData(dev.data_previsao)}</td><td style={tdStyle}>{formatarData(dev.data_chegada)}</td><td style={tdStyle}><span className="status-badge" style={getStatusColor(dev.status)}>{dev.status}</span></td>
                <td style={tdAcoesStyle}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button onClick={() => abrirModalEdicaoDevolucao(dev)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }} title="Editar Devolução"><Edit size={18} /></button>
                    <button onClick={() => handleDeleteDevolucao(dev.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }} title="Excluir Devolução"><Trash2 size={18} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isDevolucaoModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header"><h3>{editingDevolucaoId ? 'Editar Logística Reversa' : 'Registrar Logística Reversa'}</h3><button className="close-btn" onClick={() => setIsDevolucaoModalOpen(false)}><X size={24} /></button></div>
            <form onSubmit={handleDevolucaoSubmit}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group"><label>NF de Venda (Origem)</label><input type="text" className="form-input" placeholder="Ex: 12500" value={devolucaoFormData.nf_venda} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, nf_venda: e.target.value})} /></div>
                <div className="form-group"><label>NFs de Referência (Devolução)</label><input type="text" className="form-input" placeholder="Ex: 12661, 13196" required value={devolucaoFormData.notas_fiscais} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, notas_fiscais: e.target.value})} /></div>
                <div className="form-group"><label>Cliente</label><select className="form-select" required value={devolucaoFormData.cliente_id} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, cliente_id: e.target.value})}><option value="">Selecione...</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
                <div className="form-group"><label>Transportadora (Texto Livre)</label><input type="text" className="form-input" placeholder="Ex: Correios do Cliente, Loggi, etc..." value={devolucaoFormData.transportadora_cliente} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, transportadora_cliente: e.target.value})} /></div>
                <div className="form-group"><label>Data de Emissão (NF Devolução)</label><input type="date" className="form-input" value={devolucaoFormData.data_emissao} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, data_emissao: e.target.value})} /></div>
                <div className="form-group"><label>Data da Coleta (Reversa)</label><input type="date" className="form-input" value={devolucaoFormData.data_coleta} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, data_coleta: e.target.value})} /></div>
                <div className="form-group"><label>Data de Previsão</label><input type="date" className="form-input" value={devolucaoFormData.data_previsao} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, data_previsao: e.target.value})} /></div>
                <div className="form-group"><label>Data de Chegada (Galpão)</label><input type="date" className="form-input" value={devolucaoFormData.data_chegada} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, data_chegada: e.target.value})} /></div>
                <div className="form-group"><label>Valor Total das NFs (R$)</label><input type="number" step="0.01" className="form-input" value={devolucaoFormData.valor_total_nf} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, valor_total_nf: e.target.value})} /></div>
                <div className="form-group"><label>Custo do Frete Reverso (R$)</label><input type="number" step="0.01" className="form-input" style={{ borderColor: '#ef4444' }} placeholder="Valor que a Munila vai pagar" value={devolucaoFormData.valor_frete_reverso} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, valor_frete_reverso: e.target.value})} /></div>
                <div className="form-group"><label>Volume Retornando (Cx)</label><input type="number" className="form-input" placeholder="Ex: 2" value={devolucaoFormData.volume} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, volume: e.target.value})} /></div>
                <div className="form-group"><label>Peso Retornando (Kg)</label><input type="number" step="0.01" className="form-input" placeholder="Ex: 1.5" value={devolucaoFormData.peso_kg} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, peso_kg: e.target.value})} /></div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Status da Devolução</label><select className="form-select" value={devolucaoFormData.status} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, status: e.target.value})}>
                  <option value="Pendente">Pendente</option>
                  {/* AS DUAS NOVAS OPÇÕES NO FORMULÁRIO AQUI */}
                  <option value="Lançada">Lançada</option>
                  <option value="Emitida">Emitida</option>
                  <option value="Solic. Coleta">Solic. Coleta</option>
                  <option value="Coletada">Coletada</option>
                  <option value="Coletada pelo representante.">Coletada pelo representante.</option>
                  <option value="Aguardando Chegada">Aguardando Chegada</option>
                  <option value="Chegou no Galpão">Chegou no Galpão</option>
                  <option value="Entregue">Entregue</option>
                  <option value="Recusa">Recusa</option>
                </select></div>
              </div>
              <div className="modal-body" style={{ paddingTop: 0 }}><div className="form-group"><label>Motivo da Devolução / Avaria</label><textarea className="form-input" rows={3} placeholder="Descreva o motivo (ex: validade curta, caixa rasgada, cliente recusou...)" value={devolucaoFormData.motivo} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, motivo: e.target.value})} /></div></div>
              <div className="modal-footer"><button type="button" className="btn-secondary" onClick={() => setIsDevolucaoModalOpen(false)}>Cancelar</button><button type="submit" className="btn-primary" style={{ backgroundColor: '#ef4444' }}>{editingDevolucaoId ? 'Atualizar Reversa' : 'Salvar Reversa'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}