-- Acompanhamento da Gestão - estrutura configurável (fase 1, sem cálculos de vendas)

create extension if not exists pgcrypto;

create or replace function public.is_acompanhamento_manager()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select auth.uid()) is not null
    and (
      public.has_role((select auth.uid()), 'admin'::public.app_role)
      or public.has_role((select auth.uid()), 'gestor'::public.app_role)
    );
$$;

revoke all on function public.is_acompanhamento_manager() from public, anon;
grant execute on function public.is_acompanhamento_manager() to authenticated;

create table if not exists public.acompanhamento_configuracoes (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  valor jsonb not null default '{}'::jsonb,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.acompanhamento_grupos (
  id uuid primary key default gen_random_uuid(),
  contexto text not null,
  codigo text not null,
  nome text not null,
  operadora text null check (operadora is null or operadora in ('CLARO','VIVO')),
  ordem integer not null default 0,
  ativo boolean not null default true,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (contexto, codigo, operadora)
);

create table if not exists public.acompanhamento_tipo_vinculos (
  id uuid primary key default gen_random_uuid(),
  tipo_pedido_id uuid not null references public.tipos_pedido_catalogo(id) on delete cascade,
  grupo_id uuid not null references public.acompanhamento_grupos(id) on delete cascade,
  classificado_por uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tipo_pedido_id, grupo_id)
);

create table if not exists public.acompanhamento_metas_mensais (
  id uuid primary key default gen_random_uuid(),
  ano integer not null check (ano between 2020 and 2100),
  mes integer not null check (mes between 1 and 12),
  grupo text not null check (grupo in ('np_fixa','outros')),
  valor numeric(14,2) not null default 0 check (valor >= 0),
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ano, mes, grupo)
);

create table if not exists public.acompanhamento_metas_semanais (
  id uuid primary key default gen_random_uuid(),
  ano integer not null check (ano between 2020 and 2100),
  mes integer not null check (mes between 1 and 12),
  semana integer not null check (semana between 1 and 5),
  grupo text not null check (grupo in ('novo_importado','renovacao')),
  valor numeric(14,2) not null default 0 check (valor >= 0),
  origem text not null default 'automatico' check (origem in ('automatico','manual')),
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ano, mes, semana, grupo)
);

create table if not exists public.acompanhamento_metas_consultores (
  id uuid primary key default gen_random_uuid(),
  ano integer not null check (ano between 2020 and 2100),
  mes integer not null check (mes between 1 and 12),
  quadro text not null check (quadro in ('enviados','assinados')),
  consultor_id uuid not null references auth.users(id) on delete restrict,
  meta_semanal numeric(14,2) not null default 0 check (meta_semanal >= 0),
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ano, mes, quadro, consultor_id)
);

create table if not exists public.acompanhamento_quadros (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  titulo text not null,
  descricao text null,
  ordem integer not null default 0,
  ativo boolean not null default true,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.acompanhamento_quadro_regras (
  id uuid primary key default gen_random_uuid(),
  quadro_id uuid not null references public.acompanhamento_quadros(id) on delete cascade,
  operadora text null check (operadora is null or operadora in ('CLARO','VIVO')),
  fonte text not null check (fonte in ('status_manual','status_robo','pipeline_etapa')),
  referencia_id text null,
  valor_original text not null,
  valor_normalizado text not null,
  ativo boolean not null default true,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (quadro_id, operadora, fonte, referencia_id, valor_normalizado)
);

create index if not exists acompanhamento_tipo_vinculos_tipo_idx
  on public.acompanhamento_tipo_vinculos(tipo_pedido_id);
create index if not exists acompanhamento_tipo_vinculos_grupo_idx
  on public.acompanhamento_tipo_vinculos(grupo_id);
create index if not exists acompanhamento_metas_consultores_periodo_idx
  on public.acompanhamento_metas_consultores(ano, mes, quadro);
create index if not exists acompanhamento_quadro_regras_quadro_idx
  on public.acompanhamento_quadro_regras(quadro_id, operadora, ativo);

-- updated_at usa o helper já existente no projeto
drop trigger if exists acompanhamento_configuracoes_touch on public.acompanhamento_configuracoes;
create trigger acompanhamento_configuracoes_touch before update on public.acompanhamento_configuracoes
for each row execute function public.touch_updated_at();

drop trigger if exists acompanhamento_grupos_touch on public.acompanhamento_grupos;
create trigger acompanhamento_grupos_touch before update on public.acompanhamento_grupos
for each row execute function public.touch_updated_at();

drop trigger if exists acompanhamento_tipo_vinculos_touch on public.acompanhamento_tipo_vinculos;
create trigger acompanhamento_tipo_vinculos_touch before update on public.acompanhamento_tipo_vinculos
for each row execute function public.touch_updated_at();

drop trigger if exists acompanhamento_metas_mensais_touch on public.acompanhamento_metas_mensais;
create trigger acompanhamento_metas_mensais_touch before update on public.acompanhamento_metas_mensais
for each row execute function public.touch_updated_at();

drop trigger if exists acompanhamento_metas_semanais_touch on public.acompanhamento_metas_semanais;
create trigger acompanhamento_metas_semanais_touch before update on public.acompanhamento_metas_semanais
for each row execute function public.touch_updated_at();

drop trigger if exists acompanhamento_metas_consultores_touch on public.acompanhamento_metas_consultores;
create trigger acompanhamento_metas_consultores_touch before update on public.acompanhamento_metas_consultores
for each row execute function public.touch_updated_at();

drop trigger if exists acompanhamento_quadros_touch on public.acompanhamento_quadros;
create trigger acompanhamento_quadros_touch before update on public.acompanhamento_quadros
for each row execute function public.touch_updated_at();

drop trigger if exists acompanhamento_quadro_regras_touch on public.acompanhamento_quadro_regras;
create trigger acompanhamento_quadro_regras_touch before update on public.acompanhamento_quadro_regras
for each row execute function public.touch_updated_at();

-- RLS + grants
alter table public.acompanhamento_configuracoes enable row level security;
alter table public.acompanhamento_grupos enable row level security;
alter table public.acompanhamento_tipo_vinculos enable row level security;
alter table public.acompanhamento_metas_mensais enable row level security;
alter table public.acompanhamento_metas_semanais enable row level security;
alter table public.acompanhamento_metas_consultores enable row level security;
alter table public.acompanhamento_quadros enable row level security;
alter table public.acompanhamento_quadro_regras enable row level security;

revoke all on public.acompanhamento_configuracoes from anon, authenticated;
revoke all on public.acompanhamento_grupos from anon, authenticated;
revoke all on public.acompanhamento_tipo_vinculos from anon, authenticated;
revoke all on public.acompanhamento_metas_mensais from anon, authenticated;
revoke all on public.acompanhamento_metas_semanais from anon, authenticated;
revoke all on public.acompanhamento_metas_consultores from anon, authenticated;
revoke all on public.acompanhamento_quadros from anon, authenticated;
revoke all on public.acompanhamento_quadro_regras from anon, authenticated;

grant select, insert, update, delete on public.acompanhamento_configuracoes to authenticated;
grant select, insert, update, delete on public.acompanhamento_grupos to authenticated;
grant select, insert, update, delete on public.acompanhamento_tipo_vinculos to authenticated;
grant select, insert, update, delete on public.acompanhamento_metas_mensais to authenticated;
grant select, insert, update, delete on public.acompanhamento_metas_semanais to authenticated;
grant select, insert, update, delete on public.acompanhamento_metas_consultores to authenticated;
grant select, insert, update, delete on public.acompanhamento_quadros to authenticated;
grant select, insert, update, delete on public.acompanhamento_quadro_regras to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'acompanhamento_configuracoes',
    'acompanhamento_grupos',
    'acompanhamento_tipo_vinculos',
    'acompanhamento_metas_mensais',
    'acompanhamento_metas_semanais',
    'acompanhamento_metas_consultores',
    'acompanhamento_quadros',
    'acompanhamento_quadro_regras'
  ]
  loop
    execute format('drop policy if exists acompanhamento_select_manager on public.%I', t);
    execute format('drop policy if exists acompanhamento_insert_manager on public.%I', t);
    execute format('drop policy if exists acompanhamento_update_manager on public.%I', t);
    execute format('drop policy if exists acompanhamento_delete_manager on public.%I', t);

    execute format(
      'create policy acompanhamento_select_manager on public.%I for select to authenticated using ((select public.is_acompanhamento_manager()))',
      t
    );
    execute format(
      'create policy acompanhamento_insert_manager on public.%I for insert to authenticated with check ((select public.is_acompanhamento_manager()))',
      t
    );
    execute format(
      'create policy acompanhamento_update_manager on public.%I for update to authenticated using ((select public.is_acompanhamento_manager())) with check ((select public.is_acompanhamento_manager()))',
      t
    );
    execute format(
      'create policy acompanhamento_delete_manager on public.%I for delete to authenticated using ((select public.is_acompanhamento_manager()))',
      t
    );
  end loop;
end
$$;

-- Grupos estruturais. Sem classificação automática de tipos de pedido.
insert into public.acompanhamento_grupos (contexto, codigo, nome, operadora, ordem)
values
  ('processo_claro', 'portado', 'Portado', 'CLARO', 10),
  ('processo_claro', 'novo', 'Novo', 'CLARO', 20),
  ('processo_claro', 'fixa_banda_tv', 'Fixa / Banda Larga / TV', 'CLARO', 30),
  ('processo_claro', 'outros', 'Outros', 'CLARO', 40),
  ('processo_vivo', 'portado', 'Portado', 'VIVO', 10),
  ('processo_vivo', 'novo', 'Novo', 'VIVO', 20),
  ('processo_vivo', 'fixa_banda_tv_sip', 'Fixa / Banda Larga / TV / SIP', 'VIVO', 30),
  ('processo_vivo', 'outros', 'Outros', 'VIVO', 40),
  ('total_geral', 'portabilidade', 'Portabilidade', null, 10),
  ('total_geral', 'novo_fixa', 'Novo e Fixa', null, 20),
  ('total_geral', 'outros', 'Outros', null, 30),
  ('meta_semanal', 'novo_importado', 'Novo / Importado', null, 10),
  ('meta_semanal', 'renovacao', 'Renovação', null, 20),
  ('status_operacional', 'portabilidade', 'Portabilidade', null, 10),
  ('status_operacional', 'novo_fixa', 'Novo / Fixa', null, 20),
  ('status_operacional', 'outros', 'Outros', null, 30)
on conflict (contexto, codigo, operadora) do update
set nome = excluded.nome,
    ordem = excluded.ordem,
    ativo = true;

insert into public.acompanhamento_quadros (codigo, titulo, descricao, ordem)
values
  ('aguardando_aceite', 'Aguardando Aceite', 'Pedidos atualmente vinculados aos status configurados de aceite.', 10),
  ('troca_carteira_caso', 'Troca de Carteira / Caso', 'Pedidos em troca de carteira, abertura ou aguardando caso.', 20),
  ('confeccao_correcoes', 'Confecção / Correções', 'Pedidos em confecção, correção cadastral ou etapas equivalentes.', 30),
  ('tratativas_pendencias', 'Tratativas / Pendências', 'Pedidos em tratativa de suporte ou pendência de marketing.', 40),
  ('contratos_gerados_semana', 'Contratos Gerados Semana / Data de Recebimento', 'Marco semanal configurável de contratos gerados.', 50),
  ('contratos_assinados_semana', 'Contratos Assinados Semana / Data de Aceite', 'Marco semanal configurável de contratos assinados.', 60),
  ('meta_enviados_consultor', 'Enviados / Data de Recebimento', 'Acompanhamento semanal por consultor para enviados.', 70),
  ('meta_assinados_consultor', 'Assinados / Data de Aceite', 'Acompanhamento semanal por consultor para assinados.', 80)
on conflict (codigo) do update
set titulo = excluded.titulo,
    descricao = excluded.descricao,
    ordem = excluded.ordem,
    ativo = true;

-- Pré-configuração textual dos quatro quadros operacionais.
-- Cada status é cadastrado para fonte manual e robô, mantendo as configurações independentes.
with rules(quadro_codigo, operadora, valor_original) as (
  values
    ('aguardando_aceite', 'CLARO', 'Aguardando Aceite'),
    ('aguardando_aceite', 'VIVO', 'Aguardando Aceite'),

    ('troca_carteira_caso', 'CLARO', 'Troca de Carteira'),
    ('troca_carteira_caso', 'CLARO', 'Abrir Troca de Carteira'),
    ('troca_carteira_caso', 'VIVO', 'Aguardando Caso'),

    ('confeccao_correcoes', 'CLARO', 'Aguardando Correção Cadastral'),
    ('confeccao_correcoes', 'CLARO', 'Aguardando de Acordo'),
    ('confeccao_correcoes', 'CLARO', 'Confecção Aceite'),
    ('confeccao_correcoes', 'CLARO', 'Confecção Andamento'),
    ('confeccao_correcoes', 'CLARO', 'Devolvido Confecção'),
    ('confeccao_correcoes', 'CLARO', 'Aguardando Envio GC'),
    ('confeccao_correcoes', 'VIVO', 'Confecção Contrato'),

    ('tratativas_pendencias', 'CLARO', 'Tratativa Suporte'),
    ('tratativas_pendencias', 'CLARO', 'Pendente MKT')
),
expanded as (
  select quadro_codigo, operadora, fonte, valor_original
  from rules
  cross join (values ('status_manual'), ('status_robo')) as sources(fonte)
)
insert into public.acompanhamento_quadro_regras (
  quadro_id,
  operadora,
  fonte,
  referencia_id,
  valor_original,
  valor_normalizado
)
select
  q.id,
  e.operadora,
  e.fonte,
  null,
  e.valor_original,
  upper(
    regexp_replace(
      translate(trim(e.valor_original),
        'ÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇáàãâäéèêëíìîïóòõôöúùûüç',
        'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'
      ),
      '\s+',
      ' ',
      'g'
    )
  )
from expanded e
join public.acompanhamento_quadros q on q.codigo = e.quadro_codigo
on conflict (quadro_id, operadora, fonte, referencia_id, valor_normalizado) do update
set valor_original = excluded.valor_original,
    ativo = true;

comment on table public.acompanhamento_tipo_vinculos is
'Mapeamentos explícitos de tipos de pedido. Ausência de vínculo significa Não classificado.';
comment on table public.acompanhamento_quadro_regras is
'Regras independentes por quadro. Fase 1 configura fontes sem calcular vendas.';
