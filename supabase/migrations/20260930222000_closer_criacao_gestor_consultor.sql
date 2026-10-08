-- Operação Closer: ONVOX / Take Flow
-- Closer e Consultor podem criar para si.
-- BKO, ADM e Gestor podem criar escolhendo o responsável.
-- O responsável pode ter papel closer ou consultor.

create or replace function public.closer_listar_responsaveis_criacao()
returns table(id uuid, nome text, email text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select distinct
    p.id,
    coalesce(nullif(btrim(p.nome_completo), ''), p.email, 'Consultor') as nome,
    p.email
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id
  where ur.role::text in ('closer', 'consultor')
    and coalesce(p.ativo, true)
    and (
      public.has_role(auth.uid(), 'bko'::public.app_role)
      or public.has_role(auth.uid(), 'admin'::public.app_role)
      or public.has_role(auth.uid(), 'gestor'::public.app_role)
    )
  order by 2;
$function$;

revoke all on function public.closer_listar_responsaveis_criacao() from public, anon;
grant execute on function public.closer_listar_responsaveis_criacao() to authenticated;

drop policy if exists "closer_pedidos_insert" on public.closer_pedidos;
create policy "closer_pedidos_insert"
on public.closer_pedidos
for insert
to authenticated
with check (
  (
    (
      public.has_role((select auth.uid()), 'closer'::public.app_role)
      or public.has_role((select auth.uid()), 'consultor'::public.app_role)
    )
    and closer_id = (select auth.uid())
    and created_by = (select auth.uid())
    and bko_id is null
    and bko_nome is null
    and etapa = 'CONTRATO'
    and data_recebimento is null
    and data_envio is null
    and data_assinatura is null
    and data_implantacao is null
    and data_ativacao is null
    and erro is null
    and observacao_bko is null
    and concluido_em is null
    and cancelado_em is null
  )
  or
  (
    (
      public.has_role((select auth.uid()), 'bko'::public.app_role)
      or public.has_role((select auth.uid()), 'admin'::public.app_role)
      or public.has_role((select auth.uid()), 'gestor'::public.app_role)
    )
    and created_by = (select auth.uid())
    and etapa = 'CONTRATO'
    and bko_id is null
    and bko_nome is null
    and data_recebimento is null
    and data_envio is null
    and data_assinatura is null
    and data_implantacao is null
    and data_ativacao is null
    and erro is null
    and observacao_bko is null
    and concluido_em is null
    and cancelado_em is null
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = closer_pedidos.closer_id
        and ur.role::text in ('closer', 'consultor')
    )
  )
);

drop policy if exists "closer_clientes_insert" on public.closer_clientes;
create policy "closer_clientes_insert"
on public.closer_clientes
for insert
to authenticated
with check (
  (
    (
      public.has_role((select auth.uid()), 'closer'::public.app_role)
      or public.has_role((select auth.uid()), 'consultor'::public.app_role)
    )
    and closer_id = (select auth.uid())
    and created_by = (select auth.uid())
  )
  or
  (
    (
      public.has_role((select auth.uid()), 'bko'::public.app_role)
      or public.has_role((select auth.uid()), 'admin'::public.app_role)
      or public.has_role((select auth.uid()), 'gestor'::public.app_role)
    )
    and created_by = (select auth.uid())
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = closer_clientes.closer_id
        and ur.role::text in ('closer', 'consultor')
    )
  )
);

drop policy if exists "closer_clientes_update" on public.closer_clientes;
create policy "closer_clientes_update"
on public.closer_clientes
for update
to authenticated
using (
  (
    (
      public.has_role((select auth.uid()), 'closer'::public.app_role)
      or public.has_role((select auth.uid()), 'consultor'::public.app_role)
    )
    and (
      closer_id = (select auth.uid())
      or exists (
        select 1
        from public.closer_pedidos p
        where p.cliente_id = closer_clientes.id
          and p.closer_id = (select auth.uid())
      )
    )
  )
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
  or public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'gestor'::public.app_role)
)
with check (
  (
    (
      public.has_role((select auth.uid()), 'closer'::public.app_role)
      or public.has_role((select auth.uid()), 'consultor'::public.app_role)
    )
    and (
      closer_id = (select auth.uid())
      or exists (
        select 1
        from public.closer_pedidos p
        where p.cliente_id = closer_clientes.id
          and p.closer_id = (select auth.uid())
      )
    )
  )
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
  or public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'gestor'::public.app_role)
);

drop policy if exists "closer_pedido_itens_insert" on public.closer_pedido_itens;
create policy "closer_pedido_itens_insert"
on public.closer_pedido_itens
for insert
to authenticated
with check (
  (
    (
      public.has_role((select auth.uid()), 'closer'::public.app_role)
      or public.has_role((select auth.uid()), 'consultor'::public.app_role)
    )
    and created_by = (select auth.uid())
    and data_portabilidade is null
    and status_portabilidade is null
    and data_entrega is null
    and exists (
      select 1
      from public.closer_pedidos p
      where p.id = closer_pedido_itens.pedido_id
        and p.closer_id = (select auth.uid())
        and p.produto = 'ONVOX'
    )
  )
  or
  (
    public.has_role((select auth.uid()), 'bko'::public.app_role)
    and created_by = (select auth.uid())
    and data_portabilidade is null
    and status_portabilidade is null
    and data_entrega is null
    and exists (
      select 1
      from public.closer_pedidos p
      where p.id = closer_pedido_itens.pedido_id
        and p.produto = 'ONVOX'
    )
  )
  or
  (
    (
      public.has_role((select auth.uid()), 'admin'::public.app_role)
      or public.has_role((select auth.uid()), 'gestor'::public.app_role)
    )
    and status_portabilidade is null
  )
);

drop policy if exists "closer_pedido_documentos_insert" on public.closer_pedido_documentos;
create policy "closer_pedido_documentos_insert"
on public.closer_pedido_documentos
for insert
to authenticated
with check (
  enviado_por = (select auth.uid())
  and exists (
    select 1 from public.closer_pedidos p
    where p.id = closer_pedido_documentos.pedido_id
  )
  and (
    public.has_role((select auth.uid()), 'closer'::public.app_role)
    or public.has_role((select auth.uid()), 'consultor'::public.app_role)
    or public.has_role((select auth.uid()), 'bko'::public.app_role)
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
    or public.has_role((select auth.uid()), 'gestor'::public.app_role)
  )
);

drop policy if exists "closer_pedido_mensagens_insert" on public.closer_pedido_mensagens;
create policy "closer_pedido_mensagens_insert"
on public.closer_pedido_mensagens
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.closer_pedidos p
    where p.id = closer_pedido_mensagens.pedido_id
      and (
        (
          (
            public.has_role((select auth.uid()), 'closer'::public.app_role)
            or public.has_role((select auth.uid()), 'consultor'::public.app_role)
          )
          and p.closer_id = (select auth.uid())
        )
        or public.has_role((select auth.uid()), 'bko'::public.app_role)
      )
  )
);

drop policy if exists "closer_tags_catalogo_select" on public.closer_tags_catalogo;
create policy "closer_tags_catalogo_select"
on public.closer_tags_catalogo
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'closer'::public.app_role)
  or public.has_role((select auth.uid()), 'consultor'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
  or public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'gestor'::public.app_role)
);

drop policy if exists "closer_documentos_storage_insert" on storage.objects;
create policy "closer_documentos_storage_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'closer-documentos'
  and exists (
    select 1
    from public.closer_pedidos p
    where p.id = (split_part(objects.name, '/', 1))::uuid
  )
  and (
    public.has_role((select auth.uid()), 'closer'::public.app_role)
    or public.has_role((select auth.uid()), 'consultor'::public.app_role)
    or public.has_role((select auth.uid()), 'bko'::public.app_role)
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
    or public.has_role((select auth.uid()), 'gestor'::public.app_role)
  )
);
