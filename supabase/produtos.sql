-- =====================================================================
--  MunilaLog — Cadastro completo de produtos (para o Simulador de frete)
--  Execute UMA vez no Supabase: SQL Editor › New query › Run
--  (pode rodar de novo sem problema).
--  Acrescenta: EAN, medidas da caixa em campos separados (cm), peso da
--  unidade, preço unitário (valor da mercadoria), ativo/inativo.
--  As permissões continuam as do seguranca_e_novidades.sql (todos consultam,
--  só Administrador cria/edita/exclui).
-- =====================================================================
alter table public.produtos add column if not exists ean text;
alter table public.produtos add column if not exists comprimento_cm numeric(10,2);
alter table public.produtos add column if not exists largura_cm numeric(10,2);
alter table public.produtos add column if not exists altura_cm numeric(10,2);
alter table public.produtos add column if not exists peso_unitario_kg numeric(12,4);
alter table public.produtos add column if not exists preco_unitario numeric(12,2);
alter table public.produtos add column if not exists ativo boolean not null default true;
alter table public.produtos add column if not exists observacao text;

-- aproveita as medidas que já estavam no texto (ex.: "40x30x22") para os novos campos
update public.produtos p
set comprimento_cm = replace(m[1], ',', '.')::numeric,
    largura_cm     = replace(m[2], ',', '.')::numeric,
    altura_cm      = replace(m[3], ',', '.')::numeric
from (
  select id, regexp_match(medidas_cm, '(\d+(?:[.,]\d+)?)\D+(\d+(?:[.,]\d+)?)\D+(\d+(?:[.,]\d+)?)') as m
  from public.produtos where medidas_cm is not null
) x
where x.id = p.id and x.m is not null and p.comprimento_cm is null;

-- código único (quando informado), para a importação por planilha não duplicar
create unique index if not exists produtos_codigo_unico on public.produtos (lower(codigo)) where codigo is not null and codigo <> '';
