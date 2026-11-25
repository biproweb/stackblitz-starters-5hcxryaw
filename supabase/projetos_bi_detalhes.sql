-- =====================================================================
-- Portal de Projetos BI — campos de detalhe dos projetos
-- Rodar uma única vez no Supabase: SQL Editor → New query → Run
-- =====================================================================

-- Situação atual (texto livre visível para todos) e data da solicitação
alter table public.projetos_bi
  add column if not exists observacoes   text default '',
  add column if not exists solicitado_em date;

-- Preenche "Solicitado em" dos projetos que vieram de solicitações já aceitas
update public.projetos_bi p
   set solicitado_em = (s.criado_em at time zone 'America/Manaus')::date
  from public.solicitacoes_bi s
 where s.situacao = 'aceita'
   and s.titulo = p.nome
   and p.solicitado_em is null;

-- Conferência: quantos projetos ficaram com a data preenchida
select count(*) filter (where solicitado_em is not null) as com_data_solicitacao,
       count(*) as total_projetos
  from public.projetos_bi;
