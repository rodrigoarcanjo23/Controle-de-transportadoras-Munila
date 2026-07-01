import React from 'react';
import { Edit, Trash2, DollarSign, TrendingUp, AlertCircle, Target, Package, Scale } from 'lucide-react';
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
  filtroFreteVazio: boolean;
  setFiltroFreteVazio: (value: boolean) => void;
  filtroFreteConfirmado: boolean;
  setFiltroFreteConfirmado: (value: boolean) => void;
  filtroComAgendamento: boolean; // NOVO
  setFiltroComAgendamento: (value: boolean) => void; // NOVO
  filtroSemAgendamento: boolean; // NOVO
  setFiltroSemAgendamento: (value: boolean) => void; // NOVO
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
  handleDeleteEntrega: (id: string) => void;
}

export function Dashboard({
  searchTerm, setSearchTerm, mostrarFiltros, setMostrarFiltros,
  filtroDataInicio, setFiltroDataInicio, filtroDataFim, setFiltroDataFim,
  filtroTransportadora, setFiltroTransportadora, filtroModal, setFiltroModal,
  filtroStatus, setFiltroStatus, filtroFreteVazio, setFiltroFreteVazio, 
  filtroFreteConfirmado, setFiltroFreteConfirmado, 
  filtroComAgendamento, setFiltroComAgendamento, // NOVO
  filtroSemAgendamento, setFiltroSemAgendamento, // NOVO
  transportadoras, limparFiltros,
  exportarParaExcel, abrirModalNovaEntrega,
  faturamentoTotal, progressoMeta, freteTotal, freteMedio, atrasados,
  volumeTotal, pesoTotal,
  loading, entregasFiltradas, formatarData, calcularPorcentagemFrete,
  calcularDiasEntrega, getStatusColor, abrirModalEdicao, handleDeleteEntrega
}: DashboardProps) {

  const thStyle: React.CSSProperties = { position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, borderBottom: '2px solid #e2e8f0', padding: '12px 16px', color: '#475569', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', whiteSpace: 'nowrap' };
  const thAcoesStyle: React.CSSProperties = { ...thStyle, right: 0, zIndex: 11, textAlign: 'center', borderLeft: '1px solid #e2e8f0' };
  const tdStyle: React.CSSProperties = { padding: '10px 16px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap', fontSize: '0.85rem', color: '#334155' };
  const tdAcoesStyle: React.CSSProperties = { ...tdStyle, textAlign: 'center', position: 'sticky', right: 0, backgroundColor: 'white', zIndex: 1, borderLeft: '1px solid #e2e8f0' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      
      <div style={{ flexShrink: 0 }}>
        <Header 
          searchTerm={searchTerm} setSearchTerm={setSearchTerm}
          mostrarFiltros={mostrarFiltros} setMostrarFiltros={setMostrarFiltros}
          filtroDataInicio={filtroDataInicio} setFiltroDataInicio={setFiltroDataInicio}
          filtroDataFim={filtroDataFim} setFiltroDataFim={setFiltroDataFim}
          filtroTransportadora={filtroTransportadora} setFiltroTransportadora={setFiltroTransportadora}
          filtroModal={filtroModal} setFiltroModal={setFiltroModal}
          filtroStatus={filtroStatus} setFiltroStatus={setFiltroStatus}
          filtroFreteVazio={filtroFreteVazio} setFiltroFreteVazio={setFiltroFreteVazio}
          filtroFreteConfirmado={filtroFreteConfirmado} setFiltroFreteConfirmado={setFiltroFreteConfirmado}
          filtroComAgendamento={filtroComAgendamento} setFiltroComAgendamento={setFiltroComAgendamento} // NOVO
          filtroSemAgendamento={filtroSemAgendamento} setFiltroSemAgendamento={setFiltroSemAgendamento} // NOVO
          transportadoras={transportadoras}
          limparFiltros={limparFiltros}
          exportarParaExcel={exportarParaExcel}
          abrirModalNovaEntrega={abrirModalNovaEntrega}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px', marginBottom: '24px', flexShrink: 0 }}>
        
        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Faturamento</p>
            <DollarSign size={16} color="#16a34a" />
          </div>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '6px', fontWeight: 700 }}>
            R$ {faturamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <div style={{ width: '100%', backgroundColor: '#f1f5f9', borderRadius: '2px', height: '4px' }}>
            <div style={{ width: `${Math.min(Number(progressoMeta), 100)}%`, backgroundColor: '#16a34a', height: '100%', borderRadius: '2px' }}></div>
          </div>
        </div>

        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Custo Logístico</p>
            <TrendingUp size={16} color="#ea580c" />
          </div>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', fontWeight: 700 }}>
            R$ {freteTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
        </div>

        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>% Frete Médio</p>
            <Target size={16} color="var(--munila-blue)" />
          </div>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--munila-blue)', fontWeight: 700 }}>{freteMedio}%</h3>
        </div>

        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Volume Total</p>
            <Package size={16} color="#8b5cf6" />
          </div>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', fontWeight: 700 }}>
            {volumeTotal.toLocaleString('pt-BR')} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>Cx</span>
          </h3>
        </div>

        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Peso Total</p>
            <Scale size={16} color="#eab308" />
          </div>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', fontWeight: 700 }}>
            {pesoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>Kg</span>
          </h3>
        </div>

        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Entregas em Atraso</p>
            <AlertCircle size={16} color="#dc2626" />
          </div>
          <h3 style={{ fontSize: '1.25rem', color: '#dc2626', fontWeight: 700 }}>
            {atrasados} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>NFs</span>
          </h3>
        </div>

      </div>

      <div className="table-container" style={{ flex: 1, minHeight: 0, overflow: 'auto', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'white', position: 'relative' }}>
        <table style={{ width: '100%', minWidth: '1600px', borderCollapse: 'separate', borderSpacing: 0 }}>
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
              
              const isFreteConfirmado = entrega.frete_confirmado;
              const freteColor = isFreteConfirmado ? '#166534' : 'inherit';
              const freteBg = isFreteConfirmado ? '#dcfce7' : 'transparent';

              return (
                <tr key={entrega.id} className="trow-hover">
                  {/* ATENÇÃO: Aqui estão os data-labels que fazem a mágica no mobile! */}
                  <td style={tdStyle} data-label="Data Fat.">{formatarData(entrega.data_faturamento)}</td>
                  <td style={tdStyle} data-label="Coleta">{formatarData(entrega.data_coleta)}</td>
                  <td style={tdStyle} data-label="Cliente">{entrega.clientes?.nome || '-'}</td>
                  
                  <td style={{ ...tdStyle, fontWeight: 'bold' }} data-label="Cidade">{cidadeDisplay}</td>
                  <td style={{ ...tdStyle, fontWeight: 'bold' }} data-label="UF">{ufDisplay}</td>

                  <td style={{ ...tdStyle, fontWeight: 'bold' }} data-label="Volume">{entrega.volume ? `${entrega.volume} Cx` : (entrega.volume_peso || '-')}</td>
                  <td style={{ ...tdStyle, fontWeight: 'bold' }} data-label="Peso (Kg)">{entrega.peso_kg ? `${entrega.peso_kg} Kg` : '-'}</td>
                  
                  <td style={{ ...tdStyle, fontWeight: 'bold' }} data-label="Nº NF">{entrega.nota_fiscal}</td>
                  <td style={tdStyle} data-label="Valor NF">R$ {Number(entrega.valor_nf).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td style={tdStyle} data-label="Transportadora">{entrega.transportadoras?.nome || '-'}</td>
                  
                  <td style={tdStyle} data-label="Modal">{modalDisplay}</td>

                  <td style={{ ...tdStyle, backgroundColor: freteBg, color: freteColor, fontWeight: isFreteConfirmado ? 'bold' : 'normal' }} data-label="Valor Frete">
                    R$ {Number(entrega.valor_frete).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} {isFreteConfirmado && '✅'}
                  </td>
                  <td style={{ ...tdStyle, backgroundColor: freteBg, fontWeight: 'bold', color: isFreteConfirmado ? freteColor : '#0095DA' }} data-label="% Frete">
                    {calcularPorcentagemFrete(entrega.valor_frete, entrega.valor_nf)}
                  </td>
                  
                  <td style={{ ...tdStyle, textAlign: 'center' }} data-label="Agendamento?">
                    {entrega.tem_agendamento ? (
                      <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.70rem' }}>SIM</span>
                    ) : (
                      <span style={{ backgroundColor: '#f1f5f9', color: '#64748b', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.70rem' }}>NÃO</span>
                    )}
                  </td>

                  <td style={tdStyle} data-label="Previsão">{formatarData(entrega.data_previsao)}</td>
                  <td style={tdStyle} data-label="Dt Entrega">{formatarData(entrega.data_entrega_agendamento)}</td>
                  <td style={tdStyle} data-label="Dias">{calcularDiasEntrega(entrega.data_coleta, entrega.data_entrega_agendamento)}</td>
                  <td style={tdStyle} data-label="Status"><span className="status-badge" style={getStatusColor(entrega.status)}>{entrega.status}</span></td>
                  <td style={{ ...tdStyle, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={entrega.observacoes} data-label="Obs">{entrega.observacoes || '-'}</td>
                  
                  <td style={tdAcoesStyle} data-label="Ações">
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button onClick={() => abrirModalEdicao(entrega)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }} title="Editar Entrega">
                        <Edit size={18} />
                      </button>
                      <button onClick={() => handleDeleteEntrega(entrega.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }} title="Excluir Entrega">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}