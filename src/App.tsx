import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { Calculator, Package, Edit, Trash2, Phone, Mail, X, Search, Filter } from 'lucide-react';

import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Equipe } from './pages/Equipe';
import { Clientes } from './pages/Clientes';
import { ModalEntrega } from './modals/ModalEntrega';
import { ModalCliente } from './modals/ModalCliente';

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
  
  const [clientes, setClientes] = useState<any[]>([]);
  const [transportadoras, setTransportadoras] = useState<any[]>([]);
  const [metas, setMetas] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);

  // Filtros Dashboard
  const [searchTerm, setSearchTerm] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroTransportadora, setFiltroTransportadora] = useState('');
  const [filtroModal, setFiltroModal] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroFreteVazio, setFiltroFreteVazio] = useState(false);
  const [filtroFreteConfirmado, setFiltroFreteConfirmado] = useState(false);

  // Filtros Devoluções
  const [searchTermDev, setSearchTermDev] = useState('');
  const [filtroStatusDev, setFiltroStatusDev] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    nota_fiscal: '', cliente_id: '', transportadora_id: '', 
    cidade_destino: '', uf_destino: '', modal_frete: '', 
    data_faturamento: '', data_coleta: '', valor_nf: '', valor_frete: '', 
    volume: '', peso_kg: '', tem_agendamento: false, data_previsao: '', 
    data_entrega_agendamento: '', observacoes: '', status: 'Pendente',
    frete_confirmado: false
  });

  const [isDevolucaoModalOpen, setIsDevolucaoModalOpen] = useState(false);
  const [editingDevolucaoId, setEditingDevolucaoId] = useState<string | null>(null);
  const [devolucaoFormData, setDevolucaoFormData] = useState({
    data_emissao: '', data_coleta: '', data_previsao: '', data_chegada: '', 
    cliente_id: '', transportadora_cliente: '', nf_venda: '', notas_fiscais: '',
    valor_total_nf: '', volume: '', peso_kg: '', valor_frete_reverso: '', motivo: '', status: 'Pendente'
  });

  const [isTranspModalOpen, setIsTranspModalOpen] = useState(false);
  const [editingTranspId, setEditingTranspId] = useState<string | null>(null);
  const [transpFormData, setTranspFormData] = useState({ nome: '', cnpj_cpf: '', razao_social: '', nome_fantasia: '', modal_padrao: '', telefone: '', email: '' });

  const [isClienteModalOpen, setIsClienteModalOpen] = useState(false);
  const [editingClienteId, setEditingClienteId] = useState<string | null>(null);
  const [clienteFormData, setClienteFormData] = useState({ nome: '', cnpj_cpf: '', razao_social: '', nome_fantasia: '', cidade: '', uf: '', telefone: '', email: '' });
  
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
    } catch (error: any) { alert("Erro ao iniciar sessão."); } finally { setLoginLoading(false); }
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
      const { data, error } = await supabase.from('entregas')
        .select('*, clientes (nome, cidade, uf, telefone, email), transportadoras (nome, modal_padrao, telefone, email)')
        .order('data_faturamento', { ascending: false, nullsFirst: false });
      if (error) throw error;
      if (data) setEntregas(data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }

  async function buscarDevolucoes() {
    try {
      const { data, error } = await supabase.from('devolucoes')
        .select('*, clientes (nome, cnpj_cpf), transportadoras (nome)')
        .order('created_at', { ascending: false });
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

  // ==========================================
  // FUNÇÕES DE ABERTURA DE MODAIS
  // ==========================================
  function abrirModalNovaEntrega() {
    setEditingId(null);
    setFormData({ 
      nota_fiscal: '', cliente_id: '', transportadora_id: '', cidade_destino: '', uf_destino: '', modal_frete: '', 
      data_faturamento: '', data_coleta: '', valor_nf: '', valor_frete: '', volume: '', peso_kg: '', 
      tem_agendamento: false, data_previsao: '', data_entrega_agendamento: '', observacoes: '', status: 'Pendente', frete_confirmado: false
    });
    setIsModalOpen(true);
  }

  function abrirModalEdicao(entrega: any) {
    setEditingId(entrega.id);
    setFormData({
      nota_fiscal: entrega.nota_fiscal, cliente_id: entrega.cliente_id, transportadora_id: entrega.transportadora_id,
      cidade_destino: entrega.cidade_destino || '', uf_destino: entrega.uf_destino || '', modal_frete: entrega.modal_frete || '',
      data_faturamento: entrega.data_faturamento || '', data_coleta: entrega.data_coleta || '', valor_nf: entrega.valor_nf?.toString() || '',
      valor_frete: entrega.valor_frete?.toString() || '', volume: entrega.volume?.toString() || '', peso_kg: entrega.peso_kg?.toString() || '', 
      tem_agendamento: entrega.tem_agendamento || false, data_previsao: entrega.data_previsao || '', data_entrega_agendamento: entrega.data_entrega_agendamento || '', 
      observacoes: entrega.observacoes || '', status: entrega.status, frete_confirmado: entrega.frete_confirmado || false
    });
    setIsModalOpen(true);
  }

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

  function abrirModalNovaTransportadora() { setEditingTranspId(null); setTranspFormData({ nome: '', cnpj_cpf: '', razao_social: '', nome_fantasia: '', modal_padrao: '', telefone: '', email: '' }); setIsTranspModalOpen(true); }
  function abrirModalEdicaoTransportadora(transp: any) { setEditingTranspId(transp.id); setTranspFormData({ nome: transp.nome, cnpj_cpf: transp.cnpj_cpf || '', razao_social: transp.razao_social || '', nome_fantasia: transp.nome_fantasia || '', modal_padrao: transp.modal_padrao || '', telefone: transp.telefone || '', email: transp.email || '' }); setIsTranspModalOpen(true); }
  function abrirModalNovoCliente() { setEditingClienteId(null); setClienteFormData({ nome: '', cnpj_cpf: '', razao_social: '', nome_fantasia: '', cidade: '', uf: '', telefone: '', email: '' }); setIsClienteModalOpen(true); }
  function abrirModalEdicaoCliente(cliente: any) { setEditingClienteId(cliente.id); setClienteFormData({ nome: cliente.nome, cnpj_cpf: cliente.cnpj_cpf || '', razao_social: cliente.razao_social || '', nome_fantasia: cliente.nome_fantasia || '', cidade: cliente.cidade || '', uf: cliente.uf || '', telefone: cliente.telefone || '', email: cliente.email || '' }); setIsClienteModalOpen(true); }
  function abrirModalNovaMeta() { setMetaFormData({ cliente_id: '', transportadora_id: '', meta_percentual: '' }); setIsMetaModalOpen(true); }
  function abrirModalNovoPerfil() { setPerfilFormData({ nome: '', email: '', cargo: '', nivel_acesso: 'Operador' }); setIsPerfilModalOpen(true); }

  // ==========================================
  // FUNÇÕES DE EXCLUSÃO (TODAS PRESENTES!)
  // ==========================================
  async function handleDeleteEntrega(id: string) {
    if (!window.confirm("⚠️ ATENÇÃO: Tem certeza que deseja excluir esta entrega?\n\nEsta ação apagará a nota fiscal do sistema e não poderá ser desfeita.")) return;
    try {
      const { error } = await supabase.from('entregas').delete().eq('id', id);
      if (error) throw error;
      setEntregas(entregas.filter(e => e.id !== id));
    } catch (error) { console.error(error); alert("Erro ao excluir a entrega."); }
  }

  async function handleDeleteDevolucao(id: string) {
    if (!window.confirm("⚠️ ATENÇÃO: Tem certeza que deseja excluir este registro de devolução?")) return;
    try {
      const { error } = await supabase.from('devolucoes').delete().eq('id', id);
      if (error) throw error;
      setDevolucoes(devolucoes.filter(d => d.id !== id));
    } catch (error) { console.error(error); alert("Erro ao excluir a devolução."); }
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

  // ==========================================
  // FUNÇÕES DE SUBMIT
  // ==========================================
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nfDuplicada = entregas.find(ent => ent.nota_fiscal.trim().toLowerCase() === formData.nota_fiscal.trim().toLowerCase() && ent.id !== editingId);
    if (nfDuplicada) {
      alert(`⚠️ BLOQUEIO DE SEGURANÇA:\n\nA Nota Fiscal "${formData.nota_fiscal}" já está cadastrada no sistema!\nCliente vinculado: ${nfDuplicada.clientes?.nome || 'Desconhecido'}.\n\nPor favor, verifique o número da NF.`);
      return; 
    }

    const nf = parseFloat(formData.valor_nf) || 0;
    const frete = parseFloat(formData.valor_frete) || 0;
    
    if (nf > 0 && frete > 0) {
      const percentualCalculado = (frete / nf) * 100;
      if (formData.transportadora_id) {
        const metaAplicavel = metas.find(m => m.cliente_id === formData.cliente_id && m.transportadora_id === formData.transportadora_id);
        if (metaAplicavel && percentualCalculado > metaAplicavel.meta_percentual) {
          const desejaProsseguir = window.confirm(`⚠️ ALERTA DE AUDITORIA DE FRETE!\n\nO custo deste frete representa ${percentualCalculado.toFixed(2)}% do valor da NF.\nA meta máxima cadastrada é de ${metaAplicavel.meta_percentual}%.\n\nComo este valor pode ter sido negociado comercialmente, deseja prosseguir e salvar esta nota mesmo assim?`);
          if (!desejaProsseguir) return; 
        }
      }
    }
    
    const payload = {
      nota_fiscal: formData.nota_fiscal, cliente_id: formData.cliente_id, transportadora_id: formData.transportadora_id || null, 
      cidade_destino: formData.cidade_destino || null, uf_destino: formData.uf_destino || null, modal_frete: formData.modal_frete || null,
      data_faturamento: formData.data_faturamento || null, data_coleta: formData.data_coleta || null, valor_nf: nf, valor_frete: frete, 
      volume: parseInt(formData.volume) || null, peso_kg: parseFloat(formData.peso_kg) || null, tem_agendamento: formData.tem_agendamento, 
      data_previsao: formData.data_previsao || null, data_entrega_agendamento: formData.data_entrega_agendamento || null,
      observacoes: formData.observacoes, status: formData.status, frete_confirmado: formData.frete_confirmado
    };
    
    try {
      if (editingId) {
        const { data, error } = await supabase.from('entregas').update([payload]).eq('id', editingId).select('*, clientes (nome, cidade, uf, telefone, email), transportadoras (nome, modal_padrao, telefone, email)');
        if (error) throw error;
        if (data) { setEntregas(entregas.map(e => e.id === editingId ? data[0] : e)); setIsModalOpen(false); }
      } else {
        const { data, error } = await supabase.from('entregas').insert([payload]).select('*, clientes (nome, cidade, uf, telefone, email), transportadoras (nome, modal_padrao, telefone, email)');
        if (error) throw error;
        if (data) { setEntregas([data[0], ...entregas]); setIsModalOpen(false); }
      }
    } catch (error) { alert("Erro ao salvar a entrega."); }
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
        const { data, error } = await supabase.from('devolucoes').update([payload]).eq('id', editingDevolucaoId).select('*, clientes (nome, cnpj_cpf), transportadoras (nome)');
        if (error) throw error;
        if (data) { setDevolucoes(devolucoes.map(d => d.id === editingDevolucaoId ? data[0] : d)); setIsDevolucaoModalOpen(false); }
      } else {
        const { data, error } = await supabase.from('devolucoes').insert([payload]).select('*, clientes (nome, cnpj_cpf), transportadoras (nome)');
        if (error) throw error;
        if (data) { setDevolucoes([data[0], ...devolucoes]); setIsDevolucaoModalOpen(false); }
      }
    } catch (error) { console.error(error); alert("Erro ao salvar a logística reversa."); }
  }

  async function handleTranspSubmit(e: React.FormEvent) { e.preventDefault(); const payload = { nome: transpFormData.nome.toUpperCase(), cnpj_cpf: transpFormData.cnpj_cpf, razao_social: transpFormData.razao_social.toUpperCase(), nome_fantasia: transpFormData.nome_fantasia.toUpperCase(), modal_padrao: transpFormData.modal_padrao, telefone: transpFormData.telefone, email: transpFormData.email.toLowerCase() }; try { if (editingTranspId) { const { data, error } = await supabase.from('transportadoras').update([payload]).eq('id', editingTranspId).select('*'); if (error) throw error; if (data) { setTransportadoras(transportadoras.map(t => t.id === editingTranspId ? data[0] : t).sort((a, b) => a.nome.localeCompare(b.nome))); setIsTranspModalOpen(false); } } else { const { data, error } = await supabase.from('transportadoras').insert([payload]).select('*'); if (error) throw error; if (data) { setTransportadoras([...transportadoras, data[0]].sort((a, b) => a.nome.localeCompare(b.nome))); setIsTranspModalOpen(false); } } } catch (error) { console.error(error); alert("Erro ao salvar transportadora."); } }
  async function handleClienteSubmit(e: React.FormEvent) { e.preventDefault(); const payload = { nome: clienteFormData.nome.toUpperCase(), cnpj_cpf: clienteFormData.cnpj_cpf, razao_social: clienteFormData.razao_social.toUpperCase(), nome_fantasia: clienteFormData.nome_fantasia.toUpperCase(), cidade: clienteFormData.cidade.toUpperCase(), uf: clienteFormData.uf.toUpperCase(), telefone: clienteFormData.telefone, email: clienteFormData.email.toLowerCase() }; try { if (editingClienteId) { const { data, error } = await supabase.from('clientes').update([payload]).eq('id', editingClienteId).select('*'); if (error) throw error; if (data) { setClientes(clientes.map(c => c.id === editingClienteId ? data[0] : c).sort((a, b) => a.nome.localeCompare(b.nome))); setIsClienteModalOpen(false); } } else { const { data, error } = await supabase.from('clientes').insert([payload]).select('*'); if (error) throw error; if (data) { setClientes([...clientes, data[0]].sort((a, b) => a.nome.localeCompare(b.nome))); setIsClienteModalOpen(false); } } } catch (error) { console.error(error); alert("Erro ao salvar cliente."); } }
  async function handleMetaSubmit(e: React.FormEvent) { e.preventDefault(); try { const { data, error } = await supabase.from('metas_frete').insert([{ cliente_id: metaFormData.cliente_id, transportadora_id: metaFormData.transportadora_id, meta_percentual: parseFloat(metaFormData.meta_percentual) }]).select('*, clientes (nome), transportadoras (nome)'); if (error) { if (error.code === '23505') alert("Já existe uma meta de frete cadastrada para esta Transportadora com este Cliente."); else throw error; } else if (data) { setMetas([...metas, data[0]]); setIsMetaModalOpen(false); } } catch (error) { console.error(error); alert("Erro ao cadastrar meta de frete."); } }
  async function handlePerfilSubmit(e: React.FormEvent) { e.preventDefault(); try { const { data, error } = await supabase.from('perfis').insert([{ nome: perfilFormData.nome, email: perfilFormData.email.toLowerCase(), cargo: perfilFormData.cargo, nivel_acesso: perfilFormData.nivel_acesso }]).select('*'); if (error) { if (error.code === '23505') alert("Este e-mail já está cadastrado."); else throw error; } else if (data) { setPerfis([...perfis, data[0]].sort((a, b) => a.nome.localeCompare(b.nome))); setIsPerfilModalOpen(false); } } catch (error) { console.error(error); alert("Erro ao cadastrar funcionário."); } }

  const calcularPorcentagemFrete = (frete: number, nf: number) => { if (!frete || !nf || nf === 0) return '0.00%'; return ((frete / nf) * 100).toFixed(2) + '%'; };
  const calcularDiasEntrega = (coleta: string, entrega: string) => { if (!coleta || !entrega) return '-'; const diffTime = Math.abs(new Date(entrega).getTime() - new Date(coleta).getTime()); return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + ' dias'; };
  const formatarData = (dataStr: string) => { if (!dataStr) return '-'; const data = new Date(dataStr); data.setMinutes(data.getMinutes() + data.getTimezoneOffset()); return data.toLocaleDateString('pt-BR'); };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Entregue': return { backgroundColor: '#dcfce7', color: '#166534' }; 
      case 'Atrasado': return { backgroundColor: '#fee2e2', color: '#991b1b' }; 
      case 'Em Transporte': return { backgroundColor: '#e0f2fe', color: '#075985' }; 
      case 'Agendado': return { backgroundColor: '#f3e8ff', color: '#6b21a8' }; 
      case 'Devolução': return { backgroundColor: '#fecdd3', color: '#881337' }; 
      case 'Solicitado Agendamento': return { backgroundColor: '#fef08a', color: '#713f12' }; 
      case 'Pendente': return { backgroundColor: '#ffedd5', color: '#9a3412' }; 
      case 'Frete Conferido': return { backgroundColor: '#e0e7ff', color: '#4338ca' };
      
      case 'Aguardando Chegada': return { backgroundColor: '#fef3c7', color: '#92400e' };
      case 'Chegou no Galpão': return { backgroundColor: '#d1fae5', color: '#065f46' };
      case 'Coletada': return { backgroundColor: '#e0f2fe', color: '#075985' };
      case 'Solic. Coleta': return { backgroundColor: '#fef08a', color: '#713f12' };
      case 'Recusa': return { backgroundColor: '#fee2e2', color: '#991b1b' };
      case 'Coletada pelo representante.': return { backgroundColor: '#f3e8ff', color: '#6b21a8' };
      default: return { backgroundColor: '#f1f5f9', color: '#334155' };
    }
  };

  function limparFiltros() {
    setSearchTerm(''); setFiltroDataInicio(''); setFiltroDataFim(''); setFiltroTransportadora(''); setFiltroModal(''); setFiltroStatus(''); setFiltroFreteVazio(false); setFiltroFreteConfirmado(false);
  }

  const entregasFiltradas = entregas.filter(entrega => {
    const termo = searchTerm.toLowerCase();
    const nf = entrega.nota_fiscal?.toLowerCase() || '';
    const cliente = entrega.clientes?.nome?.toLowerCase() || '';
    const statusText = entrega.status?.toLowerCase() || '';
    const transpNome = entrega.transportadoras?.nome?.toLowerCase() || '';
    const passaTexto = nf.includes(termo) || cliente.includes(termo) || statusText.includes(termo) || transpNome.includes(termo);

    let passaData = true;
    if (filtroDataInicio && entrega.data_faturamento < filtroDataInicio) passaData = false;
    if (filtroDataFim && entrega.data_faturamento > filtroDataFim) passaData = false;

    const passaTransp = filtroTransportadora ? entrega.transportadora_id === filtroTransportadora : true;
    const passaModal = filtroModal ? (entrega.modal_frete === filtroModal || entrega.transportadoras?.modal_padrao === filtroModal) : true;
    const passaStatus = filtroStatus ? entrega.status === filtroStatus : true;
    
    const passaFreteVazio = filtroFreteVazio ? (!entrega.valor_frete || Number(entrega.valor_frete) === 0) : true;
    const passaFreteConfirmado = filtroFreteConfirmado ? entrega.frete_confirmado === true : true;

    return passaTexto && passaData && passaTransp && passaModal && passaStatus && passaFreteVazio && passaFreteConfirmado;
  }).sort((a, b) => new Date(b.data_faturamento || b.created_at || 0).getTime() - new Date(a.data_faturamento || a.created_at || 0).getTime());

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

  const exportarParaExcel = () => {
    if (entregasFiltradas.length === 0) { alert("Não há dados para exportar."); return; }
    const cabecalho = ["Data Fat.", "Coleta", "Cliente", "Cidade", "UF", "Volume (Cx)", "Peso (Kg)", "Nº NF", "Valor NF", "Transportadora", "Modal", "Valor Frete", "% Frete", "Agendamento", "Previsão", "Dt Entrega", "Dias", "Status", "Frete Confirmado", "Observações"].join(";");
    const linhas = entregasFiltradas.map(e => {
      const cidadeFormatada = e.cidade_destino || e.clientes?.cidade || '-';
      const ufFormatada = e.uf_destino || e.clientes?.uf || '-';
      const modalFormatado = e.modal_frete || e.transportadoras?.modal_padrao || '-';
      return [
        formatarData(e.data_faturamento), formatarData(e.data_coleta), e.clientes?.nome || '-', cidadeFormatada, ufFormatada,
        e.volume || e.volume_peso || '-', e.peso_kg || '-', e.nota_fiscal, e.valor_nf?.toString().replace('.', ',') || '0,00', e.transportadoras?.nome || '-', modalFormatado,
        e.valor_frete?.toString().replace('.', ',') || '0,00', calcularPorcentagemFrete(e.valor_frete, e.valor_nf), e.tem_agendamento ? 'SIM' : 'NÃO',
        formatarData(e.data_previsao), formatarData(e.data_entrega_agendamento), calcularDiasEntrega(e.data_coleta, e.data_entrega_agendamento).replace(' dias', ''), e.status, e.frete_confirmado ? 'SIM' : 'NÃO', e.observacoes || '-'
      ].join(";");
    });
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + cabecalho + "\n" + linhas.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `MunilaLog_Exportacao_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const faturamentoTotal = entregasFiltradas.reduce((acc, curr) => acc + (Number(curr.valor_nf) || 0), 0);
  const freteTotal = entregasFiltradas.reduce((acc, curr) => acc + (Number(curr.valor_frete) || 0), 0);
  const freteMedio = faturamentoTotal > 0 ? ((freteTotal / faturamentoTotal) * 100).toFixed(2) : '0.00';
  const atrasados = entregasFiltradas.filter(e => e.status === 'Atrasado').length;
  const volumeTotal = entregasFiltradas.reduce((acc, curr) => acc + (Number(curr.volume) || 0), 0);
  const pesoTotal = entregasFiltradas.reduce((acc, curr) => acc + (Number(curr.peso_kg) || 0), 0);
  
  const metaAnual = 25000000;
  const progressoMeta = ((faturamentoTotal / metaAnual) * 100).toFixed(2);
  
  const produtoSelecionado = produtos.find(p => p.id === calcProdutoId);
  const quantidadeDesejada = parseInt(calcQuantidade) || 0;
  let totalCaixas = 0; let pesoTotalCalc = "0.00";
  if (produtoSelecionado && quantidadeDesejada > 0) {
    totalCaixas = Math.ceil(quantidadeDesejada / produtoSelecionado.unidades_por_caixa);
    pesoTotalCalc = (totalCaixas * produtoSelecionado.peso_caixa_kg).toFixed(2);
  }

  const thStyle: React.CSSProperties = { position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, borderBottom: '2px solid #e2e8f0', padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', whiteSpace: 'nowrap' };
  const thAcoesStyle: React.CSSProperties = { ...thStyle, right: 0, zIndex: 11, textAlign: 'center', borderLeft: '1px solid #e2e8f0' };
  const tdStyle: React.CSSProperties = { padding: '10px 16px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap', fontSize: '0.85rem', color: '#334155' };
  const tdAcoesStyle: React.CSSProperties = { ...tdStyle, textAlign: 'center', position: 'sticky', right: 0, backgroundColor: 'white', zIndex: 1, borderLeft: '1px solid #e2e8f0' };

  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} handleLogout={handleLogout} />

      <main className="main-content">
        {activeTab === 'dashboard' && (
          <Dashboard 
            searchTerm={searchTerm} setSearchTerm={setSearchTerm}
            mostrarFiltros={mostrarFiltros} setMostrarFiltros={setMostrarFiltros}
            filtroDataInicio={filtroDataInicio} setFiltroDataInicio={setFiltroDataInicio}
            filtroDataFim={filtroDataFim} setFiltroDataFim={setFiltroDataFim}
            filtroTransportadora={filtroTransportadora} setFiltroTransportadora={setFiltroTransportadora}
            filtroModal={filtroModal} setFiltroModal={setFiltroModal}
            filtroStatus={filtroStatus} setFiltroStatus={setFiltroStatus}
            filtroFreteVazio={filtroFreteVazio} setFiltroFreteVazio={setFiltroFreteVazio}
            filtroFreteConfirmado={filtroFreteConfirmado} setFiltroFreteConfirmado={setFiltroFreteConfirmado}
            transportadoras={transportadoras} limparFiltros={limparFiltros}
            exportarParaExcel={exportarParaExcel} abrirModalNovaEntrega={abrirModalNovaEntrega}
            faturamentoTotal={faturamentoTotal} progressoMeta={progressoMeta} freteTotal={freteTotal} freteMedio={freteMedio} atrasados={atrasados} volumeTotal={volumeTotal} pesoTotal={pesoTotal} loading={loading}
            entregasFiltradas={entregasFiltradas} formatarData={formatarData} calcularPorcentagemFrete={calcularPorcentagemFrete} calcularDiasEntrega={calcularDiasEntrega} getStatusColor={getStatusColor}
            abrirModalEdicao={abrirModalEdicao} handleDeleteEntrega={handleDeleteEntrega}
          />
        )}
        {activeTab === 'equipe' && <Equipe perfis={perfis} abrirModalNovoPerfil={abrirModalNovoPerfil} />}
        {activeTab === 'clientes' && <Clientes clientes={clientes} metas={metas} abrirModalNovoCliente={abrirModalNovoCliente} abrirModalNovaMeta={abrirModalNovaMeta} abrirModalEdicaoCliente={abrirModalEdicaoCliente} handleDeleteCliente={handleDeleteCliente} />}
        
        {activeTab === 'transportadoras' && (
          <>
            <header className="header">
              <div><h2>Gestão de Transportadoras</h2><p>Cadastro de parceiros logísticos e modais operacionais</p></div>
              <button className="btn-primary" onClick={abrirModalNovaTransportadora}>+ Nova Transportadora</button>
            </header>
            <div className="table-container" style={{ maxWidth: '1000px' }}>
              <table>
                <thead><tr><th>Nome da Transportadora</th><th>Contato (Operacional)</th><th>Modal Padrão</th><th>Entregas Realizadas</th><th style={{ textAlign: 'center' }}>Ações</th></tr></thead>
                <tbody>
                  {transportadoras.map((transp) => {
                    const qtdEntregas = entregas.filter(e => e.transportadora_id === transp.id).length;
                    return (
                      <tr key={transp.id}>
                        <td style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{transp.nome}</td>
                        <td>
                          {transp.telefone && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}><Phone size={14} /> {transp.telefone}</div>}
                          {transp.email && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}><Mail size={14} /> {transp.email}</div>}
                          {(!transp.telefone && !transp.email) && <span style={{ color: '#cbd5e1' }}>-</span>}
                        </td>
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

        {activeTab === 'devolucoes' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
            <header className="header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <div><h2>Logística Reversa (Devoluções)</h2><p>Auditoria de coletas e custos de frete reverso</p></div>
                <button className="btn-primary" onClick={abrirModalNovaDevolucao}>+ Nova Devolução</button>
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
          </div>
        )}

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
                    <div style={{ padding: '16px', backgroundColor: '#f1f5f9', borderRadius: '8px' }}><p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Peso Bruto Total</p><p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{pesoTotalCalc} <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>KG</span></p></div>
                    <div style={{ padding: '16px', backgroundColor: 'var(--munila-light)', borderRadius: '8px', border: '1px solid var(--munila-blue)' }}><p style={{ fontSize: '0.875rem', color: 'var(--munila-dark)', fontWeight: 600, textTransform: 'uppercase' }}>Preenchimento da Coluna VOL/PESO</p><p style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--munila-blue)', marginTop: '4px' }}>{totalCaixas}CX {pesoTotalCalc}KG</p><p style={{ fontSize: '0.85rem', color: 'var(--munila-dark)', marginTop: '8px' }}>Cubagem Padrão: {produtoSelecionado.medidas_cm}</p></div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}><Calculator size={48} style={{ opacity: 0.2, margin: '0 auto 16px auto' }} /><p>Selecione um produto e digite a quantidade para calcular o peso e volume automático.</p></div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      <ModalEntrega 
        isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleSubmit} formData={formData} setFormData={setFormData} isEditing={!!editingId} clientes={clientes} transportadoras={transportadoras}
      />

      <ModalCliente 
        isOpen={isClienteModalOpen} onClose={() => setIsClienteModalOpen(false)} onSubmit={handleClienteSubmit} formData={clienteFormData} setFormData={setClienteFormData} isEditing={!!editingClienteId}
      />

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

      {isTranspModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <div className="modal-header"><h3>{editingTranspId ? 'Editar Transportadora' : 'Cadastrar Nova Transportadora'}</h3><button className="close-btn" onClick={() => setIsTranspModalOpen(false)}><X size={24} /></button></div>
            <form onSubmit={handleTranspSubmit}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Nome Principal (Identificação rápida no sistema)</label><input type="text" className="form-input" placeholder="Ex: BRASPRESS" required value={transpFormData.nome} onChange={(e) => setTranspFormData({...transpFormData, nome: e.target.value})} /></div>
                <div className="form-group"><label>CNPJ / CPF</label><input type="text" className="form-input" placeholder="00.000.000/0000-00" value={transpFormData.cnpj_cpf} onChange={(e) => setTranspFormData({...transpFormData, cnpj_cpf: e.target.value})} /></div>
                <div className="form-group"><label>Nome Fantasia</label><input type="text" className="form-input" placeholder="Braspress" value={transpFormData.nome_fantasia} onChange={(e) => setTranspFormData({...transpFormData, nome_fantasia: e.target.value})} /></div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Razão Social</label><input type="text" className="form-input" placeholder="BRASPRESS TRANSPORTES URGENTES LTDA" value={transpFormData.razao_social} onChange={(e) => setTranspFormData({...transpFormData, razao_social: e.target.value})} /></div>
                <div className="form-group"><label>Telefone / WhatsApp Comercial</label><input type="text" className="form-input" placeholder="Ex: (11) 99999-9999" value={transpFormData.telefone} onChange={(e) => setTranspFormData({...transpFormData, telefone: e.target.value})} /></div>
                <div className="form-group"><label>E-mail de Contato</label><input type="email" className="form-input" placeholder="contato@transportadora.com" value={transpFormData.email} onChange={(e) => setTranspFormData({...transpFormData, email: e.target.value})} /></div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Modal Padrão de Envio</label><select className="form-select" required value={transpFormData.modal_padrao} onChange={(e) => setTranspFormData({...transpFormData, modal_padrao: e.target.value})}><option value="">Selecione...</option><option value="AÉREO">Aéreo</option><option value="RODOVIÁRIO">Rodoviário</option><option value="PAC">PAC</option><option value="SEDEX">Sedex</option></select></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn-secondary" onClick={() => setIsTranspModalOpen(false)}>Cancelar</button><button type="submit" className="btn-primary">{editingTranspId ? 'Atualizar Parceiro' : 'Salvar Parceiro'}</button></div>
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
                <div className="form-group"><label>E-mail (Igual ao criado no Supabase)</label><input type="email" className="form-input" placeholder="joao@munila.com.br" required value={perfilFormData.email} onChange={(e) => setPerfilFormData({...perfilFormData, email: e.target.value})} /></div>
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