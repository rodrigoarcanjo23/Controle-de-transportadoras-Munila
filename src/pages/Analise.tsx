import React, { useState, useMemo } from 'react';
import { PieChart, TrendingDown, Clock, Truck, DollarSign, Activity, Calendar, Map } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';

interface AnaliseProps {
  entregas: any[];
  setFiltroStatus: (status: string[]) => void;
  limparFiltros: () => void;
}

export function Analise({ entregas, setFiltroStatus, limparFiltros }: AnaliseProps) {
  const navigate = useNavigate();
  
  // ESTADOS DOS FILTROS
  const [periodoFiltro, setPeriodoFiltro] = useState('tudo');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [mesSelecionado, setMesSelecionado] = useState(''); // NOVO: Filtro de Mês

  // ==========================================
  // DESCOBRIR QUAIS MESES EXISTEM NO BANCO
  // ==========================================
  const mesesDisponiveis = useMemo(() => {
    const meses = new Set<string>();
    entregas.forEach(e => {
      if (e.data_faturamento) {
        // Pega apenas o "YYYY-MM" (Ex: "2026-08")
        meses.add(e.data_faturamento.substring(0, 7));
      }
    });
    return Array.from(meses).sort().reverse(); // Do mais recente para o mais antigo
  }, [entregas]);

  // Função para formatar "2026-08" para "Agosto/2026"
  const formatarMesAno = (yyyyMM: string) => {
    if (!yyyyMM) return '';
    const [ano, mes] = yyyyMM.split('-');
    const mesesStr = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${mesesStr[parseInt(mes) - 1]}/${ano}`;
  };

  // ==========================================
  // FILTRAGEM PRÉVIA PELO PERÍODO ESCOLHIDO
  // ==========================================
  const entregasFiltradas = useMemo(() => {
    return entregas.filter(e => {
      if (!e.data_faturamento) return false;

      // Filtro de Mês Específico
      if (periodoFiltro === 'mes') {
        if (!mesSelecionado) return true; // Mostra tudo se não selecionou o mês ainda
        const mesDaNota = e.data_faturamento.substring(0, 7);
        return mesDaNota === mesSelecionado;
      }

      if (periodoFiltro === 'personalizado') {
        if (dataInicio && e.data_faturamento < dataInicio) return false;
        if (dataFim && e.data_faturamento > dataFim) return false;
        return true;
      }

      if (periodoFiltro === 'tudo') return true;
      
      const d = new Date(e.data_faturamento + 'T12:00:00');
      const dataLimite = new Date();
      dataLimite.setHours(0, 0, 0, 0);

      if (periodoFiltro === '30dias') dataLimite.setDate(dataLimite.getDate() - 30);
      if (periodoFiltro === '90dias') dataLimite.setDate(dataLimite.getDate() - 90);
      if (periodoFiltro === 'esteAno') dataLimite.setMonth(0, 1);

      return d >= dataLimite;
    });
  }, [entregas, periodoFiltro, dataInicio, dataFim, mesSelecionado]);

  // ==========================================
  // O MOTOR DO BI: CÁLCULOS MATEMÁTICOS GERAIS
  // ==========================================
  const stats = useMemo(() => {
    const total = entregasFiltradas.length;
    if (total === 0) return null;

    const entregues = entregasFiltradas.filter(e => e.status === 'Entregue').length;
    const atrasadas = entregasFiltradas.filter(e => e.status === 'Atrasado').length;
    const emAndamento = entregasFiltradas.filter(e => !['Entregue', 'Atrasado', 'Devolução', 'Recusa'].includes(e.status)).length;

    const percentEntregue = ((entregues / total) * 100).toFixed(1);
    const percentAtraso = ((atrasadas / total) * 100).toFixed(1);

    const faturamentoTotal = entregasFiltradas.reduce((acc, curr) => acc + (Number(curr.valor_nf) || 0), 0);
    const custoLogistico = entregasFiltradas.reduce((acc, curr) => {
      const real = Number(curr.valor_frete_real);
      const cotado = Number(curr.valor_frete);
      return acc + (real > 0 ? real : (cotado || 0));
    }, 0);
    const freteMedio = faturamentoTotal > 0 ? ((custoLogistico / faturamentoTotal) * 100).toFixed(2) : '0.00';

    const transportadorasMap: Record<string, { name: string, Quantidade: number, Custo: number }> = {};
    const clientesMap: Record<string, { name: string, Valor: number, Notas: number }> = {};
    const timelineMap: Record<string, { name: string, Faturamento: number, Frete: number, dateObj: Date }> = {};
    const estadosCustoMap: Record<string, number> = {}; // NOVO: Mapeamento de custo por Estado (UF)

    entregasFiltradas.forEach(e => {
      // 1. Custo por Transportadora
      const nomeTransp = e.transportadoras?.nome || 'Não Informada';
      if (!transportadorasMap[nomeTransp]) transportadorasMap[nomeTransp] = { name: nomeTransp, Quantidade: 0, Custo: 0 };
      transportadorasMap[nomeTransp].Quantidade += 1;
      
      const real = Number(e.valor_frete_real);
      const custoFinalItem = real > 0 ? real : (Number(e.valor_frete) || 0);
      transportadorasMap[nomeTransp].Custo += custoFinalItem;

      // 2. Custo por Cliente
      const nomeCliente = e.clientes?.nome || 'Cliente Desconhecido';
      if (!clientesMap[nomeCliente]) clientesMap[nomeCliente] = { name: nomeCliente, Valor: 0, Notas: 0 };
      clientesMap[nomeCliente].Valor += (Number(e.valor_nf) || 0);
      clientesMap[nomeCliente].Notas += 1;

      // 3. Custo por Estado (UF)
      const uf = e.uf_destino || e.clientes?.uf || 'ND';
      estadosCustoMap[uf] = (estadosCustoMap[uf] || 0) + custoFinalItem;

      // 4. Evolução no Tempo
      if (e.data_faturamento) {
        const isoDate = e.data_faturamento; 
        const d = new Date(isoDate + 'T12:00:00');
        const diaMes = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        
        if (!timelineMap[isoDate]) {
          timelineMap[isoDate] = { name: diaMes, Faturamento: 0, Frete: 0, dateObj: d };
        }
        timelineMap[isoDate].Faturamento += (Number(e.valor_nf) || 0);
        timelineMap[isoDate].Frete += custoFinalItem;
      }
    });

    const topTransportadoras = Object.values(transportadorasMap).sort((a, b) => b.Custo - a.Custo).slice(0, 5);
    const topClientes = Object.values(clientesMap).sort((a, b) => b.Valor - a.Valor).slice(0, 5);
    
    // Transforma o mapa de estados num Array e ordena do estado mais caro para o mais barato
    const fretePorEstado = Object.entries(estadosCustoMap)
      .map(([uf, custo]) => ({ uf, custo }))
      .sort((a, b) => b.custo - a.custo);

    const timelineData = Object.values(timelineMap).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    let gapTotal = 0, qtdGap = 0;
    const diferencaDias = (d1: string, d2: string) => Math.ceil((new Date(d2).getTime() - new Date(d1).getTime()) / (1000 * 60 * 60 * 24));
    entregasFiltradas.forEach(e => {
      if (e.data_entrada_pedido && e.data_entrega_agendamento) { gapTotal += diferencaDias(e.data_entrada_pedido, e.data_entrega_agendamento); qtdGap++; }
    });

    return {
      total, entregues, atrasadas, emAndamento, percentEntregue, percentAtraso,
      faturamentoTotal, custoLogistico, freteMedio, topTransportadoras, topClientes, timelineData, fretePorEstado,
      mediaGap: qtdGap ? (gapTotal / qtdGap).toFixed(1) : '-'
    };
  }, [entregasFiltradas]);

  const handleStatusClick = (statusList: string[]) => {
    limparFiltros(); 
    setFiltroStatus(statusList);
    navigate('/dashboard');
  };

  const cardStyle: React.CSSProperties = { backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };

  if (!stats && entregas.length === 0) return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>A carregar dados para o BI...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <PieChart size={28} color="#0284c7" /> Painel de Inteligência e Resultados
          </h2>
          <p style={{ color: '#64748b', margin: 0 }}>Análise executiva dinâmica da sua operação logística</p>
        </div>
        
        {/* CAIXA DE FILTROS COM OPÇÃO DE MÊS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          
          {periodoFiltro === 'personalizado' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: '#f0fdf4', padding: '6px 12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              <input type="date" className="form-input" style={{ padding: '4px 8px', height: '32px', fontSize: '0.85rem' }} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
              <span style={{ color: '#166534', fontWeight: 'bold' }}>até</span>
              <input type="date" className="form-input" style={{ padding: '4px 8px', height: '32px', fontSize: '0.85rem' }} value={dataFim} onChange={e => setDataFim(e.target.value)} />
            </div>
          )}

          {/* O NOVO FILTRO DE SELEÇÃO DE MÊS */}
          {periodoFiltro === 'mes' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: '#fefce8', padding: '6px 12px', borderRadius: '8px', border: '1px solid #fef08a' }}>
              <select className="form-select" style={{ padding: '4px 8px', height: '32px', fontSize: '0.85rem', border: 'none', backgroundColor: 'transparent', fontWeight: 'bold', color: '#854d0e', outline: 'none' }} value={mesSelecionado} onChange={e => setMesSelecionado(e.target.value)}>
                <option value="">Selecione o Mês...</option>
                {mesesDisponiveis.map(m => (
                  <option key={m} value={m}>{formatarMesAno(m)}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'white', padding: '6px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <Calendar size={18} color="#64748b" style={{ marginLeft: '8px' }}/>
            <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600, marginRight: '4px' }}>Período:</span>
            <select 
              className="form-select" 
              style={{ border: 'none', backgroundColor: '#f8fafc', fontWeight: 'bold', color: '#0f172a', minWidth: '150px' }}
              value={periodoFiltro}
              onChange={(e) => setPeriodoFiltro(e.target.value)}
            >
              <option value="tudo">Todo o Histórico</option>
              <option value="30dias">Últimos 30 Dias</option>
              <option value="90dias">Últimos 3 Meses</option>
              <option value="esteAno">Este Ano (YTD)</option>
              <option value="mes">Mês Específico...</option>
              <option value="personalizado">Personalizado...</option>
            </select>
          </div>
        </div>
      </div>

      {!stats ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', backgroundColor: 'white', borderRadius: '12px' }}>
          Nenhum dado financeiro ou de entrega encontrado para o período selecionado.
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div style={cardStyle}>
              <p style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Faturamento (Período)</p>
              <h3 style={{ fontSize: '1.75rem', color: '#0f172a', margin: 0, fontWeight: 800 }}>R$ {stats.faturamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            </div>
            
            <div style={cardStyle}>
              <p style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Custo Logístico</p>
              <h3 style={{ fontSize: '1.75rem', color: '#ea580c', margin: 0, fontWeight: 800 }}>R$ {stats.custoLogistico.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            </div>

            <div style={cardStyle}>
              <p style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Impacto Frete Médio</p>
              <h3 style={{ fontSize: '1.75rem', color: '#0284c7', margin: 0, fontWeight: 800 }}>{stats.freteMedio}%</h3>
            </div>

            <div style={{...cardStyle, borderTop: '4px solid #22c55e'}}>
              <p style={{ color: '#166534', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Taxa de Sucesso</p>
              <h3 style={{ fontSize: '1.75rem', color: '#15803d', margin: 0, fontWeight: 800 }}>{stats.percentEntregue}%</h3>
            </div>
          </div>

          <div style={{ ...cardStyle, height: '350px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <h3 style={{ fontSize: '1.1rem', color: '#0f172a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingDown size={20} color="#6366f1"/> Evolução Faturamento vs Frete
            </h3>
            <div style={{ flex: 1, width: '100%', minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.timelineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorFaturamento" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorFrete" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ea580c" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ea580c" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} minTickGap={30} interval="preserveStartEnd" />
                  
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(val) => `R$ ${(val/1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(val) => `R$ ${(val/1000).toFixed(0)}k`} />
                  <Tooltip 
                    formatter={(value: any) => {
                      const numVal = Number(value) || 0;
                      return [`R$ ${numVal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, ''];
                    }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  
                  <Area isAnimationActive={false} connectNulls type="linear" dot={false} activeDot={{ r: 6 }} yAxisId="left" dataKey="Faturamento" stroke="#0284c7" strokeWidth={3} fillOpacity={1} fill="url(#colorFaturamento)" />
                  <Area isAnimationActive={false} connectNulls type="linear" dot={false} activeDot={{ r: 6 }} yAxisId="right" dataKey="Frete" stroke="#ea580c" strokeWidth={3} fillOpacity={1} fill="url(#colorFrete)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* NOVO GRÁFICO: CUSTO LOGÍSTICO POR ESTADO (O "MAPA DE CALOR" FINANCEIRO) */}
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.1rem', color: '#0f172a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Map size={20} color="#f59e0b"/> Custo de Frete por Estado (UF)
            </h3>
            {/* Altura Dinâmica: cresce conforme a quantidade de Estados operados */}
            <div style={{ flex: 1, width: '100%', minWidth: 0, minHeight: `${Math.max(300, stats.fretePorEstado.length * 35)}px` }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.fretePorEstado} layout="vertical" margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                  <XAxis type="number" tickFormatter={(val) => `R$ ${(val/1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis dataKey="uf" type="category" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 12, fontWeight: 'bold' }} width={50} />
                  <Tooltip 
                    formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 'Custo Logístico (R$)']}
                    cursor={{fill: '#f8fafc'}}
                  />
                  <Bar isAnimationActive={false} dataKey="custo" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '16px' }}>
            <div style={{ ...cardStyle, height: '350px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '1.1rem', color: '#0f172a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DollarSign size={20} color="#10b981"/> Top 5 Clientes (Maior Receita)
              </h3>
              <div style={{ flex: 1, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.topClientes} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11 }} width={120} />
                    <Tooltip 
                      formatter={(value: any, name: any) => {
                        const numVal = Number(value) || 0;
                        return [name === 'Valor' ? `R$ ${numVal.toLocaleString('pt-BR')}` : numVal, name === 'Valor' ? 'Faturamento' : 'Volume de NFs'];
                      }}
                      cursor={{fill: '#f8fafc'}}
                    />
                    <Bar isAnimationActive={false} dataKey="Valor" fill="#10b981" radius={[0, 4, 4, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ ...cardStyle, height: '350px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '1.1rem', color: '#0f172a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Truck size={20} color="#8b5cf6"/> Top 5 Transportadoras (Maior Custo)
              </h3>
              <div style={{ flex: 1, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.topTransportadoras} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11 }} width={120} />
                    <Tooltip 
                      formatter={(value: any, name: any) => {
                         const numVal = Number(value) || 0;
                         return [name === 'Custo' ? `R$ ${numVal.toLocaleString('pt-BR')}` : numVal, name === 'Custo' ? 'Custo Logístico' : 'NFs Transportadas'];
                      }}
                      cursor={{fill: '#f8fafc'}}
                    />
                    <Bar isAnimationActive={false} dataKey="Custo" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={cardStyle}>
              <h3 style={{ fontSize: '1.1rem', color: '#0f172a', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}><Activity size={20} color="#f59e0b"/> Resumo de Operação</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                <div 
                  onClick={() => handleStatusClick(['Entregue'])}
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                  title="Clique para ver todas as NFs entregues"
                >
                  <span style={{ color: '#475569', fontWeight: 600 }}>Entregues</span>
                  <span style={{ color: '#15803d', fontWeight: 800 }}>{stats.entregues}</span>
                </div>
                
                <div 
                  onClick={() => handleStatusClick(['Pendente', 'Pendente agendamento', 'Aguardando coleta', 'Solicitado Agendamento', 'Agendado', 'Em Transporte', 'Frete Conferido'])}
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                  title="Clique para ver NFs em trânsito ou processamento"
                >
                  <span style={{ color: '#475569', fontWeight: 600 }}>Em Trânsito / Processo</span>
                  <span style={{ color: '#b45309', fontWeight: 800 }}>{stats.emAndamento}</span>
                </div>

                <div 
                  onClick={() => handleStatusClick(['Atrasado'])}
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#fee2e2', borderRadius: '8px', border: '1px solid #fecaca', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fca5a5'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                  title="Clique para analisar entregas atrasadas"
                >
                  <span style={{ color: '#991b1b', fontWeight: 600 }}>Atrasadas ou Críticas</span>
                  <span style={{ color: '#b91c1c', fontWeight: 800 }}>{stats.atrasadas}</span>
                </div>

              </div>
            </div>

            <div style={{...cardStyle, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center'}}>
              <Clock size={40} color="#3b82f6" style={{ marginBottom: '16px' }} />
              <h4 style={{ margin: '0 0 8px 0', color: '#64748b', textTransform: 'uppercase', fontSize: '0.85rem', fontWeight: 600 }}>Lead Time Total (SLA Médio)</h4>
              <h1 style={{ fontSize: '3.5rem', color: '#1e3a8a', margin: 0, fontWeight: 900 }}>{stats.mediaGap}</h1>
              <p style={{ margin: '8px 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>Dias desde o pedido até à entrega no cliente.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}