import { Search, Filter, Download, Plus } from 'lucide-react';

export function Header(props: any) {
  const {
    searchTerm, setSearchTerm,
    mostrarFiltros, setMostrarFiltros,
    filtroDataInicio, setFiltroDataInicio,
    filtroDataFim, setFiltroDataFim,
    filtroTransportadora, setFiltroTransportadora,
    filtroModal, setFiltroModal,
    filtroStatus, setFiltroStatus,
    filtroFreteVazio, setFiltroFreteVazio,
    filtroFreteConfirmado, setFiltroFreteConfirmado,
    filtroComAgendamento, setFiltroComAgendamento,
    filtroSemAgendamento, setFiltroSemAgendamento,
    filtroComFreteCotado, setFiltroComFreteCotado,
    filtroComFreteReal, setFiltroComFreteReal,
    
    filtroUf, setFiltroUf,
    filtroSemDataEntrega, setFiltroSemDataEntrega,
    filtroValorNfMin, setFiltroValorNfMin,
    filtroValorNfMax, setFiltroValorNfMax,
    filtroPercFreteMin, setFiltroPercFreteMin,
    filtroPercFreteMax, setFiltroPercFreteMax,
    
    // NOSSAS DUAS NOVAS DATAS DE ENTRADA DO PEDIDO
    filtroDataEntradaInicio, setFiltroDataEntradaInicio,
    filtroDataEntradaFim, setFiltroDataEntradaFim,

    transportadoras, limparFiltros,
    exportarParaExcel, abrirModalNovaEntrega
  } = props;

  const estadosBR = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

  const toggleStatus = (status: string) => {
    if (filtroStatus.includes(status)) {
      setFiltroStatus(filtroStatus.filter((s: string) => s !== status));
    } else {
      setFiltroStatus([...filtroStatus, status]);
    }
  };

  const statusOptions = [
    'Pendente', 'Pendente agendamento', 'Aguardando coleta', 'Solicitado Agendamento', 
    'Agendado', 'Em Transporte', 'Entregue', 'Atrasado', 'Devolução', 'Frete Conferido'
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', color: 'var(--text-main)', margin: 0 }}>Acompanhamento Logístico</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Gerenciamento de entregas de 2026</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '10px' }} />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Buscar NF, Cliente ou Status..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              style={{ paddingLeft: '36px', width: '250px' }} 
            />
          </div>

          <button 
            type="button" 
            className="btn-secondary" 
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: mostrarFiltros ? '#f1f5f9' : 'white' }}
          >
            <Filter size={18} /> Filtros
          </button>

          <button 
            type="button" 
            className="btn-secondary" 
            onClick={exportarParaExcel}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', borderColor: '#16a34a' }}
          >
            <Download size={18} /> Exportar
          </button>

          <button 
            type="button" 
            className="btn-primary" 
            onClick={abrirModalNovaEntrega}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={18} /> Nova Entrega
          </button>
        </div>
      </div>

      {mostrarFiltros && (
        <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
            
            {/* NOVO: DATAS DE ENTRADA DO PEDIDO */}
            <div style={{ display: 'flex', gap: '12px', backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
              <div className="form-group" style={{ flex: '1 1 120px', margin: 0 }}>
                <label style={{ color: '#166534', fontWeight: 'bold' }}>Início (Entrada)</label>
                <input type="date" className="form-input" value={filtroDataEntradaInicio} onChange={e => setFiltroDataEntradaInicio(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: '1 1 120px', margin: 0 }}>
                <label style={{ color: '#166534', fontWeight: 'bold' }}>Fim (Entrada)</label>
                <input type="date" className="form-input" value={filtroDataEntradaFim} onChange={e => setFiltroDataEntradaFim(e.target.value)} />
              </div>
            </div>

            <div className="form-group" style={{ flex: '1 1 120px', margin: 0 }}>
              <label>Data Início (Fat.)</label>
              <input type="date" className="form-input" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: '1 1 120px', margin: 0 }}>
              <label>Data Fim (Fat.)</label>
              <input type="date" className="form-input" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: '2 1 200px', margin: 0 }}>
              <label>Transportadora</label>
              <select className="form-select" value={filtroTransportadora} onChange={e => setFiltroTransportadora(e.target.value)}>
                <option value="">Todas as Transp.</option>
                {transportadoras.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: '1 1 150px', margin: 0 }}>
              <label>Modal</label>
              <select className="form-select" value={filtroModal} onChange={e => setFiltroModal(e.target.value)}>
                <option value="">Todos</option>
                <option value="AÉREO">Aéreo</option>
                <option value="RODOVIÁRIO">Rodoviário</option>
                <option value="PAC">PAC</option>
                <option value="SEDEX">Sedex</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: '1 1 100px', margin: 0 }}>
              <label>Estado (UF)</label>
              <select className="form-select" value={filtroUf} onChange={e => setFiltroUf(e.target.value)}>
                <option value="">Todos</option>
                {estadosBR.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div className="form-group" style={{ margin: 0, width: '130px' }}>
                <label>Valor NF (Mín) R$</label>
                <input type="number" step="0.01" className="form-input" value={filtroValorNfMin} onChange={e => setFiltroValorNfMin(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0, width: '130px' }}>
                <label>Valor NF (Máx) R$</label>
                <input type="number" step="0.01" className="form-input" value={filtroValorNfMax} onChange={e => setFiltroValorNfMax(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0, width: '110px' }}>
                <label>% Frete (Mín)</label>
                <input type="number" step="0.01" className="form-input" value={filtroPercFreteMin} onChange={e => setFiltroPercFreteMin(e.target.value)} placeholder="Ex: 2.5" />
              </div>
              <div className="form-group" style={{ margin: 0, width: '110px' }}>
                <label>% Frete (Máx)</label>
                <input type="number" step="0.01" className="form-input" value={filtroPercFreteMax} onChange={e => setFiltroPercFreteMax(e.target.value)} placeholder="Ex: 15" />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginLeft: 'auto', marginTop: '8px' }}>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.80rem', cursor: 'pointer', color: '#ef4444' }}>
                  <input type="checkbox" checked={filtroFreteVazio} onChange={e => setFiltroFreteVazio(e.target.checked)} /> Exibir Fretes Zerados
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.80rem', cursor: 'pointer', color: '#16a34a' }}>
                  <input type="checkbox" checked={filtroFreteConfirmado} onChange={e => setFiltroFreteConfirmado(e.target.checked)} /> Apenas Fretes Confirmados
                </label>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.80rem', cursor: 'pointer', color: '#6b21a8' }}>
                  <input type="checkbox" checked={filtroComAgendamento} onChange={e => setFiltroComAgendamento(e.target.checked)} /> Com Agendamento (SIM)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.80rem', cursor: 'pointer', color: '#475569' }}>
                  <input type="checkbox" checked={filtroSemAgendamento} onChange={e => setFiltroSemAgendamento(e.target.checked)} /> Sem Agendamento (NÃO)
                </label>
              </div>
              
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.80rem', cursor: 'pointer', color: '#0284c7' }}>
                  <input type="checkbox" checked={filtroComFreteCotado} onChange={e => setFiltroComFreteCotado(e.target.checked)} /> Apenas com Frete Cotado
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.80rem', cursor: 'pointer', color: '#166534' }}>
                  <input type="checkbox" checked={filtroComFreteReal} onChange={e => setFiltroComFreteReal(e.target.checked)} /> Apenas com Frete Real
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.80rem', cursor: 'pointer', color: '#ea580c' }}>
                  <input type="checkbox" checked={filtroSemDataEntrega} onChange={e => setFiltroSemDataEntrega(e.target.checked)} /> NFs sem Data Entrega
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', marginLeft: '16px', marginTop: '14px' }}>
              <button type="button" className="btn-secondary" style={{ color: '#ef4444', borderColor: '#ef4444', height: '42px' }} onClick={limparFiltros}>
                Limpar Filtros
              </button>
            </div>
          </div>

          <div className="form-group" style={{ margin: '16px 0 0 0' }}>
            <label style={{ fontWeight: 'bold' }}>Status da Entrega (Múltipla Escolha)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
              {statusOptions.map(status => (
                <label key={status} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: filtroStatus.includes(status) ? '#e0f2fe' : '#f8fafc', border: `1px solid ${filtroStatus.includes(status) ? '#bae6fd' : '#e2e8f0'}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.80rem', color: filtroStatus.includes(status) ? '#0369a1' : '#475569', transition: 'all 0.2s' }}>
                  <input type="checkbox" checked={filtroStatus.includes(status)} onChange={() => toggleStatus(status)} style={{ display: 'none' }} />
                  <div style={{ width: '14px', height: '14px', borderRadius: '3px', border: `1px solid ${filtroStatus.includes(status) ? '#0284c7' : '#cbd5e1'}`, backgroundColor: filtroStatus.includes(status) ? '#0284c7' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {filtroStatus.includes(status) && <div style={{ width: '8px', height: '8px', backgroundColor: 'white', borderRadius: '1px' }}></div>}
                  </div>
                  {status}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}