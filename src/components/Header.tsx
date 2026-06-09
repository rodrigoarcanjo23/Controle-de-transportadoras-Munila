import { Search, Filter, Download, Plus } from 'lucide-react';

interface HeaderProps {
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
}

export function Header({
  searchTerm, setSearchTerm, mostrarFiltros, setMostrarFiltros,
  filtroDataInicio, setFiltroDataInicio, filtroDataFim, setFiltroDataFim,
  filtroTransportadora, setFiltroTransportadora, filtroModal, setFiltroModal,
  filtroStatus, setFiltroStatus, transportadoras, limparFiltros,
  exportarParaExcel, abrirModalNovaEntrega
}: HeaderProps) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div className="header">
        <div>
          <h2>Acompanhamento Logístico</h2>
          <p>Gerenciamento de entregas de {new Date().getFullYear()}</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
            <input 
              type="text" 
              placeholder="Buscar NF, Cliente ou Status..." 
              className="form-input" 
              style={{ paddingLeft: '36px', width: '250px' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <button 
            className="btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: mostrarFiltros ? '#f1f5f9' : 'white' }}
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
          >
            <Filter size={18} /> Filtros
          </button>
          
          <button className="btn-secondary" onClick={exportarParaExcel} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Download size={18} /> Exportar
          </button>

          <button className="btn-primary" onClick={abrirModalNovaEntrega}>
            <Plus size={18} /> Nova Entrega
          </button>
        </div>
      </div>

      {mostrarFiltros && (
        <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group">
            <label style={{ fontSize: '0.75rem' }}>Data Início (Fat.)</label>
            <input type="date" className="form-input" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} />
          </div>
          <div className="form-group">
            <label style={{ fontSize: '0.75rem' }}>Data Fim (Fat.)</label>
            <input type="date" className="form-input" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} />
          </div>
          <div className="form-group">
            <label style={{ fontSize: '0.75rem' }}>Transportadora</label>
            <select className="form-select" value={filtroTransportadora} onChange={(e) => setFiltroTransportadora(e.target.value)}>
              <option value="">Todas as Transp.</option>
              {transportadoras.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label style={{ fontSize: '0.75rem' }}>Modal</label>
            <select className="form-select" value={filtroModal} onChange={(e) => setFiltroModal(e.target.value)}>
              <option value="">Todos</option>
              <option value="AÉREO">Aéreo</option>
              <option value="RODOVIÁRIO">Rodoviário</option>
              <option value="PAC">PAC</option>
              <option value="SEDEX">Sedex</option>
            </select>
          </div>
          
          <div className="form-group">
            <label style={{ fontSize: '0.75rem' }}>Status da Entrega</label>
            <select className="form-select" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="Pendente">Pendente</option>
              <option value="Solicitado Agendamento">Solicitado Agendamento</option>
              <option value="Agendado">Agendado</option>
              <option value="Em Transporte">Em Transporte</option>
              <option value="Entregue">Entregue</option>
              <option value="Atrasado">Atrasado</option>
              <option value="Devolução">Devolução</option>
            </select>
          </div>
          
          <button 
            type="button" 
            onClick={limparFiltros}
            style={{ padding: '10px 16px', backgroundColor: 'white', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
          >
            Limpar Filtros
          </button>
        </div>
      )}
    </div>
  );
}