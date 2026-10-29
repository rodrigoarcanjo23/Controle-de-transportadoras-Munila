-- =====================================================================
--  MunilaLog — Rastreio para o cliente e avisos automáticos por e-mail
--  Execute UMA vez no Supabase: SQL Editor › New query › Run
--  (pode rodar de novo sem problema). Requer o seguranca_e_novidades.sql.
-- =====================================================================

-- 1) Link de rastreio: cada NF ganha um código secreto (o link não revela outras NFs)
alter table public.entregas add column if not exists rastreio_token uuid default gen_random_uuid();
update public.entregas set rastreio_token = gen_random_uuid() where rastreio_token is null;
create unique index if not exists entregas_rastreio_token_idx on public.entregas (rastreio_token);

-- 2) Cliente pode optar por não receber avisos
alter table public.clientes add column if not exists recebe_avisos boolean not null default true;

-- 3) Fila de avisos (preenchida automaticamente quando a NF é coletada ou entregue)
create table if not exists public.avisos_clientes (
  id             bigserial primary key,
  entrega_id     text not null,
  tipo           text not null check (tipo in ('coletado', 'entregue')),
  criado_em      timestamptz not null default now(),
  processando_em timestamptz,
  enviado_em     timestamptz,
  destinatario   text,
  erro           text,
  tentativas     integer not null default 0,
  constraint avisos_clientes_unico unique (entrega_id, tipo)
);
alter table public.avisos_clientes enable row level security;
drop policy if exists "avisos: ler" on public.avisos_clientes;
create policy "avisos: ler" on public.avisos_clientes for select to authenticated using (true);

-- Configuração (desligada até o administrador ligar em Alertas › Configurar)
insert into public.configuracoes (chave, valor)
values ('avisos_clientes', '{"ativo": false, "coletado": true, "entregue": true, "copia": ""}'::jsonb)
on conflict (chave) do nothing;

-- 4) Gatilho: status mudou para "Em Transporte" ou "Entregue" → entra na fila
create or replace function public.enfileirar_aviso_cliente() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cfg jsonb; v_tipo text;
begin
  if new.status is not distinct from old.status then return new; end if;
  select valor into v_cfg from configuracoes where chave = 'avisos_clientes';
  if v_cfg is null or coalesce((v_cfg ->> 'ativo')::boolean, false) = false then return new; end if;

  if new.status = 'Entregue' and coalesce((v_cfg ->> 'entregue')::boolean, true) then
    -- baixa retroativa (entrega antiga marcada agora) não gera aviso
    if new.data_entrega_agendamento is not null and new.data_entrega_agendamento < current_date - 3 then return new; end if;
    v_tipo := 'entregue';
  elsif new.status = 'Em Transporte' and coalesce((v_cfg ->> 'coletado')::boolean, true) then
    v_tipo := 'coletado';
  else
    return new;
  end if;
  if new.data_faturamento is not null and new.data_faturamento < current_date - 45 then return new; end if;

  insert into avisos_clientes (entrega_id, tipo) values (new.id::text, v_tipo) on conflict do nothing;
  return new;
end $$;

drop trigger if exists entregas_aviso_cliente on public.entregas;
create trigger entregas_aviso_cliente after update of status on public.entregas
  for each row execute function public.enfileirar_aviso_cliente();

-- 5) Reserva atômica dos avisos a enviar (evita e-mail em dobro quando duas telas pedem o envio ao mesmo tempo)
create or replace function public.avisos_reservar(p_limite integer default 30) returns setof public.avisos_clientes
language sql volatile security definer set search_path = public as $$
  update avisos_clientes set processando_em = now(), tentativas = tentativas + 1
  where id in (
    select id from avisos_clientes
    where enviado_em is null and tentativas < 3
      and (processando_em is null or processando_em < now() - interval '10 minutes')
    order by id limit p_limite
    for update skip locked)
  returning *;
$$;
revoke all on function public.avisos_reservar(integer) from public, anon, authenticated;  -- só a função da Vercel (service role)
do $$ begin
  execute 'grant execute on function public.avisos_reservar(integer) to service_role';
exception when undefined_object then null;
end $$;
