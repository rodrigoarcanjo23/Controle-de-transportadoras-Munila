import { LayoutDashboard, Truck, RefreshCcw, Calculator, Users, LogOut, UserCircle } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  handleLogout: () => void;
}

export function Sidebar({ activeTab, setActiveTab, handleLogout }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>MunilaLog</h1>
      </div>
      <nav className="sidebar-nav" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <ul className="nav-list">
          <li className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <LayoutDashboard size={20} /> Painel Principal
          </li>
          <li className={`nav-item ${activeTab === 'equipe' ? 'active' : ''}`} onClick={() => setActiveTab('equipe')}>
            <UserCircle size={20} /> Equipe
          </li>
          <li className={`nav-item ${activeTab === 'clientes' ? 'active' : ''}`} onClick={() => setActiveTab('clientes')}>
            <Users size={20} /> Clientes & Metas
          </li>
          <li className={`nav-item ${activeTab === 'transportadoras' ? 'active' : ''}`} onClick={() => setActiveTab('transportadoras')}>
            <Truck size={20} /> Transportadoras
          </li>
          <li className={`nav-item ${activeTab === 'devolucoes' ? 'active' : ''}`} onClick={() => setActiveTab('devolucoes')}>
            <RefreshCcw size={20} /> Devoluções
          </li>
          <li className={`nav-item ${activeTab === 'dpsp' ? 'active' : ''}`} onClick={() => setActiveTab('dpsp')}>
            {/* O TEXTO FOI ALTERADO AQUI */}
            <Calculator size={20} /> Calculadora
          </li>
        </ul>
        <button className="btn-logout" onClick={handleLogout}>
          <LogOut size={20} /> Terminar Sessão
        </button>
      </nav>
    </aside>
  );
}