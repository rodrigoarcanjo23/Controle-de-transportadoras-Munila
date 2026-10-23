-- =====================================================================
--  MunilaLog — REVERTER a segurança (somente se algo parar de funcionar)
--  Volta as tabelas principais ao acesso livre para usuários logados.
--  Depois de corrigir o problema, rode de novo seguranca_e_novidades.sql.
-- =====================================================================
do $$
declare t text; p record;
begin
  foreach t in array array['entregas','ctes','devolucoes','clientes','transportadoras','metas_frete','produtos','perfis','logs_auditoria'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
    execute format('create policy "acesso total (logado)" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- As políticas que existiam antes estão guardadas em public._backup_policies:
-- select * from public._backup_policies;
