import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun, X } from 'lucide-react';
import { useAppData } from '../../state/context';
import { useTheme } from '../../hooks/useTheme';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { loadPrefRaw, savePref } from '../../lib/storage';
import { iniciais } from '../../lib/format';
import { useFeedback } from '../../feedback/context';
import { NAV, tituloDaRota } from './nav';
import { PageLoader } from './PageLoader';

export function AppLayout() {
  const { isAdmin, perfil, email, logout } = useAppData();
  const { confirm } = useFeedback();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const isTablet = useMediaQuery('(max-width: 1023px)');
  const [collapsedPref, setCollapsedPref] = useState<boolean | null>(() => loadPrefRaw<boolean | null>('menuRecolhido', null));
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Tablet: menu compacto por padrão; o usuário pode fixar a preferência.
  // Indicadores Diários tem navegação própria: o menu principal recolhe sozinho lá
  // (o usuário ainda pode expandir enquanto estiver na tela).
  const telaLarga = location.pathname.startsWith('/indicadores');
  const [expandirAqui, setExpandirAqui] = useState(false);
  const collapsed = telaLarga ? !expandirAqui : collapsedPref ?? isTablet;
  const toggleCollapsed = () => {
    if (telaLarga) { setExpandirAqui((v) => !v); return; }
    savePref('menuRecolhido', !collapsed); setCollapsedPref(!collapsed);
  };

  useEffect(() => { document.title = `${tituloDaRota(location.pathname)} · MunilaLog`; }, [location.pathname]);

  const sair = async () => {
    if (await confirm({ title: 'Encerrar sessão?', text: 'Você precisará entrar novamente com e-mail e senha.', confirmLabel: 'Sair' })) logout();
  };

  const nome = perfil?.nome || email;

  return (
    <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
      <aside className={`sidebar ${drawerOpen ? 'is-open' : ''}`} aria-label="Menu principal">
        <div className="sidebar__brand">
          <img src="/favicon.png" className="brand-mark" alt="" />
          <div className="brand-name">Munila<span>Log</span></div>
          <button className="icon-btn only-mobile" style={{ marginLeft: 'auto', color: '#fff' }} onClick={() => setDrawerOpen(false)} aria-label="Fechar menu"><X size={20} /></button>
        </div>

        <nav className="sidebar__nav">
          {NAV.map((group) => {
            const items = group.items.filter((i) => !i.admin || isAdmin);
            if (!items.length) return null;
            return (
              <div className="nav-group" key={group.label}>
                <div className="nav-group__label">{group.label}</div>
                {items.map(({ to, label, icon: Icon }) => (
                  <NavLink key={to} to={to} className="nav-link" title={collapsed ? label : undefined} onClick={() => setDrawerOpen(false)}>
                    <Icon size={19} />
                    <span className="nav-link__label">{label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          <div className="user-chip" title={email}>
            <div className="avatar">{iniciais(perfil?.nome || email)}</div>
            <div className="user-chip__text">
              <div className="user-chip__name">{nome}</div>
              <div className="user-chip__role">{isAdmin ? 'Administrador' : (perfil?.nivel_acesso ?? 'Operador')}</div>
            </div>
          </div>
          <div className="sidebar__actions">
            <button className="nav-btn" onClick={toggle} title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}>
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              <span className="nav-btn__label">{theme === 'dark' ? 'Claro' : 'Escuro'}</span>
            </button>
            <button className="nav-btn sidebar__collapse" onClick={toggleCollapsed} title={collapsed ? 'Expandir menu' : 'Recolher menu'}>
              {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
              <span className="nav-btn__label">Recolher</span>
            </button>
            <button className="nav-btn nav-btn--danger" onClick={sair} title="Sair">
              <LogOut size={17} />
              <span className="nav-btn__label">Sair</span>
            </button>
          </div>
        </div>
      </aside>

      {drawerOpen && <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} />}

      <main className="main" id="conteudo">
        <div className="topbar">
          <button className="icon-btn" onClick={() => setDrawerOpen(true)} aria-label="Abrir menu"><Menu size={22} /></button>
          <div className="topbar__title">{tituloDaRota(location.pathname)}</div>
          <button className="icon-btn" onClick={toggle} aria-label="Alternar tema">{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button>
        </div>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
