-- =====================================================================
--  MunilaLog — Faturas de frete (conferência, contestação e pagamento)
--  Execute UMA vez no Supabase: SQL Editor › New query › Run
--  (pode rodar de novo sem problema). Requer o seguranca_e_novidades.sql
--  (função is_admin) já executado.
-- =====================================================================

create table if not exists public.faturas_frete (
  id                uuid primary key default gen_random_uuid(),
  numero            text not null,                 -- nº da fatura / boleto da transportadora
  transportadora_id text not null,                 -- id da transportadora (texto: funciona com uuid ou número)
  emissao           date,
  vencimento        date not null,
  valor             numeric(12,2) not null check (valor >= 0),
  ctes              text[] not null default '{}',  -- números dos CTEs cobrados (como vieram na fatura)
  status            text not null default 'recebida'
                    check (status in ('recebida','conferida','contestada','aprovada','paga','cancelada')),
  valor_contestado  numeric(12,2) not null default 0,
  motivo_contestacao text,
  valor_aprovado    numeric(12,2),                 -- valor liberado para pagamento
  pago_em           date,
  observacao        text,
  arquivo_path      text,                          -- PDF da fatura no Storage (bucket "faturas")
  eventos           jsonb not null default '[]'::jsonb,  -- linha do tempo: [{em, por, acao, detalhe}]
  criado_por        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint faturas_frete_unica unique (transportadora_id, numero)
);
create index if not exists faturas_frete_venc_idx on public.faturas_frete (vencimento);

create or replace function public.faturas_frete_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists faturas_frete_touch on public.faturas_frete;
create trigger faturas_frete_touch before update on public.faturas_frete for each row execute function public.faturas_frete_touch();

alter table public.faturas_frete enable row level security;
drop policy if exists "faturas: ler" on public.faturas_frete;
drop policy if exists "faturas: gravar (admin)" on public.faturas_frete;
create policy "faturas: ler" on public.faturas_frete for select to authenticated using (true);
create policy "faturas: gravar (admin)" on public.faturas_frete for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- PDF das faturas (Supabase Storage, privado: só usuários logados veem; só administrador envia)
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('faturas', 'faturas', false) on conflict (id) do nothing;
  end if;
end $$;

do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "faturas: ver pdf (logado)" on storage.objects';
    execute 'drop policy if exists "faturas: enviar pdf (admin)" on storage.objects';
    execute 'drop policy if exists "faturas: apagar pdf (admin)" on storage.objects';
    execute $p$create policy "faturas: ver pdf (logado)" on storage.objects for select to authenticated using (bucket_id = 'faturas')$p$;
    execute $p$create policy "faturas: enviar pdf (admin)" on storage.objects for insert to authenticated with check (bucket_id = 'faturas' and public.is_admin())$p$;
    execute $p$create policy "faturas: apagar pdf (admin)" on storage.objects for delete to authenticated using (bucket_id = 'faturas' and public.is_admin())$p$;
  end if;
end $$;

-- Tempo real (a lista se atualiza quando outra pessoa aprova/paga)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'faturas_frete') then
    alter publication supabase_realtime add table public.faturas_frete;
  end if;
exception when undefined_object then null;
end $$;
