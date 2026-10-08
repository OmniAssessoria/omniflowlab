-- Registra alterações executadas por robôs/automações nas vendas.

create table if not exists public.venda_robo_logs (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.vendas(id) on delete cascade,
  created_at timestamptz not null default now(),
  robo_nome text not null default 'Robô OMNI',
  origem text not null default 'automacao',
  acao text not null default 'alteracao_automatica',
  campo text,
  campo_label text,
  valor_anterior text,
  valor_novo text,
  descricao text not null,
  detalhes jsonb not null default '{}'::jsonb
);

create index if not exists venda_robo_logs_venda_created_idx
  on public.venda_robo_logs(venda_id, created_at desc);

alter table public.venda_robo_logs enable row level security;

drop policy if exists "venda_robo_logs_select_authenticated" on public.venda_robo_logs;
create policy "venda_robo_logs_select_authenticated"
on public.venda_robo_logs
for select
to authenticated
using (true);

create or replace function public.venda_robo_campo_label(p_campo text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_campo
    when 'data_recebimento' then 'Recebimento'
    when 'data_preenchimento' then 'Preenchimento'
    when 'data_envio' then 'Envio'
    when 'data_aceite' then 'Aceite'
    when 'data_input' then 'Input'
    when 'data_ativacao' then 'Ativação'
    when 'data_portabilidade' then 'Portabilidade'
    when 'data_entrega' then 'Entrega/Instalação'
    when 'status_pedido' then 'Status do pedido'
    when 'status_portabilidade' then 'Status de portabilidade'
    when 'status_biometria' then 'Status de biometria'
    when 'status_comercial_id' then 'Status comercial'
    when 'status_comercial_nome' then 'Status comercial'
    when 'status_comercial_em' then 'Data do status comercial'
    when 'sla_due_at' then 'Limite do SLA'
    when 'sla_alerta_at' then 'Alerta do SLA'
    when 'sla_status_calc' then 'Status calculado do SLA'
    when 'sla_horas_atual' then 'SLA atual'
    when 'sla_metade_em' then 'Metade do SLA'
    when 'sla_limite_em' then 'Limite operacional do SLA'
    when 'funil' then 'Funil'
    when 'etapa_id' then 'Etapa'
    when 'status_leitura_robo' then 'Status da leitura do robô'
    when 'statusleiturarobo' then 'Status da leitura do robô'
    when 'cod_rastreio' then 'Código de rastreio'
    when 'nota_fiscal' then 'Nota fiscal'
    else initcap(replace(p_campo, '_', ' '))
  end;
$$;

create or replace function public.log_venda_robo_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_field text;
  v_old text;
  v_new text;
  v_label text;
  v_robot_status text;
  v_fields text[] := array[
    'data_recebimento','data_preenchimento','data_envio','data_aceite',
    'data_input','data_ativacao','data_portabilidade','data_entrega',
    'status_pedido','status_portabilidade','status_biometria',
    'status_comercial_id','status_comercial_nome','status_comercial_em',
    'sla_due_at','sla_alerta_at','sla_status_calc','sla_horas_atual',
    'sla_metade_em','sla_limite_em','funil','etapa_id',
    'status_leitura_robo','statusleiturarobo','cod_rastreio','nota_fiscal'
  ];
begin
  if auth.uid() is not null then
    return new;
  end if;

  v_robot_status := coalesce(
    nullif(new.status_leitura_robo, ''),
    nullif(new.statusleiturarobo, ''),
    'Automação do sistema'
  );

  foreach v_field in array v_fields loop
    v_old := to_jsonb(old) ->> v_field;
    v_new := to_jsonb(new) ->> v_field;

    if v_old is distinct from v_new then
      v_label := public.venda_robo_campo_label(v_field);

      insert into public.venda_robo_logs (
        venda_id, robo_nome, origem, acao, campo, campo_label,
        valor_anterior, valor_novo, descricao, detalhes
      ) values (
        new.id, 'Robô OMNI', 'automacao_sistema', 'alteracao_automatica',
        v_field, v_label, v_old, v_new,
        case
          when v_old is null and v_new is not null
            then 'O robô preencheu ' || v_label || ' com ' || v_new || '.'
          when v_new is null
            then 'O robô removeu o valor de ' || v_label || '.'
          else 'O robô alterou ' || v_label || ' de ' || v_old || ' para ' || v_new || '.'
        end,
        jsonb_build_object(
          'numero_pedido', new.numero,
          'operadora', new.operadora,
          'status_robo', v_robot_status,
          'updated_at', new.updated_at
        )
      );
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_venda_robo_logs on public.vendas;
create trigger trg_venda_robo_logs
after update on public.vendas
for each row
execute function public.log_venda_robo_changes();

insert into public.venda_robo_logs (
  venda_id, robo_nome, origem, acao, campo, campo_label,
  valor_anterior, valor_novo, descricao, detalhes, created_at
)
select
  v.id, 'Robô OMNI', 'registro_legado', 'leitura_robo',
  'status_leitura_robo', 'Status da leitura do robô',
  null, v.status_leitura_robo,
  'Registro legado detectado: ' || v.status_leitura_robo,
  jsonb_build_object('numero_pedido', v.numero, 'operadora', v.operadora),
  coalesce(v.updated_at, now())
from public.vendas v
where nullif(v.status_leitura_robo, '') is not null
  and not exists (
    select 1 from public.venda_robo_logs l
    where l.venda_id = v.id
      and l.origem = 'registro_legado'
      and l.valor_novo = v.status_leitura_robo
  );
