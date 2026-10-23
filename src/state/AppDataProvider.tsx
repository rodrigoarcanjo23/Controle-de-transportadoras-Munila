import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { fetchAll, SELECT_DEVOLUCAO, SELECT_ENTREGA, SELECT_META, setAuditUser } from '../lib/db';
import { FILTROS_VAZIOS, type FiltrosEntrega } from '../lib/filtrosEntrega';
import { loadPrefRaw, savePref } from '../lib/storage';
import { useFeedback } from '../feedback/context';
import type { Cliente, Devolucao, Entrega, MetaFrete, Perfil, Produto, Transportadora } from '../types';
import { AppDataContext, type AppData } from './context';

/**
 * Estado central do sistema: sessão, perfil, dados compartilhados e filtros
 * do Painel. Antes tudo isso ficava espalhado no App.tsx (≈570 linhas) e era
 * repassado por dezenas de props.
 */
export function AppDataProvider({ session, children }: { session: Session; children: ReactNode }) {
  const { toast } = useFeedback();
  const email = session.user.email ?? '';

  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [devolucoes, setDevolucoes] = useState<Devolucao[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([]);
  const [metas, setMetas] = useState<MetaFrete[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [perfisCarregados, setPerfisCarregados] = useState(false);
  const [loading, setLoading] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);

  const [filtros, setFiltrosState] = useState<FiltrosEntrega>(() => ({ ...FILTROS_VAZIOS, ...loadPrefRaw<Partial<FiltrosEntrega>>('filtros', {}) }));
  const setFiltros = useCallback<AppData['setFiltros']>((f) => {
    setFiltrosState((prev) => {
      const next = typeof f === 'function' ? f(prev) : f;
      savePref('filtros', next);
      return next;
    });
  }, []);

  useEffect(() => { setAuditUser(email); }, [email]);

  const falha = useCallback((oque: string, err: unknown) => {
    console.error(err);
    toast({ kind: 'error', title: `Não foi possível carregar ${oque}`, text: 'Verifique sua conexão e tente atualizar.' });
  }, [toast]);

  const recarregarEntregas = useCallback(async () => {
    try {
      const data = await fetchAll<Entrega>((from, to) =>
        supabase.from('entregas').select(SELECT_ENTREGA).order('data_faturamento', { ascending: false }).order('id').range(from, to));
      setEntregas(data);
    } catch (err) { falha('as entregas', err); }
  }, [falha]);

  const recarregarDevolucoes = useCallback(async () => {
    try {
      const data = await fetchAll<Devolucao>((from, to) =>
        supabase.from('devolucoes').select(SELECT_DEVOLUCAO).order('created_at', { ascending: false }).order('id').range(from, to));
      setDevolucoes(data);
    } catch (err) { falha('as devoluções', err); }
  }, [falha]);

  const recarregarCadastros = useCallback(async () => {
    try {
      const [c, t, m, p] = await Promise.all([
        fetchAll<Cliente>((f, to) => supabase.from('clientes').select('*').order('nome').range(f, to)),
        fetchAll<Transportadora>((f, to) => supabase.from('transportadoras').select('*').order('nome').range(f, to)),
        fetchAll<MetaFrete>((f, to) => supabase.from('metas_frete').select(SELECT_META).range(f, to)),
        fetchAll<Produto>((f, to) => supabase.from('produtos').select('*').order('nome').range(f, to)),
      ]);
      setClientes(c); setTransportadoras(t); setMetas(m); setProdutos(p);
    } catch (err) { falha('os cadastros', err); }
  }, [falha]);

  const recarregarPerfis = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('perfis').select('*').order('nome');
      if (error) throw error;
      setPerfis(data ?? []);
      setPerfisCarregados(true);
    } catch (err) {
      // Sem perfis carregados ninguém vira administrador por engano.
      falha('os perfis de acesso', err);
    }
  }, [falha]);

  const carregar = useCallback(async () => {
    await Promise.all([recarregarEntregas(), recarregarDevolucoes(), recarregarCadastros(), recarregarPerfis()]);
    setLoading(false);
    setAtualizadoEm(new Date());
  }, [recarregarEntregas, recarregarDevolucoes, recarregarCadastros, recarregarPerfis]);

  const recarregarTudo = useCallback(async () => { setLoading(true); await carregar(); }, [carregar]);

  // Carrega uma vez por usuário logado (antes carregava duas vezes ao abrir).
  // (busca assíncrona: os setState ocorrem após o await — falso positivo da regra set-state-in-effect)
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { carregar(); }, [session.user.id]);

  const perfil = perfis.find((p) => p.email?.toLowerCase() === email.toLowerCase());
  // Regra original preservada: sem nenhum perfil cadastrado, o primeiro acesso é administrador.
  const isAdmin = perfisCarregados && (perfis.length === 0 || perfil?.nivel_acesso === 'Administrador');

  const logout = useCallback(async () => { await supabase.auth.signOut(); }, []);

  const value = useMemo<AppData>(() => ({
    session, email, perfil, isAdmin, perfisCarregados,
    entregas, devolucoes, clientes, transportadoras, metas, produtos, perfis,
    loading, atualizadoEm,
    recarregarTudo, recarregarEntregas, recarregarDevolucoes, recarregarCadastros,
    setEntregas, setClientes, setMetas, setPerfis,
    filtros, setFiltros, logout,
  }), [session, email, perfil, isAdmin, perfisCarregados, entregas, devolucoes, clientes, transportadoras, metas, produtos, perfis,
    loading, atualizadoEm, recarregarTudo, recarregarEntregas, recarregarDevolucoes, recarregarCadastros, filtros, setFiltros, logout]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
