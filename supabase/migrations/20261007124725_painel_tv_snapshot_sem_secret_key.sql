-- Painel TV sem dependência de chave administrativa no runtime.
-- Retorna somente o snapshot necessário e exige o perfil telespectador.
create or replace function public.painel_tv_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_start timestamptz := date_trunc('month', now()) - interval '5 months';
  v_result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role::text = 'telespectador'
  ) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'equipe', 'Telecom',
    'fontes', coalesce((
      select jsonb_agg(src.fonte order by src.fonte)
      from (
        select distinct coalesce(t.fonte, 'Não informado') as fonte
        from public.vw_painel_tv_telecom t
        where t.data_assinatura >= v_start
      ) src
    ), '[]'::jsonb),
    'consultores', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'nome', c.nome,
          'cargo', c.cargo,
          'foto_url', c.foto_url
        )
        order by c.nome
      )
      from public.vw_painel_tv_consultores c
    ), '[]'::jsonb),
    'contratos', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'empresa', t.empresa,
          'consultor_id', t.consultor_id,
          'consultor', t.consultor,
          'fonte', coalesce(t.fonte, 'Não informado'),
          'valor', coalesce(t.valor, 0),
          'data_assinatura', t.data_assinatura
        )
        order by t.data_assinatura desc
      )
      from public.vw_painel_tv_telecom t
      where t.data_assinatura >= v_start
    ), '[]'::jsonb),
    'metas', coalesce((
      select jsonb_object_agg(
        format('%s-%s', m.ano, lpad(m.mes::text, 2, '0')),
        jsonb_build_object(
          'meta', coalesce(m.meta, 0),
          'sup', coalesce(m.super_meta, 0),
          'elite', coalesce(m.meta_elite, 0),
          'ind', coalesce(m.meta_individual, 0)
        )
      )
      from public.painel_tv_metas m
    ), '{}'::jsonb),
    'atualizado_em', now()
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.painel_tv_snapshot() from public;
revoke all on function public.painel_tv_snapshot() from anon;
grant execute on function public.painel_tv_snapshot() to authenticated;
