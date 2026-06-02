import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { LayoutDashboard, Truck, RefreshCcw, X, Calculator, Package, Edit, DollarSign, TrendingUp, AlertCircle, Target, Users, Search, Download, LogOut, UserCircle, Trash2, Filter } from 'lucide-react';
import './index.css';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [entregas, setEntregas] = useState<any[]>([]);
  const [devolucoes, setDevolucoes] = useState<any[]>([]);
  const [perfis, setPerfis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // ==========================================
  // ESTADOS DE BUSCA E FILTROS AVANÇADOS
  // ==========================================
  const [searchTerm, setSearchTerm] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroTransportadora, setFiltroTransportadora] = useState('');
  const [filtroModal, setFiltroModal] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  
  const [clientes, setClientes] = useState<any[]>([]);
  const [transportadoras, setTransportadoras] = useState<any[]>([]);
  const [metas, setMetas] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nota_fiscal: '', cliente_id: '', transportadora_id: '', data_faturamento: '', data_coleta: '', 
    valor_nf: '', valor_frete: '', volume_peso: '', tem_agendamento: false, data_previsao: '', 
    data_entrega_agendamento: '', observacoes: '', status: 'Pendente'
  });

  const [isDevolucaoModalOpen, setIsDevolucaoModalOpen] = useState(false);
  const [devolucaoFormData, setDevolucaoFormData] = useState({
    data_coleta: '', cliente_id: '', transportadora_id: '', notas_fiscais: '',
    valor_total_nf: '', volume_peso: '', valor_frete_reverso: '', motivo: '', status: 'Aguardando Chegada'
  });

  const [isTranspModalOpen, setIsTranspModalOpen] = useState(false);
  const [editingTranspId, setEditingTranspId] = useState<string | null>(null);
  const [transpFormData, setTranspFormData] = useState({ nome: '', modal_padrao: '' });

  const [isClienteModalOpen, setIsClienteModalOpen] = useState(false);
  const [editingClienteId, setEditingClienteId] = useState<string | null>(null);
  const [clienteFormData, setClienteFormData] = useState({ nome: '', cidade: '', uf: '' });
  
  const [isMetaModalOpen, setIsMetaModalOpen] = useState(false);
  const [metaFormData, setMetaFormData] = useState({ cliente_id: '', transportadora_id: '', meta_percentual: '' });

  const [isPerfilModalOpen, setIsPerfilModalOpen] = useState(false);
  const [perfilFormData, setPerfilFormData] = useState({ nome: '', email: '', cargo: '', nivel_acesso: 'Operador' });

  const [calcProdutoId, setCalcProdutoId] = useState('');
  const [calcQuantidade, setCalcQuantidade] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthInitialized(true);
      if (session) carregarDadosDoBanco();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) carregarDadosDoBanco();
    });

    return () => subscription.unsubscribe();
  }, []);

  function carregarDadosDoBanco() {
    setLoading(true);
    buscarEntregas();
    buscarDevolucoes();
    buscarDominios();
    buscarPerfis();
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
      if (error) throw error;
    } catch (error: any) { alert("Erro ao iniciar sessão. Verifique as suas credenciais."); } finally { setLoginLoading(false); }
  }

  async function handleLogout() { await supabase.auth.signOut(); }

  if (!authInitialized) return null;

  if (!session) {
    return (
      <div className="login-container">
        <div className="login-box">
          <div className="login-header"><h1>MunilaLog</h1><p>Sistema de Acompanhamento Logístico</p></div>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group"><label>Email</label><input type="email" className="form-input" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="exemplo@munila.com.br"/></div>
            <div className="form-group"><label>Palavra-passe</label><input type="password" className="form-input" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} /></div>
            <button type="submit" className="btn-primary" style={{ justifyContent: 'center', marginTop: '8px' }} disabled={loginLoading}>{loginLoading ? 'A Entrar...' : 'Iniciar Sessão'}</button>
          </form>
        </div>
      </div>
    );
  }

  async function buscarEntregas() {
    try {
      const { data, error } = await supabase.from('entregas').select('*, clientes (nome, cidade, uf), transportadoras (nome, modal_padrao)').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setEntregas(data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }

  async function buscarDevolucoes() {
    try {
      const { data, error } = await supabase.from('devolucoes').select('*, clientes (nome), transportadoras (nome)').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setDevolucoes(data);
    } catch (error) { console.error(error); }
  }

  async function buscarDominios() {
    const { data: clientesData } = await supabase.from('clientes').select('*').order('nome');
    const { data: transpData } = await supabase.from('transportadoras').select('*').order('nome');
    const { data: metasData } = await supabase.from('metas_frete').select('*, clientes (nome), transportadoras (nome)');
    const { data: produtosData } = await supabase.from('produtos').select('*').order('nome');
    if (clientesData) setClientes(clientesData);
    if (transpData) setTransportadoras(transpData);
    if (metasData) setMetas(metasData);
    if (produtosData) setProdutos(produtosData);
  }

  async function buscarPerfis() {
    try {
      const { data, error } = await supabase.from('perfis').select('*').order('nome');
      if (error) throw error;
      if (data) setPerfis(data);
    } catch (error) { console.error(error); }
  }

  function abrirModalNovaEntrega() {
    setEditingId(null);
    setFormData({ nota_fiscal: '', cliente_id: '', transportadora_id: '', data_faturamento: '', data_coleta: '', valor_nf: '', valor_frete: '', volume_peso: '', tem_agendamento: false, data_previsao: '', data_entrega_agendamento: '', observacoes: '', status: 'Pendente' });
    setIsModalOpen(true);
  }

  function abrirModalEdicao(entrega: any) {
    setEditingId(entrega.id);
    setFormData({
      nota_fiscal: entrega.nota_fiscal, cliente_id: entrega.cliente_id, transportadora_id: entrega.transportadora_id,
      data_faturamento: entrega.data_faturamento || '', data_coleta: entrega.data_coleta || '', valor_nf: entrega.valor_nf?.toString() || '',
      valor_frete: entrega.valor_frete?.toString() || '', volume_peso: entrega.volume_peso || '', tem_agendamento: entrega.tem_agendamento || false,
      data_previsao: entrega.data_previsao || '', data_entrega_agendamento: entrega.data_entrega_agendamento || '', observacoes: entrega.observacoes || '', status: entrega.status
    });
    setIsModalOpen(true);
  }

  function abrirModalNovaDevolucao() {
    setDevolucaoFormData({ data_coleta: '', cliente_id: '', transportadora_id: '', notas_fiscais: '', valor_total_nf: '', volume_peso: '', valor_frete_reverso: '', motivo: '', status: 'Aguardando Chegada' });
    setIsDevolucaoModalOpen(true);
  }

  function abrirModalNovaTransportadora() { setEditingTranspId(null); setTranspFormData({ nome: '', modal_padrao: '' }); setIsTranspModalOpen(true); }
  function abrirModalEdicaoTransportadora(transp: any) { setEditingTranspId(transp.id); setTranspFormData({ nome: transp.nome, modal_padrao: transp.modal_padrao || '' }); setIsTranspModalOpen(true); }
  function abrirModalNovoCliente() { setEditingClienteId(null); setClienteFormData({ nome: '', cidade: '', uf: '' }); setIsClienteModalOpen(true); }
  function abrirModalEdicaoCliente(cliente: any) { setEditingClienteId(cliente.id); setClienteFormData({ nome: cliente.nome, cidade: cliente.cidade || '', uf: cliente.uf || '' }); setIsClienteModalOpen(true); }
  function abrirModalNovaMeta() { setMetaFormData({ cliente_id: '', transportadora_id: '', meta_percentual: '' }); setIsMetaModalOpen(true); }
  function abrirModalNovoPerfil() { setPerfilFormData({ nome: '', email: '', cargo: '', nivel_acesso: 'Operador' }); setIsPerfilModalOpen(true); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nf = parseFloat(formData.valor_nf) || 0;
    const frete = parseFloat(formData.valor_frete) || 0;
    if (nf > 0 && frete > 0) {
      const percentualCalculado = (frete / nf) * 100;
      const metaAplicavel = metas.find(m => m.cliente_id === formData.cliente_id && m.transportadora_id === formData.transportadora_id);
      if (metaAplicavel && percentualCalculado > metaAplicavel.meta_percentual) {
        const desejaProsseguir = window.confirm(`⚠️ ALERTA DE AUDITORIA DE FRETE!\n\nO custo deste frete representa ${percentualCalculado.toFixed(2)}% do valor da NF.\nA meta máxima cadastrada é de ${metaAplicavel.meta_percentual}%.\n\nComo este valor pode ter sido negociado comercialmente, deseja prosseguir e salvar esta nota mesmo assim?`);
        if (!desejaProsseguir) return; 
      }
    }
    const payload = {
      nota_fiscal: formData.nota_fiscal, cliente_id: formData.cliente_id, transportadora_id: formData.transportadora_id,
      data_faturamento: formData.data_faturamento || null, data_coleta: formData.data_coleta || null, valor_nf: nf,
      valor_frete: frete, volume_peso: formData.volume_peso, tem_agendamento: formData.tem_agendamento,
      data_previsao: formData.data_previsao || null, data_entrega_agendamento: formData.data_entrega_agendamento || null,
      observacoes: formData.observacoes, status: formData.status
    };
    try {
      if (editingId) {
        const { data, error } = await supabase.from('entregas').update([payload]).eq('id', editingId).select('*, clientes (nome, cidade, uf), transportadoras (nome, modal_padrao)');
        if (error) throw error;
        if (data) { setEntregas(entregas.map(e => e.id === editingId ? data[0] : e)); setIsModalOpen(false); }
      } else {
        const { data, error } = await supabase.from('entregas').insert([payload]).select('*, clientes (nome, cidade, uf), transportadoras (nome, modal_padrao)');
        if (error) throw error;
        if (data) { setEntregas([data[0], ...entregas]); setIsModalOpen(false); }
      }
    } catch (error) { alert("Erro ao salvar a entrega."); }
  }

  async function handleDevolucaoSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        data_coleta: devolucaoFormData.data_coleta || null, cliente_id: devolucaoFormData.cliente_id, transportadora_id: devolucaoFormData.transportadora_id,
        notas_fiscais: devolucaoFormData.notas_fiscais, valor_total_nf: parseFloat(devolucaoFormData.valor_total_nf) || 0,
        volume_peso: devolucaoFormData.volume_peso, valor_frete_reverso: parseFloat(devolucaoFormData.valor_frete_reverso) || 0,
        motivo: devolucaoFormData.motivo, status: devolucaoFormData.status
      };
      const { data, error } = await supabase.from('devolucoes').insert([payload]).select('*, clientes (nome), transportadoras (nome)');
      if (error) throw error;
      if (data) { setDevolucoes([data[0], ...devolucoes]); setIsDevolucaoModalOpen(false); }
    } catch (error) { console.error(error); alert("Erro ao salvar a logística reversa."); }
  }

  async function handleTranspSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { nome: transpFormData.nome.toUpperCase(), modal_padrao: transpFormData.modal_padrao };
    try {
      if (editingTranspId) {
        const { data, error } = await supabase.from('transportadoras').update([payload]).eq('id', editingTranspId).select('*');
        if (error) throw error;
        if (data) { setTransportadoras(transportadoras.map(t => t.id === editingTranspId ? data[0] : t).sort((a, b) => a.nome.localeCompare(b.nome))); setIsTranspModalOpen(false); }
      } else {
        const { data, error } = await supabase.from('transportadoras').insert([payload]).select('*');
        if (error) throw error;
        if (data) { setTransportadoras([...transportadoras, data[0]].sort((a, b) => a.nome.localeCompare(b.nome))); setIsTranspModalOpen(false); }
      }
    } catch (error) { console.error(error); alert("Erro ao salvar transportadora."); }
  }

  async function handleDeleteTransportadora(id: string) {
    if (!window.confirm("Tem certeza que deseja excluir esta transportadora?")) return;
    try {
      const { error } = await supabase.from('transportadoras').delete().eq('id', id);
      if (error) {
        if (error.code === '23503') alert("Não é possível excluir! Esta transportadora já possui notas fiscais ou metas vinculadas a ela.");
        else throw error;
      } else { setTransportadoras(transportadoras.filter(t => t.id !== id)); }
    } catch (error) { console.error(error); alert("Erro ao excluir transportadora."); }
  }

  async function handleClienteSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { nome: clienteFormData.nome.toUpperCase(), cidade: clienteFormData.cidade.toUpperCase(), uf: clienteFormData.uf.toUpperCase() };
    try {
      if (editingClienteId) {
        const { data, error } = await supabase.from('clientes').update([payload]).eq('id', editingClienteId).select('*');
        if (error) throw error;
        if (data) { setClientes(clientes.map(c => c.id === editingClienteId ? data[0] : c).sort((a, b) => a.nome.localeCompare(b.nome))); setIsClienteModalOpen(false); }
      } else {
        const { data, error } = await supabase.from('clientes').insert([payload]).select('*');
        if (error) throw error;
        if (data) { setClientes([...clientes, data[0]].sort((a, b) => a.nome.localeCompare(b.nome))); setIsClienteModalOpen(false); }
      }
    } catch (error) { console.error(error); alert("Erro ao salvar cliente."); }
  }

  async function handleDeleteCliente(id: string) {
    if (!window.confirm("Tem certeza que deseja excluir este cliente?")) return;
    try {
      const { error } = await supabase.from('clientes').delete().eq('id', id);
      if (error) {
        if (error.code === '23503') alert("Não é possível excluir! Este cliente já possui notas fiscais ou metas vinculadas a ele.");
        else throw error;
      } else { setClientes(clientes.filter(c => c.id !== id)); }
    } catch (error) { console.error(error); alert("Erro ao excluir cliente."); }
  }

  async function handleMetaSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { data, error } = await supabase.from('metas_frete').insert([{ cliente_id: metaFormData.cliente_id, transportadora_id: metaFormData.transportadora_id, meta_percentual: parseFloat(metaFormData.meta_percentual) }]).select('*, clientes (nome), transportadoras (nome)');
      if (error) {
        if (error.code === '23505') alert("Já existe uma meta de frete cadastrada para esta Transportadora com este Cliente.");
        else throw error;
      } else if (data) { setMetas([...metas, data[0]]); setIsMetaModalOpen(false); }
    } catch (error) { console.error(error); alert("Erro ao cadastrar meta de frete."); }
  }

  async function handlePerfilSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { data, error } = await supabase.from('perfis').insert([{ nome: perfilFormData.nome, email: perfilFormData.email.toLowerCase(), cargo: perfilFormData.cargo, nivel_acesso: perfilFormData.nivel_acesso }]).select('*');
      if (error) {
        if (error.code === '23505') alert("Este e-mail já está cadastrado.");
        else throw error;
      } else if (data) { setPerfis([...perfis, data[0]].sort((a, b) => a.nome.localeCompare(b.nome))); setIsPerfilModalOpen(false); }
    } catch (error) { console.error(error); alert("Erro ao cadastrar funcionário."); }
  }

  const calcularPorcentagemFrete = (frete: number, nf: number) => {
    if (!frete || !nf || nf === 0) return '0.00%';
    return ((frete / nf) * 100).toFixed(2) + '%';
  };

  const calcularDiasEntrega = (coleta: string, entrega: string) => {
    if (!coleta || !entrega) return '-';
    const diffTime = Math.abs(new Date(entrega).getTime() - new Date(coleta).getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + ' dias';
  };

  const formatarData = (dataStr: string) => {
    if (!dataStr) return '-';
    const data = new Date(dataStr);
    data.setMinutes(data.getMinutes() + data.getTimezoneOffset());
    return data.toLocaleDateString('pt-BR');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Entregue': return { backgroundColor: '#dcfce7', color: '#166534' }; 
      case 'Atrasado': return { backgroundColor: '#fee2e2', color: '#991b1b' }; 
      case 'Em Transporte': return { backgroundColor: '#e0f2fe', color: '#075985' }; 
      case 'Agendado': return { backgroundColor: '#f3e8ff', color: '#6b21a8' }; 
      case 'Pendente': return { backgroundColor: '#ffedd5', color: '#9a3412' }; 
      case 'Aguardando Chegada': return { backgroundColor: '#fef3c7', color: '#92400e' };
      case 'Chegou no Galpão': return { backgroundColor: '#d1fae5', color: '#065f46' };
      default: return { backgroundColor: '#f1f5f9', color: '#334155' };
    }
  };

  function limparFiltros() {
    setSearchTerm(''); setFiltroDataInicio(''); setFiltroDataFim(''); setFiltroTransportadora(''); setFiltroModal(''); setFiltroStatus('');
  }

  // ==========================================
  // LÓGICA DE FILTRAGEM MULTIPLA APLICADA
  // ==========================================
  const entregasFiltradas = entregas.filter(entrega => {
    // 1. Filtro de Texto (Barra de Pesquisa)
    const termo = searchTerm.toLowerCase();
    const nf = entrega.nota_fiscal?.toLowerCase() || '';
    const cliente = entrega.clientes?.nome?.toLowerCase() || '';
    const statusText = entrega.status?.toLowerCase() || '';
    const transpNome = entrega.transportadoras?.nome?.toLowerCase() || '';
    const passaTexto = nf.includes(termo) || cliente.includes(termo) || statusText.includes(termo) || transpNome.includes(termo);

    // 2. Filtro de Data de Faturamento
    let passaData = true;
    if (filtroDataInicio && entrega.data_faturamento < filtroDataInicio) passaData = false;
    if (filtroDataFim && entrega.data_faturamento > filtroDataFim) passaData = false;

    // 3. Filtro Transportadora Específica
    const passaTransp = filtroTransportadora ? entrega.transportadora_id === filtroTransportadora : true;

    // 4. Filtro por Modal
    const passaModal = filtroModal ? entrega.transportadoras?.modal_padrao === filtroModal : true;

    // 5. Filtro por Status
    const passaStatus = filtroStatus ? entrega.status === filtroStatus : true;

    // Retorna a linha apenas se ela passar em TODOS os filtros ativos
    return passaTexto && passaData && passaTransp && passaModal && passaStatus;
  });

  const exportarParaExcel = () => {
    if (entregasFiltradas.length === 0) { alert("Não há dados para exportar."); return; }
    const cabecalho = ["Data Fat.", "Coleta", "Cliente", "Cidade", "UF", "Vol/Peso", "Nº NF", "Valor NF", "Transportadora", "Modal", "Valor Frete", "% Frete", "Agendamento", "Previsão", "Dt Entrega", "Dias", "Status", "Observações"].join(";");
    const linhas = entregasFiltradas.map(e => [
      formatarData(e.data_faturamento), formatarData(e.data_coleta), e.clientes?.nome || '-', e.clientes?.cidade || '-', e.clientes?.uf || '-',
      e.volume_peso || '-', e.nota_fiscal, e.valor_nf?.toString().replace('.', ',') || '0,00', e.transportadoras?.nome || '-', e.transportadoras?.modal_padrao || '-',
      e.valor_frete?.toString().replace('.', ',') || '0,00', calcularPorcentagemFrete(e.valor_frete, e.valor_nf), e.tem_agendamento ? 'SIM' : 'NÃO',
      formatarData(e.data_previsao), formatarData(e.data_entrega_agendamento), calcularDiasEntrega(e.data_coleta, e.data_entrega_agendamento).replace(' dias', ''), e.status, e.observacoes || '-'
    ].join(";"));
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + cabecalho + "\n" + linhas.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `MunilaLog_Exportacao_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==========================================
  // KPIS DINÂMICOS (Baseados nos Filtros Ativos)
  // ==========================================
  const faturamentoTotal = entregasFiltradas.reduce((acc, curr) => acc + (Number(curr.valor_nf) || 0), 0);
  const freteTotal = entregasFiltradas.reduce((acc, curr) => acc + (Number(curr.valor_frete) || 0), 0);
  const freteMedio = faturamentoTotal > 0 ? ((freteTotal / faturamentoTotal) * 100).toFixed(2) : '0.00';
  const atrasados = entregasFiltradas.filter(e => e.status === 'Atrasado').length;
  
  const metaAnual = 25000000;
  const progressoMeta = ((faturamentoTotal / metaAnual) * 100).toFixed(2);
  
  const produtoSelecionado = produtos.find(p => p.id === calcProdutoId);
  const quantidadeDesejada = parseInt(calcQuantidade) || 0;
  let totalCaixas = 0; let pesoTotal = "0.00";
  if (produtoSelecionado && quantidadeDesejada > 0) {
    totalCaixas = Math.ceil(quantidadeDesejada / produtoSelecionado.unidades_por_caixa);
    pesoTotal = (totalCaixas * produtoSelecionado.peso_caixa_kg).toFixed(2);
  }

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header"><h1>MunilaLog</h1></div>
        <nav className="sidebar-nav" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <ul className="nav-list">
            <li className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}><LayoutDashboard size={20} /> Painel Principal</li>
            <li className={`nav-item ${activeTab === 'equipe' ? 'active' : ''}`} onClick={() => setActiveTab('equipe')}><UserCircle size={20} /> Equipe</li>
            <li className={`nav-item ${activeTab === 'clientes' ? 'active' : ''}`} onClick={() => setActiveTab('clientes')}><Users size={20} /> Clientes & Metas</li>
            <li className={`nav-item ${activeTab === 'transportadoras' ? 'active' : ''}`} onClick={() => setActiveTab('transportadoras')}><Truck size={20} /> Transportadoras</li>
            <li className={`nav-item ${activeTab === 'devolucoes' ? 'active' : ''}`} onClick={() => setActiveTab('devolucoes')}><RefreshCcw size={20} /> Devoluções</li>
            <li className={`nav-item ${activeTab === 'dpsp' ? 'active' : ''}`} onClick={() => setActiveTab('dpsp')}><Calculator size={20} /> Calculadora DPSP</li>
          </ul>
          <button className="btn-logout" onClick={handleLogout}><LogOut size={20} /> Terminar Sessão</button>
        </nav>
      </aside>

      <main className="main-content">
        
        {/* ABA: PAINEL PRINCIPAL */}
        {activeTab === 'dashboard' && (
          <>
            <header className="header" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-start' }}>
                <div><h2>Acompanhamento Logístico</h2><p>Gerenciamento de entregas de 2026</p></div>
                
                {/* BOTÕES DE CONTROLE SUPERIORES */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    <input type="text" placeholder="Buscar NF, Cliente ou Status..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ padding: '10px 12px 10px 38px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', width: '220px' }} />
                  </div>
                  <button className="btn-secondary" onClick={() => setMostrarFiltros(!mostrarFiltros)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Filter size={18} /> Filtros
                  </button>
                  <button className="btn-secondary" onClick={exportarParaExcel} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Download size={18} /> Exportar
                  </button>
                  <button className="btn-primary" onClick={abrirModalNovaEntrega}>+ Nova Entrega</button>
                </div>
              </div>

              {/* BARRA DE FILTROS AVANÇADOS (Toggle) */}
              {mostrarFiltros && (
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Data Início (Fat.)</label>
                    <input type="date" className="form-input" style={{ padding: '8px' }} value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Data Fim (Fat.)</label>
                    <input type="date" className="form-input" style={{ padding: '8px' }} value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Transportadora</label>
                    <select className="form-select" style={{ padding: '8px', width: '180px' }} value={filtroTransportadora} onChange={(e) => setFiltroTransportadora(e.target.value)}>
                      <option value="">Todas as Transp.</option>
                      {transportadoras.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                    </select>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Modal</label>
                    <select className="form-select" style={{ padding: '8px', width: '150px' }} value={filtroModal} onChange={(e) => setFiltroModal(e.target.value)}>
                      <option value="">Todos</option>
                      <option value="AÉREO">Aéreo</option>
                      <option value="RODOVIÁRIO">Rodoviário</option>
                      <option value="PAC">PAC</option>
                      <option value="SEDEX">Sedex</option>
                    </select>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Status da Entrega</label>
                    <select className="form-select" style={{ padding: '8px', width: '150px' }} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
                      <option value="">Todos</option>
                      <option value="Pendente">Pendente</option>
                      <option value="Agendado">Agendado</option>
                      <option value="Em Transporte">Em Transporte</option>
                      <option value="Entregue">Entregue</option>
                      <option value="Atrasado">Atrasado</option>
                    </select>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'flex-end', marginLeft: 'auto' }}>
                     <button className="btn-secondary" onClick={limparFiltros} style={{ padding: '8px 16px', color: '#ef4444', borderColor: '#ef4444' }}>
                        Limpar Filtros
                     </button>
                  </div>

                </div>
              )}
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
              <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}><p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>Faturamento Despachado</p><DollarSign size={20} color="#16a34a" /></div>
                <h3 style={{ fontSize: '1.75rem', color: 'var(--text-main)', marginBottom: '8px' }}>R$ {faturamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                <div style={{ width: '100%', backgroundColor: '#f1f5f9', borderRadius: '4px', height: '6px', marginBottom: '4px' }}><div style={{ width: `${Math.min(Number(progressoMeta), 100)}%`, backgroundColor: '#16a34a', height: '100%', borderRadius: '4px' }}></div></div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{progressoMeta}% da Meta Anual</p>
              </div>
              <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}><p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>Custo Logístico (Frete)</p><TrendingUp size={20} color="#ea580c" /></div>
                <h3 style={{ fontSize: '1.75rem', color: 'var(--text-main)' }}>R$ {freteTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
              </div>
              <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}><p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>% Frete Médio</p><Target size={20} color="var(--munila-blue)" /></div>
                <h3 style={{ fontSize: '1.75rem', color: 'var(--munila-blue)' }}>{freteMedio}%</h3>
              </div>
              <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}><p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>Entregas em Atraso</p><AlertCircle size={20} color="#dc2626" /></div>
                <h3 style={{ fontSize: '1.75rem', color: '#dc2626' }}>{atrasados} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>NFs</span></h3>
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Data Fat.</th><th>Coleta</th><th>Cliente</th><th>Cidade</th><th>UF</th>
                    <th>Vol/Peso</th><th>Nº NF</th><th>Valor NF</th><th>Transportadora</th><th>Modal</th>
                    <th>Valor Frete</th><th>% Frete</th><th>Agendamento?</th><th>Previsão</th>
                    <th>Dt Entrega</th><th>Dias</th><th>Status</th><th>Obs</th>
                    <th style={{ textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? ( <tr><td colSpan={19} style={{ textAlign: 'center', padding: '32px' }}>A carregar...</td></tr> ) : 
                  entregasFiltradas.length === 0 ? (
                    <tr><td colSpan={19} style={{ textAlign: 'center', padding: '32px' }}>Nenhuma entrega encontrada na busca.</td></tr>
                  ) : entregasFiltradas.map((entrega) => (
                    <tr key={entrega.id}>
                      <td>{formatarData(entrega.data_faturamento)}</td><td>{formatarData(entrega.data_coleta)}</td>
                      <td>{entrega.clientes?.nome || '-'}</td><td>{entrega.clientes?.cidade || '-'}</td><td>{entrega.clientes?.uf || '-'}</td>
                      <td style={{ fontWeight: 'bold' }}>{entrega.volume_peso || '-'}</td><td style={{ fontWeight: 'bold' }}>{entrega.nota_fiscal}</td>
                      <td>R$ {Number(entrega.valor_nf).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td>{entrega.transportadoras?.nome || '-'}</td><td>{entrega.transportadoras?.modal_padrao || '-'}</td>
                      <td>R$ {Number(entrega.valor_frete).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td style={{ fontWeight: 'bold', color: '#0095DA' }}>{calcularPorcentagemFrete(entrega.valor_frete, entrega.valor_nf)}</td>
                      <td>{entrega.tem_agendamento ? 'SIM' : 'NÃO'}</td><td>{formatarData(entrega.data_previsao)}</td>
                      <td>{formatarData(entrega.data_entrega_agendamento)}</td><td>{calcularDiasEntrega(entrega.data_coleta, entrega.data_entrega_agendamento)}</td>
                      <td><span className="status-badge" style={getStatusColor(entrega.status)}>{entrega.status}</span></td>
                      <td>{entrega.observacoes || '-'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button onClick={() => abrirModalEdicao(entrega)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }} title="Editar Entrega"><Edit size={18} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ABA: EQUIPE */}
        {activeTab === 'equipe' && (
          <>
            <header className="header">
              <div><h2>Gestão de Equipe</h2><p>Controlo de acessos e perfis operacionais</p></div>
              <button className="btn-primary" onClick={abrirModalNovoPerfil}>+ Novo Funcionário</button>
            </header>
            <div className="table-container" style={{ maxWidth: '900px' }}>
              <table>
                <thead><tr><th>Nome</th><th>E-mail (Login)</th><th>Cargo</th><th>Nível de Acesso</th></tr></thead>
                <tbody>
                  {perfis.map((perfil) => (
                    <tr key={perfil.id}>
                      <td style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{perfil.nome}</td>
                      <td>{perfil.email}</td>
                      <td>{perfil.cargo || '-'}</td>
                      <td>
                        <span className="status-badge" style={{ backgroundColor: perfil.nivel_acesso === 'Administrador' ? '#f3e8ff' : '#f1f5f9', color: perfil.nivel_acesso === 'Administrador' ? '#6b21a8' : '#334155' }}>
                          {perfil.nivel_acesso}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ABA: CLIENTES E METAS */}
        {activeTab === 'clientes' && (
          <>
            <header className="header">
              <div><h2>Gestão de Clientes & Metas de Frete</h2><p>Base de parceiros e margens logísticas autorizadas</p></div>
              <div style={{ display: 'flex', gap: '12px' }}><button className="btn-secondary" onClick={abrirModalNovoCliente}>+ Novo Cliente</button><button className="btn-primary" onClick={abrirModalNovaMeta}>+ Nova Meta Logística</button></div>
            </header>
            <div className="table-container">
              <table>
                <thead><tr><th>Nome do Cliente</th><th>Cidade / UF</th><th>Regras de Frete Ativas (Metas %)</th><th style={{ textAlign: 'center' }}>Ações</th></tr></thead>
                <tbody>
                  {clientes.map((cliente) => {
                    const metasDoCliente = metas.filter(m => m.cliente_id === cliente.id);
                    return (
                      <tr key={cliente.id}>
                        <td style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{cliente.nome}</td><td>{cliente.cidade} - {cliente.uf}</td>
                        <td>
                          {metasDoCliente.length === 0 ? <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhuma meta</span> : (
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {metasDoCliente.map(meta => (
                                <span key={meta.id} className="status-badge" style={{ backgroundColor: 'var(--munila-light)', color: 'var(--munila-blue)', border: '1px solid var(--munila-blue)' }}>
                                  {meta.transportadoras?.nome}: <strong>{meta.meta_percentual}%</strong>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                          <button onClick={() => abrirModalEdicaoCliente(cliente)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }} title="Editar Cliente"><Edit size={18} /></button>
                          <button onClick={() => handleDeleteCliente(cliente.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }} title="Excluir Cliente"><Trash2 size={18} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ABA: TRANSPORTADORAS */}
        {activeTab === 'transportadoras' && (
          <>
            <header className="header">
              <div><h2>Gestão de Transportadoras</h2><p>Cadastro de parceiros logísticos e modais operacionais</p></div>
              <button className="btn-primary" onClick={abrirModalNovaTransportadora}>+ Nova Transportadora</button>
            </header>
            <div className="table-container" style={{ maxWidth: '800px' }}>
              <table>
                <thead><tr><th>Nome da Transportadora</th><th>Modal de Envio Padrão</th><th>Qtd de Entregas Realizadas</th><th style={{ textAlign: 'center' }}>Ações</th></tr></thead>
                <tbody>
                  {transportadoras.map((transp) => {
                    const qtdEntregas = entregas.filter(e => e.transportadora_id === transp.id).length;
                    return (
                      <tr key={transp.id}>
                        <td style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{transp.nome}</td>
                        <td><span className="status-badge" style={{ backgroundColor: '#f1f5f9' }}>{transp.modal_padrao || 'Não definido'}</span></td>
                        <td>{qtdEntregas} entregas</td>
                        <td style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                          <button onClick={() => abrirModalEdicaoTransportadora(transp)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }} title="Editar Transportadora"><Edit size={18} /></button>
                          <button onClick={() => handleDeleteTransportadora(transp.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }} title="Excluir Transportadora"><Trash2 size={18} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ABA: DEVOLUÇÕES */}
        {activeTab === 'devolucoes' && (
          <>
            <header className="header">
              <div><h2>Logística Reversa (Devoluções)</h2><p>Auditoria de coletas e custos de frete reverso</p></div>
              <button className="btn-primary" onClick={abrirModalNovaDevolucao}>+ Nova Devolução</button>
            </header>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Data Coleta</th><th>Cliente</th><th>Transportadora</th><th>NFs Referência</th>
                    <th>Valor NFs (R$)</th><th>Vol/Peso</th><th>Custo Reverso (R$)</th><th>Motivo da Devolução</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {devolucoes.length === 0 ? ( <tr><td colSpan={9} style={{ textAlign: 'center', padding: '32px' }}>Nenhuma devolução registada.</td></tr> ) : devolucoes.map((dev) => (
                    <tr key={dev.id}>
                      <td>{formatarData(dev.data_coleta)}</td><td style={{ fontWeight: 'bold' }}>{dev.clientes?.nome || '-'}</td>
                      <td>{dev.transportadoras?.nome || '-'}</td><td style={{ fontWeight: 'bold' }}>{dev.notas_fiscais}</td>
                      <td>R$ {Number(dev.valor_total_nf).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td>{dev.volume_peso || '-'}</td>
                      <td style={{ fontWeight: 'bold', color: '#ef4444' }}>R$ {Number(dev.valor_frete_reverso).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td style={{ maxWidth: '300px', whiteSpace: 'normal', fontSize: '0.85rem' }}>{dev.motivo || '-'}</td>
                      <td><span className="status-badge" style={getStatusColor(dev.status)}>{dev.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ABA: CALCULADORA DPSP */}
        {activeTab === 'dpsp' && (
          <>
            <header className="header">
              <div><h2>Calculadora Volumétrica - Grandes Redes</h2><p>Auditoria de peso e caixaria automática para faturamento</p></div>
            </header>
            <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
              <div className="table-container" style={{ flex: 1, padding: '24px', overflow: 'hidden' }}>
                <h3 style={{ marginBottom: '24px', color: 'var(--text-main)' }}>Dados do Pedido</h3>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label>Selecione o Produto</label>
                  <select className="form-select" value={calcProdutoId} onChange={(e) => setCalcProdutoId(e.target.value)}>
                    <option value="">-- Escolha um produto do catálogo --</option>
                    {produtos.map(p => ( <option key={p.id} value={p.id}>{p.codigo} - {p.nome}</option> ))}
                  </select>
                </div>
                <div className="form-group"><label>Quantidade Solicitada (Unidades)</label><input type="number" className="form-input" placeholder="Ex: 350" value={calcQuantidade} onChange={(e) => setCalcQuantidade(e.target.value)} /></div>
              </div>
              <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', color: 'var(--munila-blue)' }}><Package size={28} /><h3 style={{ fontSize: '1.25rem' }}>Resultado para NFe</h3></div>
                {produtoSelecionado ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                    <div style={{ padding: '16px', backgroundColor: '#f1f5f9', borderRadius: '8px' }}><p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Volume Total (Caixaria)</p><p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{totalCaixas} <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>caixa(s)</span></p></div>
                    <div style={{ padding: '16px', backgroundColor: '#f1f5f9', borderRadius: '8px' }}><p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Peso Bruto Total</p><p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{pesoTotal} <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>KG</span></p></div>
                    <div style={{ padding: '16px', backgroundColor: 'var(--munila-light)', borderRadius: '8px', border: '1px solid var(--munila-blue)' }}><p style={{ fontSize: '0.875rem', color: 'var(--munila-dark)', fontWeight: 600, textTransform: 'uppercase' }}>Preenchimento da Coluna VOL/PESO</p><p style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--munila-blue)', marginTop: '4px' }}>{totalCaixas}CX {pesoTotal}KG</p><p style={{ fontSize: '0.85rem', color: 'var(--munila-dark)', marginTop: '8px' }}>Cubagem Padrão: {produtoSelecionado.medidas_cm}</p></div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}><Calculator size={48} style={{ opacity: 0.2, margin: '0 auto 16px auto' }} /><p>Selecione um produto e digite a quantidade para calcular o peso e volume automático.</p></div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* ========================================== */}
      {/* JANELAS MODAIS                             */}
      {/* ========================================== */}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header"><h3>{editingId ? 'Editar Entrega' : 'Cadastrar Nova Entrega'}</h3><button className="close-btn" onClick={() => setIsModalOpen(false)}><X size={24} /></button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group"><label>Número da NF</label><input type="text" className="form-input" required value={formData.nota_fiscal} onChange={(e) => setFormData({...formData, nota_fiscal: e.target.value})} /></div>
                <div className="form-group"><label>Cliente</label><select className="form-select" required value={formData.cliente_id} onChange={(e) => setFormData({...formData, cliente_id: e.target.value})}><option value="">Selecione...</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
                <div className="form-group"><label>Data de Faturamento</label><input type="date" className="form-input" value={formData.data_faturamento} onChange={(e) => setFormData({...formData, data_faturamento: e.target.value})} /></div>
                <div className="form-group"><label>Data de Coleta</label><input type="date" className="form-input" value={formData.data_coleta} onChange={(e) => setFormData({...formData, data_coleta: e.target.value})} /></div>
                <div className="form-group"><label>Valor da NF (R$)</label><input type="number" step="0.01" className="form-input" value={formData.valor_nf} onChange={(e) => setFormData({...formData, valor_nf: e.target.value})} /></div>
                <div className="form-group"><label>Volume / Peso</label><input type="text" className="form-input" placeholder="Ex: 1CX 20KG" value={formData.volume_peso} onChange={(e) => setFormData({...formData, volume_peso: e.target.value})} /></div>
                <div className="form-group"><label>Transportadora</label><select className="form-select" required value={formData.transportadora_id} onChange={(e) => setFormData({...formData, transportadora_id: e.target.value})}><option value="">Selecione...</option>{transportadoras.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></div>
                <div className="form-group">
                  <label>Status</label>
                  <select className="form-select" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                    <option value="Pendente">Pendente</option><option value="Agendado">Agendado</option><option value="Em Transporte">Em Transporte</option><option value="Entregue">Entregue</option><option value="Atrasado">Atrasado</option>
                  </select>
                </div>
                <div className="form-group"><label>Valor do Frete (R$)</label><input type="number" step="0.01" className="form-input" value={formData.valor_frete} onChange={(e) => setFormData({...formData, valor_frete: e.target.value})} /></div>
                <div className="form-group"><label>Previsão de Entrega</label><input type="date" className="form-input" value={formData.data_previsao} onChange={(e) => setFormData({...formData, data_previsao: e.target.value})} /></div>
                <div className="form-group"><label>Data Efetiva de Entrega</label><input type="date" className="form-input" value={formData.data_entrega_agendamento} onChange={(e) => setFormData({...formData, data_entrega_agendamento: e.target.value})} /></div>
                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '30px' }}><input type="checkbox" id="agendamento" checked={formData.tem_agendamento} onChange={(e) => setFormData({...formData, tem_agendamento: e.target.checked})} /><label htmlFor="agendamento" style={{ cursor: 'pointer' }}>Possui Agendamento?</label></div>
              </div>
              <div className="modal-body" style={{ paddingTop: 0 }}><div className="form-group"><label>Observações</label><input type="text" className="form-input" value={formData.observacoes} onChange={(e) => setFormData({...formData, observacoes: e.target.value})} /></div></div>
              <div className="modal-footer"><button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button><button type="submit" className="btn-primary">{editingId ? 'Atualizar Entrega' : 'Salvar Entrega'}</button></div>
            </form>
          </div>
        </div>
      )}

      {isDevolucaoModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header"><h3>Registrar Logística Reversa</h3><button className="close-btn" onClick={() => setIsDevolucaoModalOpen(false)}><X size={24} /></button></div>
            <form onSubmit={handleDevolucaoSubmit}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group"><label>NFs de Referência</label><input type="text" className="form-input" placeholder="Ex: 12661, 13196" required value={devolucaoFormData.notas_fiscais} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, notas_fiscais: e.target.value})} /></div>
                <div className="form-group"><label>Cliente</label><select className="form-select" required value={devolucaoFormData.cliente_id} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, cliente_id: e.target.value})}><option value="">Selecione...</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
                <div className="form-group"><label>Data da Coleta (Reversa)</label><input type="date" className="form-input" value={devolucaoFormData.data_coleta} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, data_coleta: e.target.value})} /></div>
                <div className="form-group"><label>Transportadora</label><select className="form-select" required value={devolucaoFormData.transportadora_id} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, transportadora_id: e.target.value})}><option value="">Selecione...</option>{transportadoras.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></div>
                <div className="form-group"><label>Valor Total das NFs (R$)</label><input type="number" step="0.01" className="form-input" value={devolucaoFormData.valor_total_nf} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, valor_total_nf: e.target.value})} /></div>
                <div className="form-group"><label>Custo do Frete Reverso (R$)</label><input type="number" step="0.01" className="form-input" style={{ borderColor: '#ef4444' }} placeholder="Valor que a Munila vai pagar" value={devolucaoFormData.valor_frete_reverso} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, valor_frete_reverso: e.target.value})} /></div>
                <div className="form-group"><label>Volume / Peso Retornando</label><input type="text" className="form-input" placeholder="Ex: 45 CX 52KG" value={devolucaoFormData.volume_peso} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, volume_peso: e.target.value})} /></div>
                <div className="form-group"><label>Status da Devolução</label><select className="form-select" value={devolucaoFormData.status} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, status: e.target.value})}><option value="Aguardando Chegada">Aguardando Chegada</option><option value="Em Transporte">Em Transporte</option><option value="Chegou no Galpão">Chegou no Galpão</option></select></div>
              </div>
              <div className="modal-body" style={{ paddingTop: 0 }}><div className="form-group"><label>Motivo da Devolução / Avaria</label><textarea className="form-input" rows={3} placeholder="Descreva o motivo (ex: validade curta, caixa rasgada, cliente recusou...)" value={devolucaoFormData.motivo} onChange={(e) => setDevolucaoFormData({...devolucaoFormData, motivo: e.target.value})} /></div></div>
              <div className="modal-footer"><button type="button" className="btn-secondary" onClick={() => setIsDevolucaoModalOpen(false)}>Cancelar</button><button type="submit" className="btn-primary" style={{ backgroundColor: '#ef4444' }}>Salvar Reversa</button></div>
            </form>
          </div>
        </div>
      )}

      {isTranspModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header"><h3>{editingTranspId ? 'Editar Transportadora' : 'Cadastrar Nova Transportadora'}</h3><button className="close-btn" onClick={() => setIsTranspModalOpen(false)}><X size={24} /></button></div>
            <form onSubmit={handleTranspSubmit}>
              <div className="modal-body">
                <div className="form-group"><label>Nome da Transportadora</label><input type="text" className="form-input" placeholder="Ex: BRASPRESS" required value={transpFormData.nome} onChange={(e) => setTranspFormData({...transpFormData, nome: e.target.value})} /></div>
                <div className="form-group"><label>Modal Padrão de Envio</label><select className="form-select" required value={transpFormData.modal_padrao} onChange={(e) => setTranspFormData({...transpFormData, modal_padrao: e.target.value})}><option value="">Selecione...</option><option value="AÉREO">Aéreo</option><option value="RODOVIÁRIO">Rodoviário</option><option value="PAC">PAC</option><option value="SEDEX">Sedex</option></select></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn-secondary" onClick={() => setIsTranspModalOpen(false)}>Cancelar</button><button type="submit" className="btn-primary">{editingTranspId ? 'Atualizar Parceiro' : 'Salvar Parceiro'}</button></div>
            </form>
          </div>
        </div>
      )}

      {isClienteModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header"><h3>{editingClienteId ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}</h3><button className="close-btn" onClick={() => setIsClienteModalOpen(false)}><X size={24} /></button></div>
            <form onSubmit={handleClienteSubmit}>
              <div className="modal-body">
                <div className="form-group"><label>Nome do Cliente / Rede</label><input type="text" className="form-input" placeholder="Ex: DROGA RAIA" required value={clienteFormData.nome} onChange={(e) => setClienteFormData({...clienteFormData, nome: e.target.value})} /></div>
                <div className="form-group"><label>Cidade</label><input type="text" className="form-input" placeholder="Ex: SÃO PAULO" required value={clienteFormData.cidade} onChange={(e) => setClienteFormData({...clienteFormData, cidade: e.target.value})} /></div>
                <div className="form-group"><label>UF</label><input type="text" className="form-input" placeholder="Ex: SP" maxLength={2} required value={clienteFormData.uf} onChange={(e) => setClienteFormData({...clienteFormData, uf: e.target.value})} /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn-secondary" onClick={() => setIsClienteModalOpen(false)}>Cancelar</button><button type="submit" className="btn-primary">{editingClienteId ? 'Atualizar Cliente' : 'Salvar Cliente'}</button></div>
            </form>
          </div>
        </div>
      )}

      {isMetaModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header"><h3>Cadastrar Meta de Frete</h3><button className="close-btn" onClick={() => setIsMetaModalOpen(false)}><X size={24} /></button></div>
            <form onSubmit={handleMetaSubmit}>
              <div className="modal-body">
                <div className="form-group"><label>Cliente</label><select className="form-select" required value={metaFormData.cliente_id} onChange={(e) => setMetaFormData({...metaFormData, cliente_id: e.target.value})}><option value="">Selecione o Cliente...</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
                <div className="form-group"><label>Transportadora</label><select className="form-select" required value={metaFormData.transportadora_id} onChange={(e) => setMetaFormData({...metaFormData, transportadora_id: e.target.value})}><option value="">Selecione a Transportadora...</option>{transportadoras.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></div>
                <div className="form-group"><label>Meta de Frete Autorizada (%)</label><input type="number" step="0.01" className="form-input" placeholder="Ex: 5.50" required value={metaFormData.meta_percentual} onChange={(e) => setMetaFormData({...metaFormData, meta_percentual: e.target.value})} /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn-secondary" onClick={() => setIsMetaModalOpen(false)}>Cancelar</button><button type="submit" className="btn-primary">Salvar Meta</button></div>
            </form>
          </div>
        </div>
      )}

      {isPerfilModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header"><h3>Cadastrar Novo Funcionário</h3><button className="close-btn" onClick={() => setIsPerfilModalOpen(false)}><X size={24} /></button></div>
            <form onSubmit={handlePerfilSubmit}>
              <div className="modal-body">
                <div className="form-group"><label>Nome Completo</label><input type="text" className="form-input" placeholder="Ex: João Silva" required value={perfilFormData.nome} onChange={(e) => setPerfilFormData({...perfilFormData, nome: e.target.value})} /></div>
                <div className="form-group"><label>E-mail (Usado para o Login)</label><input type="email" className="form-input" placeholder="joao@munila.com.br" required value={perfilFormData.email} onChange={(e) => setPerfilFormData({...perfilFormData, email: e.target.value})} /></div>
                <div className="form-group"><label>Cargo</label><input type="text" className="form-input" placeholder="Ex: Analista de Logística" required value={perfilFormData.cargo} onChange={(e) => setPerfilFormData({...perfilFormData, cargo: e.target.value})} /></div>
                <div className="form-group"><label>Nível de Acesso</label><select className="form-select" required value={perfilFormData.nivel_acesso} onChange={(e) => setPerfilFormData({...perfilFormData, nivel_acesso: e.target.value})}><option value="Operador">Operador (Uso diário)</option><option value="Administrador">Administrador (Gestão Total)</option></select></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn-secondary" onClick={() => setIsPerfilModalOpen(false)}>Cancelar</button><button type="submit" className="btn-primary">Salvar Perfil</button></div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}