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
}

export function Header({
  searchTerm, setSearchTerm, mostrarFiltros, setMostrarFiltros,
  filtroDataInicio, setFiltroDataInicio, filtroDataFim, setFiltroDataFim,
  filtroTransportadora, setFiltroTransportadora, filtroModal, setFiltroModal,
  filtroStatus, setFiltroStatus, filtroFreteVazio, setFiltroFreteVazio, 
  filtroFreteConfirmado, setFiltroFreteConfirmado, 
  filtroComAgendamento, setFiltroComAgendamento, // NOVO
  filtroSemAgendamento, setFiltroSemAgendamento, // NOVO
  transportadoras, limparFiltros,
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
        <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          
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
              <option value="Pendente agendamento">Pendente agendamento</option>
              <option value="Aguardando coleta">Aguardando coleta</option>
              <option value="Solicitado Agendamento">Solicitado Agendamento</option>
              <option value="Agendado">Agendado</option>
              <option value="Em Transporte">Em Transporte</option>
              <option value="Entregue">Entregue</option>
              <option value="Atrasado">Atrasado</option>
              <option value="Devolução">Devolução</option>
              <option value="Frete Conferido">Frete Conferido</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', marginLeft: 'auto' }}>
            {/* GRUPO DE FRETES */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="freteVazio" checked={filtroFreteVazio} onChange={(e) => setFiltroFreteVazio(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#ef4444' }} />
                <label htmlFor="freteVazio" style={{ fontSize: '0.85rem', cursor: 'pointer', margin: 0, color: '#ef4444', fontWeight: 'bold' }}>Exibir Fretes Zerados</label>
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="freteConfirmadoFiltro" checked={filtroFreteConfirmado} onChange={(e) => setFiltroFreteConfirmado(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#16a34a' }} />
                <label htmlFor="freteConfirmadoFiltro" style={{ fontSize: '0.85rem', cursor: 'pointer', margin: 0, color: '#166534', fontWeight: 'bold' }}>Apenas Fretes Confirmados</label>
              </div>
            </div>

            {/* GRUPO DE AGENDAMENTOS (NOVOS) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="comAgendamento" checked={filtroComAgendamento} onChange={(e) => setFiltroComAgendamento(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#8b5cf6' }} />
                <label htmlFor="comAgendamento" style={{ fontSize: '0.85rem', cursor: 'pointer', margin: 0, color: '#6d28d9', fontWeight: 'bold' }}>Com Agendamento (SIM)</label>
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="semAgendamento" checked={filtroSemAgendamento} onChange={(e) => setFiltroSemAgendamento(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#64748b' }} />
                <label htmlFor="semAgendamento" style={{ fontSize: '0.85rem', cursor: 'pointer', margin: 0, color: '#475569', fontWeight: 'bold' }}>Sem Agendamento (NÃO)</label>
              </div>
            </div>
            
            <button 
              type="button" 
              onClick={limparFiltros}
              style={{ padding: '10px 16px', backgroundColor: 'white', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, height: '42px', marginLeft: '8px' }}
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      )}
    </div>
  );
}