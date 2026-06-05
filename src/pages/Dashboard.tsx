import React from 'react';
import { Edit, DollarSign, TrendingUp, AlertCircle, Target } from 'lucide-react';
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
  loading, entregasFiltradas, formatarData, calcularPorcentagemFrete,
  calcularDiasEntrega, getStatusColor, abrirModalEdicao
}: DashboardProps) {
  
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
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
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>Entregas em Atraso</p>
            <AlertCircle size={20} color="#dc2626" />
          </div>
          <h3 style={{ fontSize: '1.75rem', color: '#dc2626' }}>
            {atrasados} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>NFs</span>
          </h3>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Data Fat.</th><th>Coleta</th><th>Cliente</th><th>Cidade</th><th>UF</th>
              {/* CABEÇALHO ALTERADO PARA KG */}
              <th>Volume</th><th>Peso (Kg)</th><th>Nº NF</th><th>Valor NF</th><th>Transportadora</th><th>Modal</th>
              <th>Valor Frete</th><th>% Frete</th><th>Agendamento?</th><th>Previsão</th>
              <th>Dt Entrega</th><th>Dias</th><th>Status</th><th>Obs</th>
              <th style={{ textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? ( 
              <tr><td colSpan={20} style={{ textAlign: 'center', padding: '32px' }}>A carregar...</td></tr> 
            ) : entregasFiltradas.length === 0 ? (
              <tr><td colSpan={20} style={{ textAlign: 'center', padding: '32px' }}>Nenhuma entrega encontrada na busca.</td></tr>
            ) : entregasFiltradas.map((entrega) => {
              
              const cidadeDisplay = entrega.cidade_destino ? entrega.cidade_destino.split('-')[0]?.trim() : (entrega.clientes?.cidade || '-');
              const ufDisplay = entrega.cidade_destino && entrega.cidade_destino.includes('-') ? entrega.cidade_destino.split('-')[1]?.trim() : (entrega.clientes?.uf || '-');
              const modalDisplay = entrega.modal_frete || entrega.transportadoras?.modal_padrao || '-';

              return (
                <tr key={entrega.id}>
                  <td>{formatarData(entrega.data_faturamento)}</td>
                  <td>{formatarData(entrega.data_coleta)}</td>
                  <td>{entrega.clientes?.nome || '-'}</td>
                  
                  <td style={{ fontWeight: 'bold' }}>{cidadeDisplay}</td>
                  <td style={{ fontWeight: 'bold' }}>{ufDisplay}</td>

                  <td style={{ fontWeight: 'bold' }}>{entrega.volume ? `${entrega.volume} Cx` : (entrega.volume_peso || '-')}</td>
                  
                  {/* COLUNA ALTERADA PARA KG */}
                  <td style={{ fontWeight: 'bold' }}>{entrega.peso_kg ? `${entrega.peso_kg} Kg` : '-'}</td>
                  
                  <td style={{ fontWeight: 'bold' }}>{entrega.nota_fiscal}</td>
                  <td>R$ {Number(entrega.valor_nf).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td>{entrega.transportadoras?.nome || '-'}</td>
                  
                  <td>{modalDisplay}</td>

                  <td>R$ {Number(entrega.valor_frete).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td style={{ fontWeight: 'bold', color: '#0095DA' }}>{calcularPorcentagemFrete(entrega.valor_frete, entrega.valor_nf)}</td>
                  <td>{entrega.tem_agendamento ? 'SIM' : 'NÃO'}</td>
                  <td>{formatarData(entrega.data_previsao)}</td>
                  <td>{formatarData(entrega.data_entrega_agendamento)}</td>
                  <td>{calcularDiasEntrega(entrega.data_coleta, entrega.data_entrega_agendamento)}</td>
                  <td><span className="status-badge" style={getStatusColor(entrega.status)}>{entrega.status}</span></td>
                  <td>{entrega.observacoes || '-'}</td>
                  <td style={{ textAlign: 'center' }}>
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