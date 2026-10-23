-- =====================================================================
--  MunilaLog — Indicadores Diários do Armazém
--  Execute UMA vez no Supabase: Dashboard › SQL Editor › New query › Run
--  (é seguro rodar de novo: tudo usa "if not exists" / "or replace")
-- =====================================================================

-- 1) Lançamentos diários: um registro por ÁREA e por DIA ----------------
create table if not exists public.indicadores_diarios (
  id             uuid primary key default gen_random_uuid(),
  area           text not null
                 check (area in ('recebimento','armazenagem','expedicao','coleta','devolucoes')),
  data           date not null,                       -- dia do lançamento (na Expedição = data do pedido)
  valores        jsonb not null default '{}'::jsonb,  -- números do dia (ex.: {"nfs": 12, "volumes": 340})
  notas          jsonb not null default '[]'::jsonb,  -- lista de NFs do dia (Recebimento e Expedição)
  atualizado_por text,                                -- e-mail de quem salvou por último
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint indicadores_diarios_area_data_key unique (area, data)
);

create index if not exists indicadores_diarios_data_idx on public.indicadores_diarios (data);

comment on table public.indicadores_diarios is 'Indicadores Diários do armazém (Recebimento, Armazenagem, Expedição, Coleta, Devoluções).';

-- atualiza updated_at automaticamente
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_indicadores_diarios_updated on public.indicadores_diarios;
create trigger trg_indicadores_diarios_updated
  before update on public.indicadores_diarios
  for each row execute function public.set_updated_at();

-- 2) Configurações gerais (ex.: prazo de coleta em dias úteis) ---------
create table if not exists public.configuracoes (
  chave      text primary key,
  valor      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.configuracoes (chave, valor)
values ('prazo_coleta_dias', '1'::jsonb)
on conflict (chave) do nothing;

-- 3) Segurança (RLS) ----------------------------------------------------
-- Função auxiliar: o usuário logado é Administrador na tabela "perfis"?
-- (security definer: funciona mesmo que "perfis" tenha RLS própria)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.perfis p
    where lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and p.nivel_acesso = 'Administrador'
  );
$$;

alter table public.indicadores_diarios enable row level security;
alter table public.configuracoes      enable row level security;

-- Qualquer usuário logado consulta e lança (Operadores também lançam o dia).
drop policy if exists "indicadores: ler"      on public.indicadores_diarios;
drop policy if exists "indicadores: inserir"  on public.indicadores_diarios;
drop policy if exists "indicadores: alterar"  on public.indicadores_diarios;
drop policy if exists "indicadores: excluir"  on public.indicadores_diarios;
create policy "indicadores: ler"     on public.indicadores_diarios for select to authenticated using (true);
create policy "indicadores: inserir" on public.indicadores_diarios for insert to authenticated with check (true);
create policy "indicadores: alterar" on public.indicadores_diarios for update to authenticated using (true) with check (true);
-- Excluir um dia inteiro: somente Administrador.
create policy "indicadores: excluir" on public.indicadores_diarios for delete to authenticated using (public.is_admin());

drop policy if exists "config: ler"     on public.configuracoes;
drop policy if exists "config: gravar"  on public.configuracoes;
drop policy if exists "config: alterar" on public.configuracoes;
create policy "config: ler"     on public.configuracoes for select to authenticated using (true);
-- Alterar configurações (prazo de coleta): somente Administrador.
create policy "config: gravar"  on public.configuracoes for insert to authenticated with check (public.is_admin());
create policy "config: alterar" on public.configuracoes for update to authenticated using (public.is_admin()) with check (public.is_admin());
