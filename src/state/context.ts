import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Cliente, Devolucao, Entrega, MetaFrete, Perfil, Produto, Transportadora } from '../types';
import type { FiltrosEntrega } from '../lib/filtrosEntrega';

export interface AppData {
  session: Session;
  email: string;
  perfil?: Perfil;
  isAdmin: boolean;
  perfisCarregados: boolean;

  entregas: Entrega[];
  devolucoes: Devolucao[];
  clientes: Cliente[];
  transportadoras: Transportadora[];
  metas: MetaFrete[];
  produtos: Produto[];
  perfis: Perfil[];

  loading: boolean;
  atualizadoEm: Date | null;

  recarregarTudo: () => Promise<void>;
  recarregarEntregas: () => Promise<void>;
  recarregarDevolucoes: () => Promise<void>;
  recarregarCadastros: () => Promise<void>;

  setEntregas: React.Dispatch<React.SetStateAction<Entrega[]>>;
  setClientes: React.Dispatch<React.SetStateAction<Cliente[]>>;
  setMetas: React.Dispatch<React.SetStateAction<MetaFrete[]>>;
  setPerfis: React.Dispatch<React.SetStateAction<Perfil[]>>;

  filtros: FiltrosEntrega;
  setFiltros: (f: FiltrosEntrega | ((prev: FiltrosEntrega) => FiltrosEntrega)) => void;

  logout: () => Promise<void>;
}

export const AppDataContext = createContext<AppData | null>(null);

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData fora do AppDataProvider');
  return ctx;
}
