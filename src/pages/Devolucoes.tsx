import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Filter, Edit, Trash2, X, UploadCloud, DollarSign, Package, Scale, AlertCircle, RefreshCcw, TrendingDown, Printer, Download } from 'lucide-react';

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
  
  const xmlInputRef = useRef<HTMLInputElement>(null);

  const [buscaCliente, setBuscaCliente] = useState('');
  const [mostrarDropdownCliente, setMostrarDropdownCliente] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');

  const [devolucaoFormData, setDevolucaoFormData] = useState({
    data_emissao: '', data_coleta: '', data_previsao: '', data_chegada: '', 
    cliente_id: '', transportadora_cliente: '', nf_venda: '', notas_fiscais: '',
    valor_total_nf: '', volume: '', peso_kg: '', valor_frete_reverso: '', motivo: '', status: 'Pendente'
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setUserEmail(session.user.email);
      }
    });
  }, []);

  const registrarLogDevolucao = async (acao: string, detalhes: string) => {
    if (!userEmail) return;
    try {
      await supabase.from('logs_auditoria').insert([{
        usuario_email: userEmail,
        acao: acao,
        modulo: 'DEVOLUCOES',
        detalhes: detalhes
      }]);
    } catch (error) {
      console.error("Erro ao registrar log de Devolução:", error);
    }
  };

  const handleXmlUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const xmlString = e.target?.result as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");

        const getTagValue = (tag: string, parent: Element | Document = xmlDoc) => {
          const el = parent.getElementsByTagName(tag)[0];
          return el ? el.textContent || '' : '';
        };

        let dataEmissao = getTagValue("dhEmi");
        if (dataEmissao) dataEmissao = dataEmissao.split('T')[0];

        const nfDevolucao = getTagValue("nNF");

        let nfVendaOrigem = '';
        const refNFeNodes = xmlDoc.getElementsByTagName("refNFe");
        if (refNFeNodes.length > 0) {
          const chave = refNFeNodes[0].textContent || '';
          if (chave.length === 44) {
            nfVendaOrigem = Number(chave.substring(25, 34)).toString();
          }
        }

        const totalNode = xmlDoc.getElementsByTagName("total")[0];
        const valorTotal = totalNode ? getTagValue("vNF", totalNode) : '';

        const transpNode = xmlDoc.getElementsByTagName("transp")[0];
        const volume = transpNode ? getTagValue("qVol", transpNode) : '';
        const pesoKg = transpNode ? getTagValue("pesoB", transpNode) : '';

        const natOp = getTagValue("natOp");

        const emitNode = xmlDoc.getElementsByTagName("emit")[0];
        const cnpjEmitente = emitNode ? getTagValue("CNPJ", emitNode) : '';
        const limpaCNPJ = (cnpj: string) => cnpj.replace(/\D/g, '');
        const clienteMatch = clientes.find(c => limpaCNPJ(c.cnpj_cpf || '') === limpaCNPJ(cnpjEmitente));

        setDevolucaoFormData(prev => ({
          ...prev,
          data_emissao: dataEmissao || prev.data_emissao,
          notas_fiscais: nfDevolucao || prev.notas_fiscais,
          nf_venda: nfVendaOrigem || prev.nf_venda,
          valor_total_nf: valorTotal || prev.valor_total_nf,
          volume: volume || prev.volume,
          peso_kg: pesoKg || prev.peso_kg,
          motivo: natOp || prev.motivo,
          cliente_id: clienteMatch ? clienteMatch.id : prev.cliente_id
        }));

        if (clienteMatch) {
          setBuscaCliente(clienteMatch.nome);
          alert(`✅ XML processado com sucesso!\n\nNF Devolução: ${nfDevolucao}\nCliente vinculado automaticamente.`);
        } else {
          alert(`⚠️ XML processado!\n\nNF Devolução: ${nfDevolucao}\n\nO CNPJ do emitente (${cnpjEmitente}) não foi encontrado na sua base de clientes. Por favor, selecione o cliente manualmente na lista.`);
        }

        registrarLogDevolucao('CRIOU', `Fez a leitura de um XML para autofill da NF de Devolução: ${nfDevolucao}`);

      } catch (err) {
        console.error(err);
        alert("Erro ao ler o ficheiro XML. Certifique-se de que é um formato válido de NFe.");
      }
    };
    reader.readAsText(file);
    if(xmlInputRef.current) xmlInputRef.current.value = ''; 
  };

  function abrirModalNovaDevolucao() {
    setEditingDevolucaoId(null);
    setDevolucaoFormData({ 
      data_emissao: '', data_coleta: '', data_previsao: '', data_chegada: '', 
      cliente_id: '', transportadora_cliente: '', nf_venda: '', notas_fiscais: '', 
      valor_total_nf: '', volume: '', peso_kg: '', valor_frete_reverso: '', motivo: '', status: 'Pendente' 
    });
    setBuscaCliente('');
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
    
    const nomeEncontrado = clientes.find(c => c.id === dev.cliente_id)?.nome || '';
    setBuscaCliente(nomeEncontrado);
    
    setIsDevolucaoModalOpen(true);
  }

  async function handleDeleteDevolucao(id: string) {
    if (!window.confirm("⚠️ ATENÇÃO: Tem certeza que deseja excluir este registro de devolução?")) return;
    try {
      const devParaApagar = devolucoes.find(d => d.id === id);
      const { error } = await supabase.from('devolucoes').delete().eq('id', id);
      if (error) throw error;
      
      if (devParaApagar) {
        await registrarLogDevolucao('APAGOU', `Excluiu o registo de Devolução (NFs Referência: ${devParaApagar.notas_fiscais})`);
      }
      onUpdate();
    } catch (error) { console.error(error); alert("Erro ao excluir a devolução."); }
  }

  async function handleDevolucaoSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!devolucaoFormData.cliente_id) {
      alert("Por favor, selecione um cliente válido na lista de opções.");
      return;
    }
    
    try {
      // Converte a vírgula do peso (se houver) para ponto antes de salvar
      const pesoFormatado = parseFloat(String(devolucaoFormData.peso_kg).replace(',', '.')) || null;

      const payload = {
        data_emissao: devolucaoFormData.data_emissao || null, data_coleta: devolucaoFormData.data_coleta || null, 
        data_previsao: devolucaoFormData.data_previsao || null, data_chegada: devolucaoFormData.data_chegada || null, 
        cliente_id: devolucaoFormData.cliente_id, 
        transportadora_cliente: devolucaoFormData.transportadora_cliente ? devolucaoFormData.transportadora_cliente.toUpperCase() : null,
        transportadora_id: null, nf_venda: devolucaoFormData.nf_venda || null, notas_fiscais: devolucaoFormData.notas_fiscais, 
        valor_total_nf: parseFloat(devolucaoFormData.valor_total_nf) || 0, volume: parseInt(devolucaoFormData.volume) || null, 
        peso_kg: pesoFormatado, valor_frete_reverso: parseFloat(devolucaoFormData.valor_frete_reverso) || 0, 
        motivo: devolucaoFormData.motivo, status: devolucaoFormData.status
      };

      if (editingDevolucaoId) {
        await supabase.from('devolucoes').update([payload]).eq('id', editingDevolucaoId);
        await registrarLogDevolucao('EDITOU', `Editou a Logística Reversa (NFs Referência: ${payload.notas_fiscais})`);
      } else {
        await supabase.from('devolucoes').insert([payload]);
        await registrarLogDevolucao('CRIOU', `Registrou nova Logística Reversa (NFs Referência: ${payload.notas_fiscais})`);
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

  // ==========================================
  // EXPORTAÇÃO PARA EXCEL E PDF
  // ==========================================
  const exportarParaExcel = () => {
    if (devolucoesFiltradas.length === 0) { alert("Não há dados para exportar com estes filtros."); return; }
    
    const cabecalho = ["Dt Emissão", "Dt Coleta", "Cliente", "Transportadora", "NF Venda", "NFs (Devolução)", "Valor NFs (R$)", "Volume", "Peso (Kg)", "Custo Reverso (R$)", "Dt Previsão", "Dt Chegada", "Status", "Motivo/Avaria"].join(";");
    
    const linhas = devolucoesFiltradas.map(dev => {
      return [
        formatarData(dev.data_emissao),
        formatarData(dev.data_coleta),
        dev.clientes?.nome || '-',
        dev.transportadora_cliente || dev.transportadoras?.nome || '-',
        dev.nf_venda || '-',
        dev.notas_fiscais,
        dev.valor_total_nf?.toString().replace('.', ',') || '0,00',
        dev.volume || '-',
        dev.peso_kg?.toString().replace('.', ',') || '-',
        dev.valor_frete_reverso?.toString().replace('.', ',') || '0,00',
        formatarData(dev.data_previsao),
        formatarData(dev.data_chegada),
        dev.status,
        dev.motivo || '-'
      ].join(";");
    });
    
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + cabecalho + "\n" + linhas.join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `MunilaLog_Devolucoes_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const exportarParaPDF = () => {
    window.print();
  };

  // ==========================================
  // CÁLCULOS DOS DASHBOARDS (KPIS)
  // ==========================================
  const totalDevolucoes = devolucoesFiltradas.length;
  const valorTotalNfs = devolucoesFiltradas.reduce((acc, curr) => acc + (Number(curr.valor_total_nf) || 0), 0);
  const custoFreteReverso = devolucoesFiltradas.reduce((acc, curr) => acc + (Number(curr.valor_frete_reverso) || 0), 0);
  const volumeTotal = devolucoesFiltradas.reduce((acc, curr) => acc + (Number(curr.volume) || 0), 0);
  const pesoTotal = devolucoesFiltradas.reduce((acc, curr) => acc + (Number(curr.peso_kg) || 0), 0);
  
  const aguardandoChegada = devolucoesFiltradas.filter(d => 
    !['Chegou no Galpão', 'Entregue', 'Recusa'].includes(d.status)
  ).length;

  const clientesFiltradosDropdown = clientes.filter(c => 
    c.nome.toLowerCase().includes(buscaCliente.toLowerCase()) || 
    (c.cnpj_cpf && c.cnpj_cpf.includes(buscaCliente))
  );

  const thStyle: React.CSSProperties = { position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, borderBottom: '2px solid #e2e8f0', padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', whiteSpace: 'nowrap' };
  const thAcoesStyle: React.CSSProperties = { ...thStyle, right: 0, zIndex: 11, textAlign: 'center', borderLeft: '1px solid #e2e8f0' };
  const tdStyle: React.CSSProperties = { padding: '10px 16px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap', fontSize: '0.85rem', color: '#334155' };
  const tdAcoesStyle: React.CSSProperties = { ...tdStyle, textAlign: 'center', position: 'sticky', right: 0, backgroundColor: 'white', zIndex: 1, borderLeft: '1px solid #e2e8f0' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', paddingBottom: '24px' }}>
      <header className="header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div><h2>Logística Reversa (Devoluções)</h2><p>Auditoria de coletas e custos de frete reverso</p></div>
          
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={exportarParaPDF}>
              <Printer size={16} /> PDF
            </button>
            <button type="button" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', borderColor: '#16a34a' }} onClick={exportarParaExcel}>
              <Download size={16} /> Excel
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

      {/* PAINEL DE DASHBOARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px', flexShrink: 0 }}>
        
        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Devoluções</p>
            <RefreshCcw size={16} color="#0284c7" />
          </div>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', fontWeight: 700 }}>
            {totalDevolucoes} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>registros</span>
          </h3>
        </div>

        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Valor Total Retornando</p>
            <DollarSign size={16} color="#16a34a" />
          </div>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', fontWeight: 700 }}>
            R$ {valorTotalNfs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
        </div>

        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Custo Frete Reverso</p>
            <TrendingDown size={16} color="#ef4444" />
          </div>
          <h3 style={{ fontSize: '1.25rem', color: '#ef4444', fontWeight: 700 }}>
            R$ {custoFreteReverso.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
        </div>

        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Volume Retornando</p>
            <Package size={16} color="#8b5cf6" />
          </div>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', fontWeight: 700 }}>
            {volumeTotal.toLocaleString('pt-BR')} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>Cx</span>
          </h3>
        </div>

        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Peso Retornando</p>
            <Scale size={16} color="#eab308" />
          </div>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', fontWeight: 700 }}>
            {pesoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>Kg</span>
          </h3>
        </div>

        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Aguardando Chegada</p>
            <AlertCircle size={16} color="#ea580c" />
          </div>
          <h3 style={{ fontSize: '1.25rem', color: '#ea580c', fontWeight: 700 }}>
            {aguardandoChegada} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>NFs na rua</span>
          </h3>
        </div>
      </div>

      <div className="table-container" style={{ flex: 1, minHeight: 0, overflow: 'auto', position: 'relative', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'white' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={thStyle}>Dt Emissão</th><th style={thStyle}>Dt Coleta</th><th style={thStyle}>Cliente</th><th style={thStyle}>Transportadora</th><th style={thStyle}>NF Venda</th><th style={thStyle}>NFs (Devolução)</th><th style={thStyle}>Valor NFs</th><th style={thStyle}>Volume</th><th style={thStyle}>Peso (Kg)</th><th style={thStyle}>Custo Reverso</th><th style={thStyle}>Dt Previsão</th><th style={thStyle}>Dt Chegada</th><th style={thStyle}>Status</th><th style={thAcoesStyle}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {devolucoesFiltradas.length === 0 ? ( <tr><td colSpan={14} style={{ textAlign: 'center', padding: '32px' }}>Nenhuma devolução encontrada.</td></tr> ) : devolucoesFiltradas.map((dev) => (
              <tr key={dev.id} className="trow-hover">
                <td style={tdStyle}>{formatarData(dev.data_emissao)}</td><td style={tdStyle}>{formatarData(dev.data_coleta)}</td><td style={{ ...tdStyle, fontWeight: 'bold' }}>{dev.clientes?.nome || '-'}</td><td style={tdStyle}>{dev.transportadora_cliente || dev.transportadoras?.nome || '-'}</td><td style={{ ...tdStyle, color: 'var(--munila-blue)', fontWeight: 'bold' }}>{dev.nf_venda || '-'}</td><td style={{ ...tdStyle, fontWeight: 'bold' }}>{dev.notas_fiscais}</td><td style={tdStyle}>R$ {Number(dev.valor_total_nf).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td><td style={{ ...tdStyle, fontWeight: 'bold' }}>{dev.volume ? `${dev.volume} Cx` : '-'}</td><td style={{ ...tdStyle, fontWeight: 'bold' }}>{dev.peso_kg ? `${dev.peso_kg.toString().replace('.', ',')} Kg` : '-'}</td><td style={{ ...tdStyle, fontWeight: 'bold', color: '#ef4444' }}>R$ {Number(dev.valor_frete_reverso).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td><td style={tdStyle}>{formatarData(dev.data_previsao)}</td><td style={tdStyle}>{formatarData(dev.data_chegada)}</td><td style={tdStyle}><span className="status-badge" style={getStatusColor(dev.status)}>{dev.status}</span></td>
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
            
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.95rem' }}>Preenchimento Inteligente</h4>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Faça upload do XML da Nota Fiscal para autofill.</p>
              </div>
              <input type="file" accept=".xml" ref={xmlInputRef} onChange={handleXmlUpload} style={{ display: 'none' }} />
              <button type="button" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'white' }} onClick={() => xmlInputRef.current?.click()}>
                <UploadCloud size={16} /> Ler XML da Devolução
              </button>
            </div>

            <form onSubmit={handleDevolucaoSubmit}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group"><label>NF de Venda (Origem)</label><input type="text" className="form-input" placeholder="Ex: 12500" value={devolucaoFormData.nf_venda} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, nf_venda: e.target.value})} /></div>
                <div className="form-group"><label>NFs de Referência (Devolução)</label><input type="text" className="form-input" placeholder="Ex: 12661, 13196" required value={devolucaoFormData.notas_fiscais} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, notas_fiscais: e.target.value})} /></div>
                
                <div className="form-group" style={{ position: 'relative' }}>
                  <label>Cliente</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Digite o nome ou CNPJ..."
                    required={!devolucaoFormData.cliente_id}
                    value={buscaCliente}
                    onChange={(e) => {
                      setBuscaCliente(e.target.value);
                      setMostrarDropdownCliente(true);
                      setDevolucaoFormData({...devolucaoFormData, cliente_id: ''}); 
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
                            setDevolucaoFormData({...devolucaoFormData, cliente_id: c.id});
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

                <div className="form-group"><label>Transportadora (Texto Livre)</label><input type="text" className="form-input" placeholder="Ex: Correios do Cliente, Loggi, etc..." value={devolucaoFormData.transportadora_cliente} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, transportadora_cliente: e.target.value})} /></div>
                <div className="form-group"><label>Data de Emissão (NF Devolução)</label><input type="date" className="form-input" value={devolucaoFormData.data_emissao} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, data_emissao: e.target.value})} /></div>
                <div className="form-group"><label>Data da Coleta (Reversa)</label><input type="date" className="form-input" value={devolucaoFormData.data_coleta} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, data_coleta: e.target.value})} /></div>
                <div className="form-group"><label>Data de Previsão</label><input type="date" className="form-input" value={devolucaoFormData.data_previsao} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, data_previsao: e.target.value})} /></div>
                <div className="form-group"><label>Data de Chegada (Galpão)</label><input type="date" className="form-input" value={devolucaoFormData.data_chegada} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, data_chegada: e.target.value})} /></div>
                <div className="form-group"><label>Valor Total das NFs (R$)</label><input type="number" step="0.01" className="form-input" value={devolucaoFormData.valor_total_nf} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, valor_total_nf: e.target.value})} /></div>
                
                {/* CAMPO DE PESO COM MÁSCARA INTELIGENTE (Aceitar vírgula) */}
                <div className="form-group">
                  <label>Custo do Frete Reverso (R$)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-input" 
                    style={{ borderColor: '#ef4444' }} 
                    placeholder="Valor que a Munila vai pagar" 
                    value={devolucaoFormData.valor_frete_reverso} 
                    onChange={(e) => setDevolucaoFormData({...devolucaoFormData, valor_frete_reverso: e.target.value})} 
                  />
                </div>

                <div className="form-group"><label>Volume Retornando (Cx)</label><input type="number" className="form-input" placeholder="Ex: 2" value={devolucaoFormData.volume} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, volume: e.target.value})} /></div>
                
                {/* CAMPO DE PESO COM MÁSCARA INTELIGENTE (Aceitar vírgula) */}
                <div className="form-group">
                  <label>Peso Retornando (Kg)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ex: 1,5" 
                    value={devolucaoFormData.peso_kg} 
                    onChange={(e) => {
                      let valor = e.target.value.replace(/[^\d,]/g, '');
                      const partes = valor.split(',');
                      if (partes.length > 2) {
                        valor = partes[0] + ',' + partes.slice(1).join('');
                      }
                      setDevolucaoFormData({...devolucaoFormData, peso_kg: valor});
                    }} 
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Status da Devolução</label><select className="form-select" value={devolucaoFormData.status} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, status: e.target.value})}>
                  <option value="Pendente">Pendente</option>
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