import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { FeedbackProvider } from './feedback/FeedbackProvider';
import { AppDataProvider } from './state/AppDataProvider';
import { useAppData } from './state/context';
import { AppLayout } from './components/layout/AppLayout';
import { PageLoader } from './components/layout/PageLoader';
import { Login } from './pages/Login';

// Cada tela é carregada sob demanda: a primeira abertura fica bem mais leve
// (gráficos e geração de PDF só baixam quando o BI é aberto).
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Analise = lazy(() => import('./pages/Analise'));
const Financeiro = lazy(() => import('./pages/Financeiro'));
const Logistica = lazy(() => import('./pages/Logistica'));
const Calculadora = lazy(() => import('./pages/Calculadora'));
const Equipe = lazy(() => import('./pages/Equipe'));
const Clientes = lazy(() => import('./pages/Clientes'));
const Transportadoras = lazy(() => import('./pages/Transportadoras'));
const Devolucoes = lazy(() => import('./pages/Devolucoes'));
const Ctes = lazy(() => import('./pages/Ctes'));
const Auditoria = lazy(() => import('./pages/Auditoria'));
const Indicadores = lazy(() => import('./pages/indicadores/Indicadores'));
const Alertas = lazy(() => import('./pages/Alertas'));
const Portal = lazy(() => import('./pages/portal/Portal'));
const Expedicao = lazy(() => import('./pages/Expedicao'));
const Faturas = lazy(() => import('./pages/Faturas'));
const Avaliacao = lazy(() => import('./pages/Avaliacao'));

/** Rotas exclusivas de administrador (aguarda os perfis antes de decidir). */
function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin, perfisCarregados } = useAppData();
  if (!perfisCarregados) return <PageLoader />;
  return isAdmin ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

function Rotas() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="analise" element={<Analise />} />
        <Route path="financeiro" element={<Financeiro />} />
        <Route path="logistica" element={<Logistica />} />
        <Route path="calculadora" element={<Calculadora />} />
        <Route path="indicadores/:pagina?" element={<Indicadores />} />
        <Route path="alertas" element={<Alertas />} />
        <Route path="expedicao" element={<Expedicao />} />
        <Route path="faturas" element={<Faturas />} />
        <Route path="avaliacao" element={<Avaliacao />} />
        <Route path="equipe" element={<AdminOnly><Equipe /></AdminOnly>} />
        <Route path="clientes" element={<AdminOnly><Clientes /></AdminOnly>} />
        <Route path="transportadoras" element={<AdminOnly><Transportadoras /></AdminOnly>} />
        <Route path="devolucoes" element={<AdminOnly><Devolucoes /></AdminOnly>} />
        <Route path="ctes" element={<AdminOnly><Ctes /></AdminOnly>} />
        <Route path="auditoria" element={<AdminOnly><Auditoria /></AdminOnly>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // Portal do transportador: página pública (sem login), aberta pelo link enviado à transportadora
  if (window.location.pathname.startsWith('/portal/')) {
    return <FeedbackProvider><Suspense fallback={<PageLoader />}><Portal /></Suspense></FeedbackProvider>;
  }

  if (!ready) return null;

  return (
    <FeedbackProvider>
      {!session ? (
        <Login />
      ) : (
        <AppDataProvider key={session.user.id} session={session}>
          <BrowserRouter>
            <Rotas />
          </BrowserRouter>
        </AppDataProvider>
      )}
    </FeedbackProvider>
  );
}
