import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Menu, X } from 'lucide-react';

interface LayoutProps {
  handleLogout: () => void;
}

export function Layout({ handleLogout }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="app-container">
      {/* Botão de Menu Hambúrguer (Oculto no Desktop via CSS) */}
      <button 
        className="mobile-menu-toggle" 
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        type="button"
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Wrapper isolador da Sidebar para transição mobile */}
      <div className={`sidebar-wrapper ${isMobileMenuOpen ? 'open' : ''}`}>
        <Sidebar handleLogout={handleLogout} onNavigate={() => setIsMobileMenuOpen(false)} />
      </div>
      
      {/* Máscara escura ao abrir o menu no celular */}
      {isMobileMenuOpen && (
        <div className="sidebar-overlay-backdrop" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}