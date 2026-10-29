-- =====================================================================
--  MunilaLog — Horário correto em TODAS as tabelas (created_at, updated_at…)
--  Execute UMA vez no Supabase: SQL Editor › New query › Run
--  (pode rodar de novo: o que já estiver certo não muda).
--
--  Mesmo problema corrigido na Auditoria: colunas de data/hora preenchidas
--  automaticamente com deslocamento de fuso (ex.: +3h). Para cada coluna de
--  carimbo com valor padrão baseado em now()/CURRENT_TIMESTAMP, o script:
--    1) mede o deslocamento (pelo valor padrão e pelos registros "no futuro");
--    2) corrige os registros pelo mesmo deslocamento;
--    3) deixa a coluna como "timestamp with time zone" com padrão now().
--  Colunas de DATA (sem hora), como data_faturamento, não são tocadas.
--  O resultado aparece na aba Messages/Notices e na tabela do final.
-- =====================================================================

create table if not exists public._ajustes_horario (
  tabela text, coluna text, tipo_antes text, padrao_antes text, horas_corrigidas integer, registros bigint, em timestamptz default now()
);
alter table public._ajustes_horario enable row level security;  -- ninguém lê pela API

do $$
declare
  c        record;
  v_wall   timestamp;
  v_tz     timestamptz;
  v_dif    interval;
  v_horas  integer;
  v_n      bigint;
begin
  for c in
    select table_name as t, column_name as col, data_type as tipo, column_default as def
    from information_schema.columns
    where table_schema = 'public'
      and data_type in ('timestamp without time zone', 'timestamp with time zone')
      and column_default is not null
      and (column_default ilike '%now()%' or column_default ilike '%current_timestamp%')
      and table_name not in ('logs_auditoria', '_ajustes_horario')  -- a auditoria tem script próprio
    order by table_name, column_name
  loop
   begin
    v_dif := interval '0';
    if c.tipo = 'timestamp without time zone' then
      execute format('select (%s)::timestamp', c.def) into v_wall;
      v_dif := v_wall - (now() at time zone 'UTC');
    else
      execute format('select (%s)::timestamptz', c.def) into v_tz;
      v_dif := v_tz - now();
    end if;
    v_horas := round(extract(epoch from v_dif) / 3600.0);

    -- fuso configurado só na conexão do aplicativo: mede pelos registros gravados "no futuro"
    if v_horas = 0 then
      if c.tipo = 'timestamp without time zone' then
        execute format('select max(%I) - (now() at time zone ''UTC'') from public.%I', c.col, c.t) into v_dif;
      else
        execute format('select max(%I) - now() from public.%I', c.col, c.t) into v_dif;
      end if;
      if v_dif is not null and v_dif > interval '10 minutes' then
        v_horas := round(extract(epoch from v_dif) / 3600.0);
      else
        v_horas := 0;
      end if;
    end if;

    execute format('select count(*) from public.%I', c.t) into v_n;

    if c.tipo = 'timestamp without time zone' then
      execute format('alter table public.%I alter column %I type timestamptz using ((%I - interval %L) at time zone ''UTC'')',
                     c.t, c.col, c.col, v_horas || ' hours');
    elsif v_horas <> 0 then
      execute format('update public.%I set %I = %I - interval %L', c.t, c.col, c.col, v_horas || ' hours');
    end if;
    execute format('alter table public.%I alter column %I set default now()', c.t, c.col);

    insert into public._ajustes_horario (tabela, coluna, tipo_antes, padrao_antes, horas_corrigidas, registros)
    values (c.t, c.col, c.tipo, c.def, -v_horas, v_n);
    raise notice '%.%: tipo %, padrão % → % h corrigida(s) em % registro(s)', c.t, c.col, c.tipo, c.def, -v_horas, v_n;
   exception when others then
    -- uma coluna com problema (ex.: usada por uma view) não impede as demais
    raise notice '%.%: NÃO ajustada — %', c.t, c.col, sqlerrm;
   end;
  end loop;
end $$;

-- Resultado desta execução (horas_corrigidas = 0 significa que já estava certo)
select tabela, coluna, tipo_antes, padrao_antes, horas_corrigidas, registros
from public._ajustes_horario
where em > now() - interval '5 minutes'
order by tabela, coluna;
