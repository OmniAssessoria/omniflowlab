-- Mantém o Log dos Robôs mesmo quando a venda é recriada com outro UUID.

alter table public.venda_robo_logs
  add column if not exists venda_numero text;

update public.venda_robo_logs l
set venda_numero = coalesce(
  l.venda_numero,
  l.detalhes->>'numero_pedido',
  v.numero
)
from public.vendas v
where l.venda_id = v.id
  and l.venda_numero is null;

alter table public.venda_robo_logs
  drop constraint if exists venda_robo_logs_venda_id_fkey;

alter table public.venda_robo_logs
  alter column venda_id drop not null;

alter table public.venda_robo_logs
  add constraint venda_robo_logs_venda_id_fkey
  foreign key (venda_id)
  references public.vendas(id)
  on delete set null;

create index if not exists venda_robo_logs_numero_created_idx
  on public.venda_robo_logs(venda_numero, created_at desc);

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
        venda_id, venda_numero, robo_nome, origem, acao, campo, campo_label,
        valor_anterior, valor_novo, descricao, detalhes
      ) values (
        new.id, new.numero, 'Robô OMNI', 'automacao_sistema', 'alteracao_automatica',
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

insert into public.venda_robo_logs (
  venda_id, venda_numero, created_at, robo_nome, origem, acao,
  campo, campo_label, valor_anterior, valor_novo, descricao, detalhes
)
select
  v.id,
  v.numero,
  '2026-09-22 17:58:15.380824+00'::timestamptz,
  'Robô OMNI',
  'registro_legado',
  'leitura_robo',
  'status_leitura_robo',
  'Status da leitura do robô',
  null,
  '22/09/2026 14:58 | Houveram alterações',
  'Execução histórica do Robô OMNI recuperada a partir do registro existente antes da recriação da venda.',
  jsonb_build_object(
    'numero_pedido', 'VND-00001',
    'operadora', 'CLARO',
    'reconstrucao_historica', true,
    'observacao_reconstrucao', 'O sistema antigo não preservava o valor anterior campo a campo. Este bloco mostra o estado encontrado após a execução do robô.',
    'status_robo', '22/09/2026 14:58 | Houveram alterações',
    'snapshot_pos_execucao', jsonb_build_object(
      'Recebimento', '10/09/2026',
      'Preenchimento', '11/09/2026',
      'Envio', '11/09/2026',
      'Aceite', '11/09/2026',
      'Input', '18/09/2026',
      'Ativação', '19/09/2026',
      'Status do pedido', 'FILA INPUT'
    )
  )
from public.vendas v
where v.numero = 'VND-00001'
  and not exists (
    select 1
    from public.venda_robo_logs l
    where l.venda_numero = 'VND-00001'
      and l.origem = 'registro_legado'
      and l.created_at = '2026-09-22 17:58:15.380824+00'::timestamptz
  )
order by v.created_at desc
limit 1;
