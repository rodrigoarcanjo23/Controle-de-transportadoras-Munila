-- =====================================================================
--  MunilaLog — Segurança (RLS) + tempo real + fechamento mensal + alertas
--  Execute UMA vez no Supabase: Dashboard › SQL Editor › New query › Run
--  Pode rodar de novo sem problema.
--
--  O que muda:
--   • Ninguém sem login acessa mais nada pela API (antes, quem tivesse a
--     chave pública do site podia ler e gravar direto no banco).
--   • Usuário logado (Operador) CONSULTA tudo e lança os Indicadores Diários.
--   • Criar/editar/excluir entregas, CTEs, devoluções, clientes, metas,
--     transportadoras, produtos e equipe: somente Administrador
--     (exatamente as mesmas regras que as telas já aplicam).
--   • Auditoria: cada usuário só registra ações em seu próprio nome; ninguém
--     edita ou apaga o histórico.
--
--  Se algo der errado, rode supabase/reverter_seguranca.sql.
-- =====================================================================

-- 0) Guarda as políticas que existiam antes (para consulta/reversão) ----
create table if not exists public._backup_policies (
  salvo_em   timestamptz not null default now(),
  tabela     text, politica text, comando text, papeis text[], usando text, verificando text
);
insert into public._backup_policies (tabela, politica, comando, papeis, usando, verificando)
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('entregas','ctes','devolucoes','clientes','transportadoras','metas_frete','produtos','perfis','logs_auditoria')
  and not exists (select 1 from public._backup_policies);   -- só na primeira execução
alter table public._backup_policies enable row level security;  -- ninguém lê pela API

-- 1) Quem é administrador? ---------------------------------------------
-- Mesma regra da tela: perfil "Administrador" pelo e-mail do login.
-- Enquanto não houver NENHUM perfil cadastrado, todo usuário logado é
-- administrador (primeiro acesso), igual ao sistema.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
           select 1 from public.perfis p
           where lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
             and p.nivel_acesso = 'Administrador')
      or not exists (select 1 from public.perfis);
$$;

-- 2) Políticas por tabela ----------------------------------------------
do $$
declare
  t text;
  p record;
begin
  foreach t in array array['entregas','ctes','devolucoes','clientes','transportadoras','metas_frete','produtos','perfis'] loop
    if to_regclass('public.' || t) is null then
      raise notice 'Tabela % não existe — pulando', t;
      continue;
    end if;
    -- remove políticas antigas (ex.: "Enable read access for all users", que liberavam o acesso anônimo)
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "ler (logado)" on public.%I for select to authenticated using (true)', t);
    execute format('create policy "inserir (admin)" on public.%I for insert to authenticated with check (public.is_admin())', t);
    execute format('create policy "alterar (admin)" on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('create policy "excluir (admin)" on public.%I for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- Auditoria: todos consultam (histórico por NF); cada um grava em seu nome; ninguém altera/apaga.
do $$
declare p record;
begin
  if to_regclass('public.logs_auditoria') is not null then
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'logs_auditoria' loop
      execute format('drop policy if exists %I on public.logs_auditoria', p.policyname);
    end loop;
    alter table public.logs_auditoria enable row level security;
    create policy "ler (logado)" on public.logs_auditoria for select to authenticated using (true);
    create policy "registrar (próprio usuário)" on public.logs_auditoria for insert to authenticated
      with check (lower(usuario_email) = lower(coalesce(auth.jwt() ->> 'email', '')));
  end if;
end $$;

-- 3) Fechamento mensal (números do BI congelados) -----------------------
create table if not exists public.fechamentos_mensais (
  id          uuid primary key default gen_random_uuid(),
  mes         text not null unique check (mes ~ '^\d{4}-\d{2}$'),  -- ex.: 2026-09
  dados       jsonb not null,                                       -- foto do Painel de BI
  observacao  text,
  fechado_por text,
  created_at  timestamptz not null default now()
);
alter table public.fechamentos_mensais enable row level security;
drop policy if exists "ler (logado)"     on public.fechamentos_mensais;
drop policy if exists "fechar (admin)"   on public.fechamentos_mensais;
drop policy if exists "reabrir (admin)"  on public.fechamentos_mensais;
create policy "ler (logado)"    on public.fechamentos_mensais for select to authenticated using (true);
create policy "fechar (admin)"  on public.fechamentos_mensais for insert to authenticated with check (public.is_admin());
create policy "reabrir (admin)" on public.fechamentos_mensais for delete to authenticated using (public.is_admin());

-- 4) Configuração dos alertas diários -----------------------------------
-- (a tabela "configuracoes" vem do SQL dos Indicadores Diários)
create table if not exists public.configuracoes (
  chave text primary key, valor jsonb not null, updated_at timestamptz not null default now()
);
insert into public.configuracoes (chave, valor)
values ('alertas', '{"ativo": false, "emails": [], "dias_sem_cte": 15, "dias_aguardando_coleta": 2, "dias_devolucao_aberta": 15, "margem_cotado_pct": 10}'::jsonb)
on conflict (chave) do nothing;

-- 5) Tempo real: o Painel atualiza sozinho quando alguém altera ---------
do $$
declare t text;
begin
  foreach t in array array['entregas','devolucoes'] loop
    if to_regclass('public.' || t) is not null and not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Conferência: deve listar as tabelas com RLS ligado (rowsecurity = true)
select tablename, rowsecurity from pg_tables
where schemaname = 'public'
  and tablename in ('entregas','ctes','devolucoes','clientes','transportadoras','metas_frete','produtos','perfis',
                    'logs_auditoria','indicadores_diarios','configuracoes','fechamentos_mensais')
order by tablename;
