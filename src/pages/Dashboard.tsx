import React from 'react';
import { Edit, Trash2, TrendingUp, Target, Package, Scale, FileText, ArrowRightLeft } from 'lucide-react';
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
  filtroStatus: string[];
  setFiltroStatus: (value: string[]) => void;
  filtroFreteVazio: boolean;
  setFiltroFreteVazio: (value: boolean) => void;
  filtroFreteConfirmado: boolean;
  setFiltroFreteConfirmado: (value: boolean) => void;
  filtroComAgendamento: boolean;
  setFiltroComAgendamento: (value: boolean) => void;
  filtroSemAgendamento: boolean;
  setFiltroSemAgendamento: (value: boolean) => void;
  filtroComFreteCotado: boolean;
  setFiltroComFreteCotado: (value: boolean) => void;
  filtroComFreteReal: boolean;
  setFiltroComFreteReal: (value: boolean) => void;
  transportadoras: any[];
  limparFiltros: () => void;
  abrirModalNovaEntrega: () => void;
  freteTotal: number;
  freteMedio: string;
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
  filtroComAgendamento, setFiltroComAgendamento,
  filtroSemAgendamento, setFiltroSemAgendamento,
  filtroComFreteCotado, setFiltroComFreteCotado,
  filtroComFreteReal, setFiltroComFreteReal,
  transportadoras, limparFiltros, abrirModalNovaEntrega,
  freteTotal, freteMedio,
  volumeTotal, pesoTotal, loading, entregasFiltradas, formatarData, calcularPorcentagemFrete,
  calcularDiasEntrega, getStatusColor, abrirModalEdicao, handleDeleteEntrega
}: DashboardProps) {

  // CÁLCULOS DOS DASHBOARDS
  const valorTotalNf = entregasFiltradas.reduce((acc, curr) => acc + (Number(curr.valor_nf) || 0), 0);
  const totalFreteCotado = entregasFiltradas.reduce((acc, curr) => acc + (Number(curr.valor_frete) || 0), 0);
  const totalFreteReal = entregasFiltradas.reduce((acc, curr) => acc + (Number(curr.valor_frete_real) || 0), 0);

  const exportarParaExcel = () => {
    if (entregasFiltradas.length === 0) { alert("Não há dados para exportar."); return; }
    
    const cabecalho = ["Data Fat.", "Coleta", "Cliente", "Cidade", "UF", "Volume (Cx)", "Peso (Kg)", "Nº NF", "Valor NF", "Transportadora", "Modal", "Frete Cotado (R$)", "Frete Real (R$)", "% Frete Real", "Agendamento", "Previsão", "Dt Entrega", "Dias", "Status", "Frete Confirmado", "Observações"].join(";");
    
    const linhas = entregasFiltradas.map(e => {
      const cidadeFormatada = e.cidade_destino || e.clientes?.cidade || '-';
      const ufFormatada = e.uf_destino || e.clientes?.uf || '-';
      const modalFormatado = e.modal_frete || e.transportadoras?.modal_padrao || '-';
      
      const temReal = e.valor_frete_real !== null && e.valor_frete_real !== undefined && e.valor_frete_real !== '';
      const calcFrete = temReal ? e.valor_frete_real : e.valor_frete;

      return [
        formatarData(e.data_faturamento), formatarData(e.data_coleta), e.clientes?.nome || '-', cidadeFormatada, ufFormatada,
        e.volume || e.volume_peso || '-', e.peso_kg?.toString().replace('.', ',') || '-', e.nota_fiscal, 
        e.valor_nf?.toString().replace('.', ',') || '0,00', e.transportadoras?.nome || '-', modalFormatado,
        e.valor_frete?.toString().replace('.', ',') || '0,00', 
        e.valor_frete_real?.toString().replace('.', ',') || '0,00', 
        calcularPorcentagemFrete(calcFrete, e.valor_nf), 
        e.tem_agendamento ? 'SIM' : 'NÃO',
        formatarData(e.data_previsao), formatarData(e.data_entrega_agendamento), calcularDiasEntrega(e.data_coleta, e.data_entrega_agendamento).replace(' dias', ''), e.status, e.frete_confirmado ? 'SIM' : 'NÃO', e.observacoes || '-'
      ].join(";");
    });
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + cabecalho + "\n" + linhas.join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `MunilaLog_Exportacao_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

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
          filtroComAgendamento={filtroComAgendamento} setFiltroComAgendamento={setFiltroComAgendamento}
          filtroSemAgendamento={filtroSemAgendamento} setFiltroSemAgendamento={setFiltroSemAgendamento}
          filtroComFreteCotado={filtroComFreteCotado} setFiltroComFreteCotado={setFiltroComFreteCotado}
          filtroComFreteReal={filtroComFreteReal} setFiltroComFreteReal={setFiltroComFreteReal}
          transportadoras={transportadoras} limparFiltros={limparFiltros} exportarParaExcel={exportarParaExcel} abrirModalNovaEntrega={abrirModalNovaEntrega}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px', flexShrink: 0 }}>
        
        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Valor Total NFs</p>
            <FileText size={16} color="#0284c7" />
          </div>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '6px', fontWeight: 700 }}>
            R$ {valorTotalNf.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Soma do período selecionado</p>
        </div>

        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Comparativo Frete</p>
            <ArrowRightLeft size={16} color="#8b5cf6" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
            <div>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Cotado</p>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--text-main)', fontWeight: 700 }}>
                R$ {totalFreteCotado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Real (CTE)</p>
              <h3 style={{ fontSize: '1.05rem', color: '#16a34a', fontWeight: 700 }}>
                R$ {totalFreteReal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Custo Logístico (Mix)</p>
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
              <th style={thStyle}>Frete Cotado</th>
              <th style={{...thStyle, backgroundColor: '#f0fdf4', color: '#166534'}}>Frete Real</th>
              <th style={thStyle}>% Frete</th>
              <th style={thStyle}>Agendamento?</th>
              <th style={thStyle}>Previsão</th>
              <th style={thStyle}>Dt Entrega</th>
              <th style={thStyle}>Status</th>
              <th style={thAcoesStyle}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? ( <tr><td colSpan={19} style={{ textAlign: 'center', padding: '32px' }}>A carregar...</td></tr> ) : entregasFiltradas.length === 0 ? ( <tr><td colSpan={19} style={{ textAlign: 'center', padding: '32px' }}>Nenhuma entrega encontrada.</td></tr> ) : entregasFiltradas.map((entrega) => {
              
              const isFreteConfirmado = entrega.frete_confirmado;
              const freteColor = isFreteConfirmado ? '#166534' : 'inherit';
              const freteBg = isFreteConfirmado ? '#dcfce7' : 'transparent';

              const hasFreteReal = entrega.valor_frete_real !== null && entrega.valor_frete_real !== undefined && entrega.valor_frete_real !== '';
              const valorFreteCalculo = hasFreteReal ? entrega.valor_frete_real : entrega.valor_frete;

              return (
                <tr key={entrega.id} className="trow-hover">
                  <td style={tdStyle}>{formatarData(entrega.data_faturamento)}</td>
                  <td style={tdStyle}>{formatarData(entrega.data_coleta)}</td>
                  <td style={tdStyle}>{entrega.clientes?.nome || '-'}</td>
                  <td style={{ ...tdStyle, fontWeight: 'bold' }}>{entrega.cidade_destino || entrega.clientes?.cidade || '-'}</td>
                  <td style={{ ...tdStyle, fontWeight: 'bold' }}>{entrega.uf_destino || entrega.clientes?.uf || '-'}</td>
                  <td style={{ ...tdStyle, fontWeight: 'bold' }}>{entrega.volume ? `${entrega.volume} Cx` : '-'}</td>
                  <td style={{ ...tdStyle, fontWeight: 'bold' }}>{entrega.peso_kg ? `${entrega.peso_kg.toString().replace('.', ',')} Kg` : '-'}</td>
                  <td style={{ ...tdStyle, fontWeight: 'bold' }}>{entrega.nota_fiscal}</td>
                  <td style={tdStyle}>R$ {Number(entrega.valor_nf).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td style={tdStyle}>{entrega.transportadoras?.nome || '-'}</td>
                  <td style={tdStyle}>{entrega.modal_frete || entrega.transportadoras?.modal_padrao || '-'}</td>

                  <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>
                    R$ {Number(entrega.valor_frete).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  
                  <td style={{ ...tdStyle, backgroundColor: freteBg, color: freteColor, fontWeight: isFreteConfirmado ? 'bold' : 'normal' }}>
                    {hasFreteReal ? `R$ ${Number(entrega.valor_frete_real).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'} {isFreteConfirmado && '✅'}
                  </td>
                  
                  <td style={{ ...tdStyle, backgroundColor: freteBg, fontWeight: 'bold', color: isFreteConfirmado ? freteColor : '#0095DA' }}>
                    {calcularPorcentagemFrete(valorFreteCalculo, entrega.valor_nf)}
                  </td>
                  
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {entrega.tem_agendamento ? <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.70rem' }}>SIM</span> : <span style={{ backgroundColor: '#f1f5f9', color: '#64748b', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.70rem' }}>NÃO</span>}
                  </td>

                  <td style={tdStyle}>{formatarData(entrega.data_previsao)}</td>
                  <td style={tdStyle}>{formatarData(entrega.data_entrega_agendamento)}</td>
                  <td style={tdStyle}><span className="status-badge" style={getStatusColor(entrega.status)}>{entrega.status}</span></td>
                  
                  <td style={tdAcoesStyle}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button onClick={() => abrirModalEdicao(entrega)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }} title="Editar Entrega"><Edit size={18} /></button>
                      <button onClick={() => handleDeleteEntrega(entrega.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }} title="Excluir Entrega"><Trash2 size={18} /></button>
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