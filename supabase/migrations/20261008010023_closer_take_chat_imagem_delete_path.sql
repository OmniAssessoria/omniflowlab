drop policy if exists closer_documentos_storage_delete on storage.objects;
create policy closer_documentos_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'closer-documentos'
  and (
    exists (
      select 1
      from public.closer_pedido_documentos d
      where d.storage_path = objects.name
        and (
          d.enviado_por = (select auth.uid())
          or public.has_role((select auth.uid()), 'bko'::public.app_role)
          or public.has_role((select auth.uid()), 'admin'::public.app_role)
          or public.has_role((select auth.uid()), 'gestor'::public.app_role)
        )
    )
    or exists (
      select 1
      from public.closer_pedido_mensagens m
      where m.imagem_storage_path = objects.name
        and (
          m.user_id = (select auth.uid())
          or public.has_role((select auth.uid()), 'bko'::public.app_role)
          or public.has_role((select auth.uid()), 'admin'::public.app_role)
          or public.has_role((select auth.uid()), 'gestor'::public.app_role)
        )
    )
    or (
      (storage.foldername(objects.name))[2] = 'chat'
      and exists (
        select 1
        from public.closer_pedidos p
        where p.id = (split_part(objects.name, '/', 1))::uuid
          and (
            p.closer_id = (select auth.uid())
            or public.has_role((select auth.uid()), 'bko'::public.app_role)
            or public.has_role((select auth.uid()), 'admin'::public.app_role)
            or public.has_role((select auth.uid()), 'gestor'::public.app_role)
          )
      )
    )
  )
);
