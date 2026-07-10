import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, UserSquare2, Truck, RefreshCcw, Calculator, LogOut, FileText } from 'lucide-react';

interface SidebarProps {
  handleLogout: () => void;
  onNavigate?: () => void; // Propriedade para controlar o fecho no mobile
}

export function Sidebar({ handleLogout, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>MunilaLog</h1>
      </div>
      <nav className="sidebar-nav">
        <ul className="nav-list">
          <li>
            <NavLink to="/dashboard" onClick={onNavigate} className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
              <LayoutDashboard size={20} /> Painel Principal
            </NavLink>
          </li>
          <li>
            <NavLink to="/equipe" onClick={onNavigate} className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
              <Users size={20} /> Equipe
            </NavLink>
          </li>
          <li>
            <NavLink to="/clientes" onClick={onNavigate} className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
              <UserSquare2 size={20} /> Clientes & Metas
            </NavLink>
          </li>
          <li>
            <NavLink to="/transportadoras" onClick={onNavigate} className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
              <Truck size={20} /> Transportadoras
            </NavLink>
          </li>
          <li>
            <NavLink to="/devolucoes" onClick={onNavigate} className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
              <RefreshCcw size={20} /> Devoluções
            </NavLink>
          </li>
          <li>
            <NavLink to="/calculadora" onClick={onNavigate} className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
              <Calculator size={20} /> Calculadora
            </NavLink>
          </li>
          {/* NOVO LINK DO CTE */}
          <li>
            <NavLink to="/ctes" onClick={onNavigate} className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
              <FileText size={20} /> Registro de CTE
            </NavLink>
          </li>
        </ul>
        
        <button 
          className="btn-logout" 
          onClick={handleLogout} 
          style={{ marginTop: 'auto', border: 'none', background: 'none', width: '100%', display: 'flex', justifyContent: 'center', padding: '16px' }}
        >
          <LogOut size={20} /> Terminar Sessão
        </button>
      </nav>
    </aside>
  );
}