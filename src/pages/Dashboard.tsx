import React from 'react';
import { Edit, DollarSign, TrendingUp, AlertCircle, Target, Package, Scale } from 'lucide-react';
import { Header } from '../components/Header';

interface DashboardProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  mostrarFiltros: boolean;
  setMostrarFiltros: (value: boolean) => void;
  filtroDataInicio: string;
  setFiltroDataInicio: (value: string) => void;
  filtroDataFim: string;
  setFiltroDataFim: (value: string) => void;
  filtroTransportadora: string;
  setFiltroTransportadora: (value: string) => void;
  filtroModal: string;
  setFiltroModal: (value: string) => void;
  filtroStatus: string;
  setFiltroStatus: (value: string) => void;
  transportadoras: any[];
  limparFiltros: () => void;
  exportarParaExcel: () => void;
  abrirModalNovaEntrega: () => void;
  faturamentoTotal: number;
  progressoMeta: string;
  freteTotal: number;
  freteMedio: string;
  atrasados: number;
  volumeTotal: number;
  pesoTotal: number;
  loading: boolean;
  entregasFiltradas: any[];
  formatarData: (dataStr: string) => string;
  calcularPorcentagemFrete: (frete: number, nf: number) => string;
  calcularDiasEntrega: (coleta: string, entrega: string) => string;
  getStatusColor: (status: string) => React.CSSProperties;
  abrirModalEdicao: (entrega: any) => void;
}

export function Dashboard({
  searchTerm, setSearchTerm, mostrarFiltros, setMostrarFiltros,
  filtroDataInicio, setFiltroDataInicio, filtroDataFim, setFiltroDataFim,
  filtroTransportadora, setFiltroTransportadora, filtroModal, setFiltroModal,
  filtroStatus, setFiltroStatus, transportadoras, limparFiltros,
  exportarParaExcel, abrirModalNovaEntrega,
  faturamentoTotal, progressoMeta, freteTotal, freteMedio, atrasados,
  volumeTotal, pesoTotal,
  loading, entregasFiltradas, formatarData, calcularPorcentagemFrete,
  calcularDiasEntrega, getStatusColor, abrirModalEdicao
}: DashboardProps) {

  // ESTILOS CONGELADOS PARA O CABEÇALHO (Não somem ao rolar para baixo)
  const thStyle: React.CSSProperties = { position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, borderBottom: '1px solid #e2e8f0', padding: '12px 16px', color: '#64748b', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' };
  const thAcoesStyle: React.CSSProperties = { ...thStyle, right: 0, zIndex: 11, textAlign: 'center', borderLeft: '1px solid #e2e8f0' };
  
  return (
    <>
      <Header 
        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        mostrarFiltros={mostrarFiltros} setMostrarFiltros={setMostrarFiltros}
        filtroDataInicio={filtroDataInicio} setFiltroDataInicio={setFiltroDataInicio}
        filtroDataFim={filtroDataFim} setFiltroDataFim={setFiltroDataFim}
        filtroTransportadora={filtroTransportadora} setFiltroTransportadora={setFiltroTransportadora}
        filtroModal={filtroModal} setFiltroModal={setFiltroModal}
        filtroStatus={filtroStatus} setFiltroStatus={setFiltroStatus}
        transportadoras={transportadoras}
        limparFiltros={limparFiltros}
        exportarParaExcel={exportarParaExcel}
        abrirModalNovaEntrega={abrirModalNovaEntrega}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
        
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>Faturamento Despachado</p>
            <DollarSign size={20} color="#16a34a" />
          </div>
          <h3 style={{ fontSize: '1.75rem', color: 'var(--text-main)', marginBottom: '8px' }}>
            R$ {faturamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <div style={{ width: '100%', backgroundColor: '#f1f5f9', borderRadius: '4px', height: '6px', marginBottom: '4px' }}>
            <div style={{ width: `${Math.min(Number(progressoMeta), 100)}%`, backgroundColor: '#16a34a', height: '100%', borderRadius: '4px' }}></div>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{progressoMeta}% da Meta Anual</p>
        </div>

        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>Custo Logístico (Frete)</p>
            <TrendingUp size={20} color="#ea580c" />
          </div>
          <h3 style={{ fontSize: '1.75rem', color: 'var(--text-main)' }}>
            R$ {freteTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
        </div>

        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>% Frete Médio</p>
            <Target size={20} color="var(--munila-blue)" />
          </div>
          <h3 style={{ fontSize: '1.75rem', color: 'var(--munila-blue)' }}>{freteMedio}%</h3>
        </div>

        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>Volume Total Despachado</p>
            <Package size={20} color="#8b5cf6" />
          </div>
          <h3 style={{ fontSize: '1.75rem', color: 'var(--text-main)' }}>
            {volumeTotal.toLocaleString('pt-BR')} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>Cx</span>
          </h3>
        </div>

        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>Peso Total Despachado</p>
            <Scale size={20} color="#eab308" />
          </div>
          <h3 style={{ fontSize: '1.75rem', color: 'var(--text-main)' }}>
            {pesoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>Kg</span>
          </h3>
        </div>

        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>Entregas em Atraso</p>
            <AlertCircle size={20} color="#dc2626" />
          </div>
          <h3 style={{ fontSize: '1.75rem', color: '#dc2626' }}>
            {atrasados} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>NFs</span>
          </h3>
        </div>

      </div>

      {/* A MÁGICA ACONTECE AQUI: overflow: 'auto' cria rolagem dupla e o maxHeight força a barra para cima */}
      <div className="table-container" style={{ overflow: 'auto', width: '100%', maxHeight: 'calc(100vh - 300px)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <table style={{ whiteSpace: 'nowrap', minWidth: 'max-content', width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Data Fat.</th>
              <th style={thStyle}>Coleta</th>
              <th style={thStyle}>Cliente</th>
              <th style={thStyle}>Cidade</th>
              <th style={thStyle}>UF</th>
              <th style={thStyle}>Volume</th>
              <th style={thStyle}>Peso (Kg)</th>
              <th style={thStyle}>Nº NF</th>
              <th style={thStyle}>Valor NF</th>
              <th style={thStyle}>Transportadora</th>
              <th style={thStyle}>Modal</th>
              <th style={thStyle}>Valor Frete</th>
              <th style={thStyle}>% Frete</th>
              <th style={thStyle}>Agendamento?</th>
              <th style={thStyle}>Previsão</th>
              <th style={thStyle}>Dt Entrega</th>
              <th style={thStyle}>Dias</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Obs</th>
              <th style={thAcoesStyle}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? ( 
              <tr><td colSpan={20} style={{ textAlign: 'center', padding: '32px' }}>A carregar...</td></tr> 
            ) : entregasFiltradas.length === 0 ? (
              <tr><td colSpan={20} style={{ textAlign: 'center', padding: '32px' }}>Nenhuma entrega encontrada na busca.</td></tr>
            ) : entregasFiltradas.map((entrega) => {
              
              const cidadeDisplay = entrega.cidade_destino || entrega.clientes?.cidade || '-';
              const ufDisplay = entrega.uf_destino || entrega.clientes?.uf || '-';
              const modalDisplay = entrega.modal_frete || entrega.transportadoras?.modal_padrao || '-';

              return (
                <tr key={entrega.id}>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>{formatarData(entrega.data_faturamento)}</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>{formatarData(entrega.data_coleta)}</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>{entrega.clientes?.nome || '-'}</td>
                  
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', fontWeight: 'bold' }}>{cidadeDisplay}</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', fontWeight: 'bold' }}>{ufDisplay}</td>

                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', fontWeight: 'bold' }}>{entrega.volume ? `${entrega.volume} Cx` : (entrega.volume_peso || '-')}</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', fontWeight: 'bold' }}>{entrega.peso_kg ? `${entrega.peso_kg} Kg` : '-'}</td>
                  
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', fontWeight: 'bold' }}>{entrega.nota_fiscal}</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>R$ {Number(entrega.valor_nf).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>{entrega.transportadoras?.nome || '-'}</td>
                  
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>{modalDisplay}</td>

                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>R$ {Number(entrega.valor_frete).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', fontWeight: 'bold', color: '#0095DA' }}>{calcularPorcentagemFrete(entrega.valor_frete, entrega.valor_nf)}</td>
                  
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>
                    {entrega.tem_agendamento ? (
                      <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.75rem' }}>SIM</span>
                    ) : (
                      <span style={{ backgroundColor: '#f1f5f9', color: '#64748b', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.75rem' }}>NÃO</span>
                    )}
                  </td>

                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>{formatarData(entrega.data_previsao)}</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>{formatarData(entrega.data_entrega_agendamento)}</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>{calcularDiasEntrega(entrega.data_coleta, entrega.data_entrega_agendamento)}</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}><span className="status-badge" style={getStatusColor(entrega.status)}>{entrega.status}</span></td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={entrega.observacoes}>{entrega.observacoes || '-'}</td>
                  
                  {/* COLUNA DE AÇÕES COM zIndex 1 PARA FICAR ABAIXO DO CABEÇALHO */}
                  <td style={{ textAlign: 'center', position: 'sticky', right: 0, backgroundColor: 'white', zIndex: 1, borderLeft: '1px solid #e2e8f0', borderBottom: '1px solid #f1f5f9' }}>
                    <button onClick={() => abrirModalEdicao(entrega)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }} title="Editar Entrega">
                      <Edit size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}