-- =====================================================================
--  MunilaLog — Auditoria: corrige o horário dos registros e liga o tempo real
--  Execute UMA vez no Supabase: SQL Editor › New query › Run
--  (pode rodar de novo: se já estiver certo, não muda nada).
--
--  O problema: a coluna logs_auditoria.criado_em foi criada com um valor
--  padrão que grava a hora com deslocamento (ex.: +3h em relação ao horário
--  de Fortaleza). Este script:
--    1) mede o deslocamento comparando o valor padrão atual com o relógio real;
--    2) corrige TODOS os registros antigos pelo mesmo deslocamento;
--    3) transforma a coluna em "timestamp with time zone" com padrão now()
--       (hora absoluta, sem ambiguidade de fuso);
--    4) liga o tempo real da auditoria (novos registros aparecem na tela na hora).
--  O resultado do diagnóstico aparece na aba "Messages"/"Notices".
-- =====================================================================

do $$
declare
  v_tipo   text;
  v_def    text;
  v_wall   timestamp;
  v_tz     timestamptz;
  v_dif    interval := interval '0';
  v_horas  integer;
begin
  select data_type, column_default into v_tipo, v_def
  from information_schema.columns
  where table_schema = 'public' and table_name = 'logs_auditoria' and column_name = 'criado_em';

  if v_tipo is null then
    raise notice 'Tabela logs_auditoria/coluna criado_em não encontrada — nada a fazer.';
    return;
  end if;

  if v_def is not null then
    if v_tipo = 'timestamp without time zone' then
      -- o sistema lê esse valor como UTC; o certo é ele ser igual ao relógio em UTC
      execute format('select (%s)::timestamp', v_def) into v_wall;
      v_dif := v_wall - (now() at time zone 'UTC');
    else
      execute format('select (%s)::timestamptz', v_def) into v_tz;
      v_dif := v_tz - now();
    end if;
  end if;

  -- arredonda para horas inteiras (diferenças de segundos são só o tempo de execução)
  v_horas := round(extract(epoch from v_dif) / 3600.0);
  raise notice 'criado_em: tipo = %, padrão = %, deslocamento medido = % h', v_tipo, coalesce(v_def, '(nenhum)'), v_horas;

  if v_tipo = 'timestamp without time zone' then
    -- converte para timestamptz tratando o valor gravado como UTC e tirando o deslocamento
    execute format(
      'alter table public.logs_auditoria alter column criado_em type timestamptz using ((criado_em - interval %L) at time zone ''UTC'')',
      v_horas || ' hours');
    raise notice 'Coluna convertida para timestamptz e % registro(s) ajustado(s) em % h.', (select count(*) from public.logs_auditoria), -v_horas;
  elsif v_horas <> 0 then
    execute format('update public.logs_auditoria set criado_em = criado_em - interval %L', v_horas || ' hours');
    raise notice '% registro(s) ajustado(s) em % h.', (select count(*) from public.logs_auditoria), -v_horas;
  else
    raise notice 'Horário já estava correto no banco.';
  end if;

  alter table public.logs_auditoria alter column criado_em set default now();
  alter table public.logs_auditoria alter column criado_em set not null;
end $$;

create index if not exists logs_auditoria_criado_idx on public.logs_auditoria (criado_em desc);

-- Tempo real: novos registros aparecem na Auditoria sem atualizar a página
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'logs_auditoria') then
    alter publication supabase_realtime add table public.logs_auditoria;
  end if;
exception when undefined_object then null;
end $$;

-- Conferência: a última ação deve mostrar o horário certo de Fortaleza
select usuario_email, acao, detalhes,
       to_char(criado_em at time zone 'America/Fortaleza', 'DD/MM/YYYY HH24:MI:SS') as horario_fortaleza
from public.logs_auditoria
order by criado_em desc
limit 5;
