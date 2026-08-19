import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Calculator, Package, X } from 'lucide-react';

import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Equipe } from './pages/Equipe';
import { Clientes } from './pages/Clientes';
import { Transportadoras } from './pages/Transportadoras';
import { Devolucoes } from './pages/Devolucoes';
import { ModalEntrega } from './modals/ModalEntrega';
import { ModalCliente } from './modals/ModalCliente';
import { Ctes } from './pages/Ctes';
import { Auditoria } from './pages/Auditoria';

import './index.css';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);

  const [entregas, setEntregas] = useState<any[]>([]);
  const [devolucoes, setDevolucoes] = useState<any[]>([]);
  const [perfis, setPerfis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [clientes, setClientes] = useState<any[]>([]);
  const [transportadoras, setTransportadoras] = useState<any[]>([]);
  const [metas, setMetas] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);

  // ESTADOS DE FILTROS GERAIS
  const [searchTerm, setSearchTerm] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroTransportadora, setFiltroTransportadora] = useState('');
  const [filtroModal, setFiltroModal] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string[]>([]);
  
  // ESTADOS DE CHECKBOXES E NOVOS FILTROS
  const [filtroFreteVazio, setFiltroFreteVazio] = useState(false);
  const [filtroFreteConfirmado, setFiltroFreteConfirmado] = useState(false);
  const [filtroComAgendamento, setFiltroComAgendamento] = useState(false);
  const [filtroSemAgendamento, setFiltroSemAgendamento] = useState(false);
  const [filtroComFreteCotado, setFiltroComFreteCotado] = useState(false);
  const [filtroComFreteReal, setFiltroComFreteReal] = useState(false);
  const [filtroSemDataEntrega, setFiltroSemDataEntrega] = useState(false);
  
  // ESTADOS RANGES E DATAS 
  const [filtroUf, setFiltroUf] = useState('');
  const [filtroValorNfMin, setFiltroValorNfMin] = useState(''); 
  const [filtroValorNfMax, setFiltroValorNfMax] = useState('');
  const [filtroPercFreteMin, setFiltroPercFreteMin] = useState('');
  const [filtroPercFreteMax, setFiltroPercFreteMax] = useState('');
  
  const [filtroDataEntradaInicio, setFiltroDataEntradaInicio] = useState('');
  const [filtroDataEntradaFim, setFiltroDataEntradaFim] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    nota_fiscal: '', cliente_id: '', transportadora_id: '', cidade_destino: '', uf_destino: '', modal_frete: '', 
    data_entrada_pedido: '', data_faturamento: '', data_coleta: '', valor_nf: '', valor_frete: '', valor_frete_real: '', volume: '', peso_kg: '', tem_agendamento: false, data_previsao: '', 
    data_entrega_agendamento: '', observacoes: '', status: 'Pendente', frete_confirmado: false
  });

  const [isClienteModalOpen, setIsClienteModalOpen] = useState(false);
  const [editingClienteId, setEditingClienteId] = useState<string | null>(null);
  const [clienteFormData, setClienteFormData] = useState({ nome: '', cnpj_cpf: '', razao_social: '', nome_fantasia: '', cidade: '', uf: '', telefone: '', email: '', exige_agendamento: false });
  
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
    buscarEntregas(); buscarDevolucoes(); buscarDominios(); buscarPerfis();
  }

  const registrarLog = async (acao: string, modulo: string, detalhes: string) => {
    if (!session?.user?.email) return;
    try {
      await supabase.from('logs_auditoria').insert([{
        usuario_email: session.user.email, acao: acao, modulo: modulo, detalhes: detalhes
      }]);
    } catch (error) { console.error("Erro ao registrar log de auditoria:", error); }
  };

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
            <div className="form-group"><label>E-mail</label><input type="email" className="form-input" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="exemplo@munila.com.br"/></div>
            <div className="form-group"><label>Senha</label><input type="password" className="form-input" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} /></div>
            <button type="submit" className="btn-primary" style={{ justifyContent: 'center', marginTop: '8px' }} disabled={loginLoading}>{loginLoading ? 'Entrando...' : 'Entrar'}</button>
          </form>
        </div>
      </div>
    );
  }

  async function buscarEntregas() { try { const { data } = await supabase.from('entregas').select('*, clientes (nome, cidade, uf, telefone, email, exige_agendamento), transportadoras (nome, modal_padrao, telefone, email)').order('data_faturamento', { ascending: false }); if (data) setEntregas(data); } catch (error) { console.error(error); } finally { setLoading(false); } }
  async function buscarDevolucoes() { try { const { data } = await supabase.from('devolucoes').select('*, clientes (nome, cnpj_cpf), transportadoras (nome)').order('created_at', { ascending: false }); if (data) setDevolucoes(data); } catch (error) { console.error(error); } }
  async function buscarDominios() { const { data: c } = await supabase.from('clientes').select('*').order('nome'); const { data: t } = await supabase.from('transportadoras').select('*').order('nome'); const { data: m } = await supabase.from('metas_frete').select('*, clientes (nome), transportadoras (nome)'); const { data: p } = await supabase.from('produtos').select('*').order('nome'); if (c) setClientes(c); if (t) setTransportadoras(t); if (m) setMetas(m); if (p) setProdutos(p); }
  async function buscarPerfis() { try { const { data } = await supabase.from('perfis').select('*').order('nome'); if (data) setPerfis(data); } catch (error) { console.error(error); } }

  function abrirModalNovaEntrega() { 
    setEditingId(null); 
    setFormData({ nota_fiscal: '', cliente_id: '', transportadora_id: '', cidade_destino: '', uf_destino: '', modal_frete: '', data_entrada_pedido: '', data_faturamento: '', data_coleta: '', valor_nf: '', valor_frete: '', valor_frete_real: '', volume: '', peso_kg: '', tem_agendamento: false, data_previsao: '', data_entrega_agendamento: '', observacoes: '', status: 'Pendente', frete_confirmado: false }); 
    setIsModalOpen(true); 
  }
  
  function abrirModalEdicao(entrega: any) { 
    setEditingId(entrega.id); 
    setFormData({ 
      nota_fiscal: entrega.nota_fiscal, cliente_id: entrega.cliente_id, transportadora_id: entrega.transportadora_id, cidade_destino: entrega.cidade_destino || '', uf_destino: entrega.uf_destino || '', modal_frete: entrega.modal_frete || '', 
      data_entrada_pedido: entrega.data_entrada_pedido || '', data_faturamento: entrega.data_faturamento || '', data_coleta: entrega.data_coleta || '', valor_nf: entrega.valor_nf?.toString() || '', 
      valor_frete: entrega.valor_frete?.toString().replace('.', ',') || '', 
      valor_frete_real: entrega.valor_frete_real?.toString().replace('.', ',') || '', 
      volume: entrega.volume?.toString() || '', 
      peso_kg: entrega.peso_kg?.toString().replace('.', ',') || '', 
      tem_agendamento: entrega.tem_agendamento || false, data_previsao: entrega.data_previsao || '', data_entrega_agendamento: entrega.data_entrega_agendamento || '', observacoes: entrega.observacoes || '', status: entrega.status, frete_confirmado: entrega.frete_confirmado || false 
    }); 
    setIsModalOpen(true); 
  }
  
  function abrirModalNovoCliente() { setEditingClienteId(null); setClienteFormData({ nome: '', cnpj_cpf: '', razao_social: '', nome_fantasia: '', cidade: '', uf: '', telefone: '', email: '', exige_agendamento: false }); setIsClienteModalOpen(true); }
  function abrirModalEdicaoCliente(cliente: any) { setEditingClienteId(cliente.id); setClienteFormData({ nome: cliente.nome, cnpj_cpf: cliente.cnpj_cpf || '', razao_social: cliente.razao_social || '', nome_fantasia: cliente.nome_fantasia || '', cidade: cliente.cidade || '', uf: cliente.uf || '', telefone: cliente.telefone || '', email: cliente.email || '', exige_agendamento: cliente.exige_agendamento || false }); setIsClienteModalOpen(true); }
  
  function abrirModalNovaMeta() { setMetaFormData({ cliente_id: '', transportadora_id: '', meta_percentual: '' }); setIsMetaModalOpen(true); }
  function abrirModalNovoPerfil() { setPerfilFormData({ nome: '', email: '', cargo: '', nivel_acesso: 'Operador' }); setIsPerfilModalOpen(true); }

  async function handleDeleteEntrega(id: string) { 
    if (!window.confirm("⚠️ ATENÇÃO: Tem certeza que deseja excluir esta entrega?")) return; 
    try { 
      const entrega = entregas.find(e => e.id === id);
      const nfApagada = entrega ? entrega.nota_fiscal : id;
      await supabase.from('entregas').delete().eq('id', id); 
      setEntregas(entregas.filter(e => e.id !== id)); 
      await registrarLog('APAGOU', 'ENTREGAS', `Apagou a Entrega com Nota Fiscal: ${nfApagada}`);
    } catch (error) { console.error(error); } 
  }

  async function handleDeleteCliente(id: string) { 
    if (!window.confirm("Tem certeza que deseja excluir este cliente?")) return; 
    try { 
      const cliente = clientes.find(c => c.id === id);
      const nomeApagado = cliente ? cliente.nome : id;
      await supabase.from('clientes').delete().eq('id', id); 
      setClientes(clientes.filter(c => c.id !== id)); 
      await registrarLog('APAGOU', 'CLIENTES', `Apagou o Cliente: ${nomeApagado}`);
    } catch (error) { console.error(error); } 
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const nfLimpa = String(formData.nota_fiscal || '').trim();

    if (!nfLimpa) { alert("⚠️ O número da Nota Fiscal é obrigatório."); return; }

    try {
      let query = supabase.from('entregas').select('id, nota_fiscal, clientes (nome)').ilike('nota_fiscal', nfLimpa);
      if (editingId) { query = query.neq('id', editingId); }
      const { data: nfsExistentes, error: errorChecagem } = await query;

      if (errorChecagem) { console.error("Erro", errorChecagem); } 
      else if (nfsExistentes && nfsExistentes.length > 0) {
        const clienteAssociado = (nfsExistentes[0].clientes as any)?.nome || 'Desconhecido';
        alert(`⚠️ DUPLICIDADE BLOQUEADA!\nA Nota Fiscal "${nfLimpa}" já está cadastrada para o cliente: ${clienteAssociado}.`);
        return; 
      }
    } catch (err) { console.error(err); }

    const nf = parseFloat(formData.valor_nf) || 0; 
    
    const freteCotado = parseFloat(String(formData.valor_frete).replace(',', '.')) || null;
    const freteReal = parseFloat(String(formData.valor_frete_real).replace(',', '.')) || null;
    const pesoFormatado = parseFloat(String(formData.peso_kg).replace(',', '.')) || null;
    
    const payload = { 
      nota_fiscal: nfLimpa, cliente_id: formData.cliente_id, transportadora_id: formData.transportadora_id || null, cidade_destino: formData.cidade_destino || null, uf_destino: formData.uf_destino || null, modal_frete: formData.modal_frete || null, data_entrada_pedido: formData.data_entrada_pedido || null, data_faturamento: formData.data_faturamento || null, data_coleta: formData.data_coleta || null, valor_nf: nf, valor_frete: freteCotado, valor_frete_real: freteReal, volume: parseInt(formData.volume) || null, peso_kg: pesoFormatado, tem_agendamento: formData.tem_agendamento, data_previsao: formData.data_previsao || null, data_entrega_agendamento: formData.data_entrega_agendamento || null, observacoes: formData.observacoes, status: formData.status, frete_confirmado: formData.frete_confirmado 
    };
    
    try {
      if (editingId) {
        const { data } = await supabase.from('entregas').update([payload]).eq('id', editingId).select('*, clientes (nome, cidade, uf, telefone, email, exige_agendamento), transportadoras (nome, modal_padrao, telefone, email)');
        if (data) {
          setEntregas(entregas.map(e => e.id === editingId ? data[0] : e));
          await registrarLog('EDITOU', 'ENTREGAS', `Editou os dados da Entrega (NF: ${nfLimpa})`);
        }
      } else {
        const { data } = await supabase.from('entregas').insert([payload]).select('*, clientes (nome, cidade, uf, telefone, email, exige_agendamento), transportadoras (nome, modal_padrao, telefone, email)');
        if (data) {
          setEntregas([data[0], ...entregas]);
          await registrarLog('CRIOU', 'ENTREGAS', `Registrou nova Entrega (NF: ${nfLimpa})`);
        }
      }
      setIsModalOpen(false);
    } catch (error) { console.error(error); alert("Erro ao salvar a entrega."); }
  }

  async function handleClienteSubmit(e: React.FormEvent) { 
    e.preventDefault(); 
    const payload = { nome: clienteFormData.nome.toUpperCase(), cnpj_cpf: clienteFormData.cnpj_cpf, razao_social: clienteFormData.razao_social.toUpperCase(), nome_fantasia: clienteFormData.nome_fantasia.toUpperCase(), cidade: clienteFormData.cidade.toUpperCase(), uf: clienteFormData.uf.toUpperCase(), telefone: clienteFormData.telefone, email: clienteFormData.email.toLowerCase(), exige_agendamento: clienteFormData.exige_agendamento }; 
    try { 
      if (editingClienteId) { 
        const { data } = await supabase.from('clientes').update([payload]).eq('id', editingClienteId).select('*'); 
        if (data) {
          setClientes(clientes.map(c => c.id === editingClienteId ? data[0] : c)); 
          await registrarLog('EDITOU', 'CLIENTES', `Editou os dados do Cliente: ${payload.nome}`);
        }
      } else { 
        const { data } = await supabase.from('clientes').insert([payload]).select('*'); 
        if (data) {
          setClientes([...clientes, data[0]]); 
          await registrarLog('CRIOU', 'CLIENTES', `Registrou um novo Cliente: ${payload.nome}`);
        }
      } 
      setIsClienteModalOpen(false); 
    } catch (error) { console.error(error); } 
  }

  async function handleMetaSubmit(e: React.FormEvent) { 
    e.preventDefault(); 
    try { 
      const { data } = await supabase.from('metas_frete').insert([{ cliente_id: metaFormData.cliente_id, transportadora_id: metaFormData.transportadora_id, meta_percentual: parseFloat(metaFormData.meta_percentual) }]).select('*, clientes (nome), transportadoras (nome)'); 
      if (data) setMetas([...metas, data[0]]); 
      setIsMetaModalOpen(false); 
      await registrarLog('CRIOU', 'CLIENTES', `Criou nova meta de frete de ${metaFormData.meta_percentual}%`);
    } catch (error) { alert("Erro ao cadastrar meta."); } 
  }
  
  async function handlePerfilSubmit(e: React.FormEvent) { 
    e.preventDefault(); 
    try { 
      const { data } = await supabase.from('perfis').insert([{ nome: perfilFormData.nome, email: perfilFormData.email.toLowerCase(), cargo: perfilFormData.cargo, nivel_acesso: perfilFormData.nivel_acesso }]).select('*'); 
      if (data) setPerfis([...perfis, data[0]]); 
      setIsPerfilModalOpen(false); 
      await registrarLog('CRIOU', 'EQUIPE', `Registrou novo membro da equipe: ${perfilFormData.nome} (${perfilFormData.email})`);
    } catch (error) { console.error(error); } 
  }

  const formatarData = (d: string) => {
    if (!d) return '-';
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
  };

  const calcularGapPedidoEntrega = (entrada: string, entrega: string) => {
    if (!entrada || !entrega) return '-';
    const d1 = new Date(entrada + 'T12:00:00');
    const d2 = new Date(entrega + 'T12:00:00');
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + ' dias';
  };

  const calcularPorcentagemFrete = (frete: number, nf: number) => { 
    if (!frete || !nf || nf === 0) return '0.00%'; 
    return ((frete / nf) * 100).toFixed(2) + '%'; 
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Entregue': return { backgroundColor: '#dcfce7', color: '#166534' }; 
      case 'Atrasado': return { backgroundColor: '#fee2e2', color: '#991b1b' }; 
      case 'Em Transporte': return { backgroundColor: '#e0f2fe', color: '#075985' }; 
      case 'Agendado': return { backgroundColor: '#f3e8ff', color: '#6b21a8' }; 
      case 'Devolução': return { backgroundColor: '#fecdd3', color: '#881337' }; 
      case 'Solicitado Agendamento': return { backgroundColor: '#fef08a', color: '#713f12' }; 
      case 'Pendente agendamento': return { backgroundColor: '#fce7f3', color: '#be185d' }; 
      case 'Aguardando coleta': return { backgroundColor: '#fef3c7', color: '#d97706' }; 
      case 'Pendente': return { backgroundColor: '#ffedd5', color: '#9a3412' }; 
      case 'Frete Conferido': return { backgroundColor: '#e0e7ff', color: '#4338ca' };
      case 'Aguardando Chegada': return { backgroundColor: '#fef3c7', color: '#92400e' }; 
      case 'Chegou no Galpão': return { backgroundColor: '#d1fae5', color: '#065f46' };
      case 'Coletada': return { backgroundColor: '#e0f2fe', color: '#075985' }; 
      case 'Solic. Coleta': return { backgroundColor: '#fef08a', color: '#713f12' };
      case 'Recusa': return { backgroundColor: '#fee2e2', color: '#991b1b' }; 
      case 'Coletada pelo representante.': return { backgroundColor: '#f3e8ff', color: '#6b21a8' };
      case 'Lançada': return { backgroundColor: '#cffafe', color: '#0369a1' }; 
      case 'Emitida': return { backgroundColor: '#ccfbf1', color: '#0f766e' }; 
      default: return { backgroundColor: '#f1f5f9', color: '#334155' };
    }
  };

  function limparFiltros() { 
    setSearchTerm(''); setFiltroDataInicio(''); setFiltroDataFim(''); 
    setFiltroTransportadora(''); setFiltroModal(''); setFiltroStatus([]); 
    setFiltroFreteVazio(false); setFiltroFreteConfirmado(false); 
    setFiltroComAgendamento(false); setFiltroSemAgendamento(false);
    setFiltroComFreteCotado(false); setFiltroComFreteReal(false); 
    
    setFiltroUf('');
    setFiltroSemDataEntrega(false);
    setFiltroValorNfMin(''); 
    setFiltroValorNfMax('');
    setFiltroPercFreteMin('');
    setFiltroPercFreteMax('');

    setFiltroDataEntradaInicio('');
    setFiltroDataEntradaFim('');
  }

  const entregasFiltradas = entregas.filter(entrega => {
    const termo = searchTerm.toLowerCase();
    const passaTexto = 
      String(entrega.nota_fiscal || '').toLowerCase().includes(termo) || 
      String(entrega.clientes?.nome || '').toLowerCase().includes(termo) || 
      String(entrega.transportadoras?.nome || '').toLowerCase().includes(termo) || 
      String(entrega.status || '').toLowerCase().includes(termo);
      
    let passaData = true;
    if (filtroDataInicio && entrega.data_faturamento < filtroDataInicio) passaData = false;
    if (filtroDataFim && entrega.data_faturamento > filtroDataFim) passaData = false;

    let passaDataEntrada = true;
    if (filtroDataEntradaInicio && (!entrega.data_entrada_pedido || entrega.data_entrada_pedido < filtroDataEntradaInicio)) passaDataEntrada = false;
    if (filtroDataEntradaFim && (!entrega.data_entrada_pedido || entrega.data_entrada_pedido > filtroDataEntradaFim)) passaDataEntrada = false;

    const passaTransp = filtroTransportadora ? entrega.transportadora_id === filtroTransportadora : true;
    const passaModal = filtroModal ? (entrega.modal_frete === filtroModal || entrega.transportadoras?.modal_padrao === filtroModal) : true;
    
    const passaStatus = filtroStatus.length === 0 ? true : filtroStatus.includes(entrega.status);
    
    const passaFreteVazio = filtroFreteVazio ? (!entrega.valor_frete_real && !entrega.valor_frete) : true;
    const passaFreteConfirmado = filtroFreteConfirmado ? entrega.frete_confirmado === true : true;
    const passaComAgendamento = filtroComAgendamento ? entrega.tem_agendamento === true : true;
    const passaSemAgendamento = filtroSemAgendamento ? (!entrega.tem_agendamento) : true;

    const passaComFreteCotado = filtroComFreteCotado ? (Number(entrega.valor_frete) > 0) : true;
    const passaComFreteReal = filtroComFreteReal ? (Number(entrega.valor_frete_real) > 0) : true;

    const ufDestino = entrega.uf_destino || entrega.clientes?.uf || '';
    const passaUf = filtroUf ? ufDestino === filtroUf : true;

    const passaSemData = filtroSemDataEntrega ? !entrega.data_entrega_agendamento : true;

    const valNf = Number(entrega.valor_nf) || 0;
    const passaValNfMin = filtroValorNfMin ? valNf >= Number(filtroValorNfMin) : true;
    const passaValNfMax = filtroValorNfMax ? valNf <= Number(filtroValorNfMax) : true;

    const calcFreteReal = entrega.valor_frete_real !== null && entrega.valor_frete_real !== undefined && entrega.valor_frete_real !== '';
    const valorFreteCalculo = calcFreteReal ? Number(entrega.valor_frete_real) : Number(entrega.valor_frete);
    const percFrete = valNf > 0 ? (valorFreteCalculo / valNf) * 100 : 0;
    const passaPercMin = filtroPercFreteMin ? percFrete >= Number(filtroPercFreteMin) : true;
    const passaPercMax = filtroPercFreteMax ? percFrete <= Number(filtroPercFreteMax) : true;

    return passaTexto && passaData && passaDataEntrada && passaTransp && passaModal && passaStatus && passaFreteVazio && passaFreteConfirmado && passaComAgendamento && passaSemAgendamento && passaComFreteCotado && passaComFreteReal && passaUf && passaSemData && passaValNfMin && passaValNfMax && passaPercMin && passaPercMax;
  }).sort((a, b) => new Date(b.data_faturamento || b.created_at || 0).getTime() - new Date(a.data_faturamento || a.created_at || 0).getTime());

  const faturamentoTotal = entregasFiltradas.reduce((acc, curr) => acc + (Number(curr.valor_nf) || 0), 0);
  const freteTotal = entregasFiltradas.reduce((acc, curr) => acc + (Number(curr.valor_frete_real) || Number(curr.valor_frete) || 0), 0);
  const freteMedio = faturamentoTotal > 0 ? ((freteTotal / faturamentoTotal) * 100).toFixed(2) : '0.00';
  const volumeTotal = entregasFiltradas.reduce((acc, curr) => acc + (Number(curr.volume) || 0), 0);
  const pesoTotal = entregasFiltradas.reduce((acc, curr) => acc + (Number(curr.peso_kg) || 0), 0);

  const produtoSelecionado = produtos.find(p => p.id === calcProdutoId);
  const quantidadeDesejada = parseInt(calcQuantidade) || 0;
  let totalCaixas = 0; let pesoTotalCalc = "0.00";
  if (produtoSelecionado && quantidadeDesejada > 0) { totalCaixas = Math.ceil(quantidadeDesejada / produtoSelecionado.unidades_por_caixa); pesoTotalCalc = (totalCaixas * produtoSelecionado.peso_caixa_kg).toFixed(2); }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout handleLogout={handleLogout} />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          
          <Route path="dashboard" element={
            <Dashboard 
              searchTerm={searchTerm} setSearchTerm={setSearchTerm} mostrarFiltros={mostrarFiltros} setMostrarFiltros={setMostrarFiltros}
              filtroDataInicio={filtroDataInicio} setFiltroDataInicio={setFiltroDataInicio} filtroDataFim={filtroDataFim} setFiltroDataFim={setFiltroDataFim}
              filtroTransportadora={filtroTransportadora} setFiltroTransportadora={setFiltroTransportadora} filtroModal={filtroModal} setFiltroModal={setFiltroModal}
              filtroStatus={filtroStatus} setFiltroStatus={setFiltroStatus} 
              filtroFreteVazio={filtroFreteVazio} setFiltroFreteVazio={setFiltroFreteVazio}
              filtroFreteConfirmado={filtroFreteConfirmado} setFiltroFreteConfirmado={setFiltroFreteConfirmado}
              filtroComAgendamento={filtroComAgendamento} setFiltroComAgendamento={setFiltroComAgendamento}
              filtroSemAgendamento={filtroSemAgendamento} setFiltroSemAgendamento={setFiltroSemAgendamento}
              filtroComFreteCotado={filtroComFreteCotado} setFiltroComFreteCotado={setFiltroComFreteCotado}
              filtroComFreteReal={filtroComFreteReal} setFiltroComFreteReal={setFiltroComFreteReal}
              
              filtroUf={filtroUf} setFiltroUf={setFiltroUf}
              filtroSemDataEntrega={filtroSemDataEntrega} setFiltroSemDataEntrega={setFiltroSemDataEntrega}
              filtroValorNfMin={filtroValorNfMin} setFiltroValorNfMin={setFiltroValorNfMin}
              filtroValorNfMax={filtroValorNfMax} setFiltroValorNfMax={setFiltroValorNfMax}
              filtroPercFreteMin={filtroPercFreteMin} setFiltroPercFreteMin={setFiltroPercFreteMin}
              filtroPercFreteMax={filtroPercFreteMax} setFiltroPercFreteMax={setFiltroPercFreteMax}
              
              filtroDataEntradaInicio={filtroDataEntradaInicio} setFiltroDataEntradaInicio={setFiltroDataEntradaInicio}
              filtroDataEntradaFim={filtroDataEntradaFim} setFiltroDataEntradaFim={setFiltroDataEntradaFim}

              transportadoras={transportadoras} limparFiltros={limparFiltros} 
              abrirModalNovaEntrega={abrirModalNovaEntrega}
              freteMedio={freteMedio} volumeTotal={volumeTotal} pesoTotal={pesoTotal} loading={loading}
              entregasFiltradas={entregasFiltradas} formatarData={formatarData} calcularPorcentagemFrete={calcularPorcentagemFrete} 
              calcularGapPedidoEntrega={calcularGapPedidoEntrega}
              getStatusColor={getStatusColor} abrirModalEdicao={abrirModalEdicao} handleDeleteEntrega={handleDeleteEntrega}
            />
          } />

          <Route path="equipe" element={<Equipe perfis={perfis} abrirModalNovoPerfil={abrirModalNovoPerfil} />} />
          <Route path="clientes" element={<Clientes clientes={clientes} metas={metas} abrirModalNovoCliente={abrirModalNovoCliente} abrirModalNovaMeta={abrirModalNovaMeta} abrirModalEdicaoCliente={abrirModalEdicaoCliente} handleDeleteCliente={handleDeleteCliente} onUpdate={carregarDadosDoBanco} />} />
          <Route path="transportadoras" element={<Transportadoras transportadoras={transportadoras} entregas={entregas} onUpdate={buscarDominios} />} />
          <Route path="devolucoes" element={<Devolucoes devolucoes={devolucoes} clientes={clientes} onUpdate={buscarDevolucoes} formatarData={formatarData} getStatusColor={getStatusColor} />} />
          <Route path="ctes" element={<Ctes transportadoras={transportadoras} formatarData={formatarData} onUpdateEntregas={carregarDadosDoBanco} />} />
          <Route path="auditoria" element={<Auditoria />} />

          <Route path="calculadora" element={
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
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
            </div>
          } />
        </Route>
      </Routes>

      {/* MODALS */}
      <ModalEntrega isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleSubmit} formData={formData} setFormData={setFormData} isEditing={!!editingId} clientes={clientes} transportadoras={transportadoras} />
      <ModalCliente isOpen={isClienteModalOpen} onClose={() => setIsClienteModalOpen(false)} onSubmit={handleClienteSubmit} formData={clienteFormData} setFormData={setClienteFormData} isEditing={!!editingClienteId} />

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
    </BrowserRouter>
  );
}