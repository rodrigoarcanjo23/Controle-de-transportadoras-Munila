import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Menu, X } from 'lucide-react';

interface LayoutProps {
  handleLogout: () => void;
  isAdmin: boolean; // <-- RECEBE A INFORMAÇÃO DE SEGURANÇA
}

export function Layout({ handleLogout, isAdmin }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="app-container">
      <button 
        className="mobile-menu-toggle" 
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        type="button"
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <div className={`sidebar-wrapper ${isMobileMenuOpen ? 'open' : ''}`}>
        {/* REPASSA O isAdmin PARA A SIDEBAR */}
        <Sidebar handleLogout={handleLogout} onNavigate={() => setIsMobileMenuOpen(false)} isAdmin={isAdmin} />
      </div>
      
      {isMobileMenuOpen && (
        <div className="sidebar-overlay-backdrop" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}