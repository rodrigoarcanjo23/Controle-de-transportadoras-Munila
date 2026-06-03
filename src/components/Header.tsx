import { Search, Filter, Download } from 'lucide-react';

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
  searchTerm, setSearchTerm,
  mostrarFiltros, setMostrarFiltros,
  filtroDataInicio, setFiltroDataInicio,
  filtroDataFim, setFiltroDataFim,
  filtroTransportadora, setFiltroTransportadora,
  filtroModal, setFiltroModal,
  filtroStatus, setFiltroStatus,
  transportadoras,
  limparFiltros,
  exportarParaExcel,
  abrirModalNovaEntrega
}: HeaderProps) {

  return (
    <header className="header" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-start' }}>
        <div>
          <h2>Acompanhamento Logístico</h2>
          <p>Gerenciamento de entregas de 2026</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input 
              type="text" 
              placeholder="Buscar NF, Cliente ou Status..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              style={{ padding: '10px 12px 10px 38px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', width: '220px' }} 
            />
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

      {/* BARRA DE FILTROS AVANÇADOS */}
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
            <button className="btn-secondary" onClick={limparFiltros} style={{ padding: '8px 16px', color: '#ef4444', borderColor: '#ef4444' }}>Limpar Filtros</button>
          </div>
        </div>
      )}
    </header>
  );
}