import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  handleLogout: () => void;
}

export function Layout({ handleLogout }: LayoutProps) {
  return (
    <div className="app-container">
      {/* O Menu Lateral fica fixo aqui */}
      <Sidebar handleLogout={handleLogout} />
      
      {/* O <Outlet /> é o "buraco" onde as páginas (Dashboard, Devoluções, etc) vão aparecer */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}