-- Ordem visual independente da ordem operacional.
-- Não altera destino inicial, sequência comercial ou automações existentes.

alter table public.pipeline_etapas
  add column if not exists ordem_exibicao integer;

update public.pipeline_etapas
set ordem_exibicao = ordem
where ordem_exibicao is null;

alter table public.pipeline_etapas
  alter column ordem_exibicao set not null;

create index if not exists idx_pipeline_etapas_funil_ordem_exibicao
  on public.pipeline_etapas(funil_id, ordem_exibicao);

create or replace function public.pipeline_reorder_etapas_exibicao(
  p_funil_id text,
  p_etapa_ids text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_total integer;
  v_distintos integer;
  v_validos integer;
  v_email text;
  v_old jsonb;
  v_new jsonb;
begin
  perform public.pipeline_assert_admin_bko();

  if p_funil_id is null or btrim(p_funil_id) = '' then
    raise exception 'Funil inválido.';
  end if;

  if p_etapa_ids is null or coalesce(array_length(p_etapa_ids, 1), 0) = 0 then
    raise exception 'A lista de etapas não pode ficar vazia.';
  end if;

  select count(*)::integer
    into v_total
  from public.pipeline_etapas
  where funil_id = p_funil_id;

  select count(distinct id)::integer
    into v_distintos
  from unnest(p_etapa_ids) as t(id);

  select count(*)::integer
    into v_validos
  from public.pipeline_etapas e
  where e.funil_id = p_funil_id
    and e.id = any(p_etapa_ids);

  if v_total <> coalesce(array_length(p_etapa_ids, 1), 0)
     or v_distintos <> v_total
     or v_validos <> v_total then
    raise exception 'A nova ordem precisa conter exatamente todas as etapas do funil, sem duplicidades.';
  end if;

  select jsonb_agg(
           jsonb_build_object(
             'id', e.id,
             'ordem_exibicao', e.ordem_exibicao
           )
           order by e.ordem_exibicao, e.ordem, e.id
         )
    into v_old
  from public.pipeline_etapas e
  where e.funil_id = p_funil_id;

  update public.pipeline_etapas e
  set ordem_exibicao = ordered.pos,
      updated_by = auth.uid()
  from (
    select id, ordinality::integer as pos
    from unnest(p_etapa_ids) with ordinality as u(id, ordinality)
  ) ordered
  where e.id = ordered.id
    and e.funil_id = p_funil_id;

  select jsonb_agg(
           jsonb_build_object(
             'id', e.id,
             'ordem_exibicao', e.ordem_exibicao
           )
           order by e.ordem_exibicao, e.ordem, e.id
         )
    into v_new
  from public.pipeline_etapas e
  where e.funil_id = p_funil_id;

  select email into v_email
  from public.profiles
  where id = auth.uid();

  insert into public.audit_logs(
    user_id,
    user_email,
    acao,
    descricao,
    entidade,
    entidade_id,
    valor_anterior,
    valor_novo
  ) values (
    auth.uid(),
    v_email,
    'pipeline_etapas_reordenacao_visual',
    'Ordem de exibição das etapas alterada no funil ' || p_funil_id || '.',
    'pipeline_funil',
    p_funil_id,
    v_old,
    v_new
  );
end;
$function$;

revoke all on function public.pipeline_reorder_etapas_exibicao(text, text[]) from public, anon;
grant execute on function public.pipeline_reorder_etapas_exibicao(text, text[]) to authenticated;
