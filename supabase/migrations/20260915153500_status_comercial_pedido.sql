-- Status Comercial do pedido: catálogo pesquisável + histórico imutável.
-- O status ativo é sempre a movimentação mais recente do histórico.

create table if not exists public.status_comercial_catalogo (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists status_comercial_catalogo_nome_unique_ci
  on public.status_comercial_catalogo (lower(nome));

create table if not exists public.venda_status_comercial_historico (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.vendas(id) on delete cascade,
  status_id uuid references public.status_comercial_catalogo(id) on delete set null,
  status_nome_snapshot text not null,
  user_id uuid references auth.users(id) on delete set null,
  user_nome text not null,
  user_role text,
  created_at timestamptz not null default now()
);

create index if not exists venda_status_comercial_historico_venda_created_idx
  on public.venda_status_comercial_historico (venda_id, created_at desc);

create index if not exists venda_status_comercial_historico_status_idx
  on public.venda_status_comercial_historico (status_id);

alter table public.status_comercial_catalogo enable row level security;
alter table public.venda_status_comercial_historico enable row level security;

revoke all on table public.status_comercial_catalogo from anon, authenticated;
revoke all on table public.venda_status_comercial_historico from anon, authenticated;

grant select on table public.status_comercial_catalogo to authenticated;
grant select, insert on table public.venda_status_comercial_historico to authenticated;

drop policy if exists authenticated_read on public.status_comercial_catalogo;
create policy authenticated_read
  on public.status_comercial_catalogo
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists authenticated_read on public.venda_status_comercial_historico;
create policy authenticated_read
  on public.venda_status_comercial_historico
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.vendas v
      where v.id = venda_status_comercial_historico.venda_id
    )
  );

drop policy if exists admin_bko_insert on public.venda_status_comercial_historico;
create policy admin_bko_insert
  on public.venda_status_comercial_historico
  for insert
  to authenticated
  with check (
    (
      has_role((select auth.uid()), 'admin'::app_role)
      or has_role((select auth.uid()), 'bko'::app_role)
    )
    and exists (
      select 1
      from public.vendas v
      where v.id = venda_status_comercial_historico.venda_id
    )
  );

-- Garante no banco que o snapshot corresponde ao catálogo e que o ator não pode ser falsificado.
create or replace function public.prepare_status_comercial_historico()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  catalog_nome text;
begin
  select nome
    into catalog_nome
  from public.status_comercial_catalogo
  where id = new.status_id
    and ativo = true;

  if catalog_nome is null then
    raise exception 'Status Comercial inválido ou inativo';
  end if;

  new.status_nome_snapshot := catalog_nome;
  new.user_id := auth.uid();
  new.created_at := now();

  if has_role(auth.uid(), 'admin'::app_role) then
    new.user_role := 'admin';
  elsif has_role(auth.uid(), 'bko'::app_role) then
    new.user_role := 'bko';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prepare_status_comercial_historico
  on public.venda_status_comercial_historico;
create trigger trg_prepare_status_comercial_historico
before insert on public.venda_status_comercial_historico
for each row
execute function public.prepare_status_comercial_historico();

insert into public.status_comercial_catalogo (nome, ordem)
values
  ('AGUARDANDO CORREÇÃO CADASTRAL', 10),
  ('AGUARDANDO INTERAÇÃO', 20),
  ('ARQUIVADO', 30),
  ('AUDITORIA', 40),
  ('AVA - AGUARDANDO ACEITE', 50),
  ('AVA - CANCELADO', 60),
  ('AVA - EM VALIDAÇÃO', 70),
  ('AVA - INSTALADO', 80),
  ('AVA - PENDÊNCIA', 90),
  ('AVA - TÉCNICA', 100),
  ('AVA - TRAMITANDO CLARO', 110),
  ('COM - INICIO NEGOCIAÇÃO (25%)', 120),
  ('COM - PROPOSTA ENVIADA (50%)', 130),
  ('COM - SDR TRATANDO', 140),
  ('COM - SDR VALIDADO', 150),
  ('COM - SEM CONTATO', 160),
  ('COM - VALIDAÇÃO', 170),
  ('CONFECÇÃO ANDAMENTO', 180),
  ('CONVERGENCIA', 190),
  ('ENVIADO PARCEIRO ACCE', 200),
  ('FB - AGUARDANDO ACEITE', 210),
  ('FB - CADASTRO NETSALES', 220),
  ('FB - CANCELADO', 230),
  ('FB - CONECTADO', 240),
  ('FB - ENDEREÇO BLOQUEADO', 250),
  ('FB - FILA INPUT', 260),
  ('FB - LIBERACAO DE GED', 270),
  ('FB - PENDÊNCIA COMERCIAL', 280),
  ('FB - PENDÊNCIA SISTÊMICA', 290),
  ('FB - PENDÊNCIA TÉCNICA', 300),
  ('FB - PENDENTE BAIXA', 310),
  ('FB - PENDENTE INSTALAÇÃO', 320),
  ('FB - QUALIFICAÇÃO', 330),
  ('FB - QUEBRA', 340),
  ('FB - REAGENDAMENTO', 350),
  ('FB - RECADASTRO', 360),
  ('FB - REPROVADO ATUAR', 370),
  ('FB - REQUALIFICAÇÃO', 380),
  ('FB - RETORNO DE INSTALAÇÃO', 390),
  ('FB - SOBRE PENDENTE', 400),
  ('FB - LIMPEZA DE AGENDA', 410),
  ('INTERAÇÃO COM CLIENTE', 420),
  ('MV - ABRIR TROCA DE CARTEIRA', 430),
  ('MV - AGUARDANDO ACEITE', 440),
  ('MV - AGUARDANDO BAIXA NF', 450),
  ('MV - AGUARDANDO DE ACORDO', 460),
  ('MV - AGUARDANDO ENTREGA', 470),
  ('MV - AGUARDANDO ENVIO GC', 480),
  ('MV - AGUARDANDO NOTA FISCAL', 490),
  ('MV - AGUARDANDO PORTABILIDADE', 500),
  ('MV - ANÁLISE DE CRÉDITO (CPC)', 510),
  ('MV - ANÁLISE DE CRÉDITO SOLAR', 520),
  ('MV - ATIVADO 100%', 530),
  ('MV - AUDITORIA', 540),
  ('MV - CANCELADO', 550),
  ('MV - CONCLUÍDO INSPEÇÃO (CPO)', 560),
  ('MV - CONFECÇÃO ACEITE', 570),
  ('MV - CONFLITOS PORTABILIDADE', 580),
  ('MV - DESCONTO POR VOLUME EM ANALISE', 590),
  ('MV - DEVOLVIDO BKO', 600),
  ('MV - DEVOLVIDO CONFECÇÃO', 610),
  ('MV - ENVIAR AO PARCEIRO', 620),
  ('MV - FALTA EQUIPAMENTO', 630),
  ('MV - FILA INPUT', 640),
  ('MV - INPUT EM ANDAMENTO', 650),
  ('MV - INSUCESSO DE ENTREGA', 660),
  ('MV - PENDÊNCIA COMERCIAL', 670),
  ('MV - PENDENTE AUDITORIA', 680),
  ('MV - PENDENTE CONSULTOR', 690),
  ('MV - PENDENTE MKT', 700),
  ('MV - PORTABILIDADE NEGADA', 710),
  ('MV - PRD - SUPORTE', 720),
  ('MV - PRD CORREÇÃO', 730),
  ('MV - PRD ERRO SOLAR', 740),
  ('MV - QUALIFICAÇÃO', 750),
  ('MV - RENOVAÇÃO ANTECIPADA EM ANALISE', 760),
  ('MV - REPROVADO - ATUAR', 770),
  ('MV - REPROVADO - PERDIDO', 780),
  ('MV - REQUALIFICAÇÃO', 790),
  ('MV - SOLICITAR DESCONTO POR VOLUME', 800),
  ('MV - SOLICITAR RENOVAÇÃO ANTECIPADA', 810),
  ('MV - TROCA DE CARTEIRA EM ANÁLISE', 820),
  ('MV - TROCA NEGADA', 830),
  ('MV - VALIDAÇÃO PENDENTE (CPC)', 840),
  ('MV - VALIDAR ATIVAÇÃO', 850),
  ('MV - AGUARDANDO BIOMETRIA', 860),
  ('PENDÊNCIA PARCEIROS', 870),
  ('RETORNO FUTURO', 880),
  ('VENDA PERDIDA', 890)
on conflict do nothing;
