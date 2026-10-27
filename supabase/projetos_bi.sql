-- =====================================================================
-- Portal de Projetos BI — tabelas, permissões (RLS) e carga inicial
-- Rodar uma única vez no Supabase: SQL Editor → New query → Run
-- =====================================================================

-- 1) Quem pode editar projetos (administradores do portal)
create table if not exists public.portal_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);

-- 2) Projetos (etapas ficam em JSON dentro do próprio projeto)
create table if not exists public.projetos_bi (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  setor         text default '',
  solicitante   text default '',
  status        text not null default 'fila'
                check (status in ('andamento','fila','pausado','concluido')),
  prioridade    text not null default 'media'
                check (prioridade in ('alta','media','baixa')),
  inicio        date,
  previsao      date,
  conclusao     date,
  descricao     text default '',
  ordem         integer,
  etapas        jsonb not null default '[]'::jsonb,
  atualizado_em timestamptz not null default now()
);

-- 3) Solicitações enviadas pelos setores
create table if not exists public.solicitacoes_bi (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  setor       text not null,
  solicitante text not null,
  prazo       date,
  prioridade  text not null default 'media'
              check (prioridade in ('alta','media','baixa')),
  descricao   text default '',
  situacao    text not null default 'nova'
              check (situacao in ('nova','aceita','arquivada')),
  criado_por  uuid default auth.uid() references auth.users(id) on delete set null,
  criado_em   timestamptz not null default now()
);

-- Função auxiliar: o usuário logado é administrador?
create or replace function public.is_portal_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.portal_admins where user_id = auth.uid());
$$;

-- 4) Permissões
alter table public.portal_admins   enable row level security;
alter table public.projetos_bi     enable row level security;
alter table public.solicitacoes_bi enable row level security;

drop policy if exists "admin ve o proprio registro" on public.portal_admins;
create policy "admin ve o proprio registro" on public.portal_admins
  for select to authenticated using (user_id = auth.uid());

-- Projetos: todos os usuários logados leem; só administradores alteram
drop policy if exists "projetos leitura" on public.projetos_bi;
create policy "projetos leitura" on public.projetos_bi
  for select to authenticated using (true);
drop policy if exists "projetos edicao admin" on public.projetos_bi;
create policy "projetos edicao admin" on public.projetos_bi
  for all to authenticated using (public.is_portal_admin()) with check (public.is_portal_admin());

-- Solicitações: todos os usuários logados leem e enviam; só administradores alteram/excluem
drop policy if exists "solicitacoes leitura" on public.solicitacoes_bi;
create policy "solicitacoes leitura" on public.solicitacoes_bi
  for select to authenticated using (true);
drop policy if exists "solicitacoes envio" on public.solicitacoes_bi;
create policy "solicitacoes envio" on public.solicitacoes_bi
  for insert to authenticated with check (criado_por = auth.uid() and situacao = 'nova');
drop policy if exists "solicitacoes gestao admin" on public.solicitacoes_bi;
create policy "solicitacoes gestao admin" on public.solicitacoes_bi
  for update to authenticated using (public.is_portal_admin()) with check (public.is_portal_admin());
drop policy if exists "solicitacoes exclusao admin" on public.solicitacoes_bi;
create policy "solicitacoes exclusao admin" on public.solicitacoes_bi
  for delete to authenticated using (public.is_portal_admin());

-- 5) Administrador: troque pelo e-mail que você usa para entrar no portal
insert into public.portal_admins (user_id)
select id from auth.users where email = 'SEU_EMAIL_DO_PORTAL@exemplo.com'
on conflict do nothing;

-- 6) Carga inicial: projeto em andamento
insert into public.projetos_bi (nome, setor, status, prioridade, inicio, descricao, etapas)
select
  'BD_Comercial_Pecas', 'Peças · Comercial', 'andamento', 'alta', date '2026-10-19',
  'Novo dashboard de gestão comercial de peças (substitui o painel antigo de vendas de peças): base centralizada BD_Comercial_Pecas e relatório gerencial.',
  '[
    {"nome":"Visão Geral","status":"feito","inicio":"2026-10-19","fim":"2026-10-26"},
    {"nome":"Metas","status":"feito","inicio":"2026-10-19","fim":"2026-10-26"},
    {"nome":"Filiais","status":"andamento","inicio":"2026-10-27","fim":""},
    {"nome":"Vendedores","status":"andamento","inicio":"2026-10-27","fim":""},
    {"nome":"Vendas perdidas","status":"pendente","inicio":"","fim":""},
    {"nome":"Potencial por cliente / parque de máquinas","status":"pendente","inicio":"","fim":""},
    {"nome":"Premiações e comissões","status":"pendente","inicio":"","fim":""}
  ]'::jsonb
where not exists (select 1 from public.projetos_bi where nome = 'BD_Comercial_Pecas');
