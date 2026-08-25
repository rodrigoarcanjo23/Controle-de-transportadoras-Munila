import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, UserSquare2, Truck, RefreshCcw, Calculator, LogOut, FileText, ShieldAlert, PieChart } from 'lucide-react';

interface SidebarProps {
  handleLogout: () => void;
  onNavigate?: () => void;
  isAdmin: boolean; // <-- LÊ A PERMISSÃO
}

export function Sidebar({ handleLogout, onNavigate, isAdmin }: SidebarProps) {
  
  const getNavClass = ({ isActive }: { isActive: boolean }) => {
    return isActive ? "nav-item active" : "nav-item";
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>MunilaLog</h1>
      </div>
      <nav className="sidebar-nav">
        <ul className="nav-list">
          <li>
            <NavLink to="/dashboard" onClick={onNavigate} className={getNavClass}>
              <LayoutDashboard size={20} /> Painel Principal
            </NavLink>
          </li>
          
          <li>
            <NavLink to="/analise" onClick={onNavigate} className={getNavClass}>
              <PieChart size={20} /> Painel de BI (Análise)
            </NavLink>
          </li>

          {/* SÓ MOSTRA O MENU EQUIPE SE FOR ADMIN */}
          {isAdmin && (
            <li>
              <NavLink to="/equipe" onClick={onNavigate} className={getNavClass}>
                <Users size={20} /> Equipe
              </NavLink>
            </li>
          )}

          <li>
            <NavLink to="/clientes" onClick={onNavigate} className={getNavClass}>
              <UserSquare2 size={20} /> Clientes & Metas
            </NavLink>
          </li>
          <li>
            <NavLink to="/transportadoras" onClick={onNavigate} className={getNavClass}>
              <Truck size={20} /> Transportadoras
            </NavLink>
          </li>
          <li>
            <NavLink to="/devolucoes" onClick={onNavigate} className={getNavClass}>
              <RefreshCcw size={20} /> Devoluções
            </NavLink>
          </li>
          <li>
            <NavLink to="/calculadora" onClick={onNavigate} className={getNavClass}>
              <Calculator size={20} /> Calculadora
            </NavLink>
          </li>
          <li>
            <NavLink to="/ctes" onClick={onNavigate} className={getNavClass}>
              <FileText size={20} /> Registro de CTE
            </NavLink>
          </li>

          {/* SÓ MOSTRA A AUDITORIA SE FOR ADMIN */}
          {isAdmin && (
            <li>
              <NavLink to="/auditoria" onClick={onNavigate} className={getNavClass}>
                <ShieldAlert size={20} /> Auditoria
              </NavLink>
            </li>
          )}
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