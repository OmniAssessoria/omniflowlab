alter table public.closer_pedido_mensagens
  add column if not exists imagem_storage_path text,
  add column if not exists imagem_nome_original text,
  add column if not exists imagem_mime_type text,
  add column if not exists imagem_tamanho_bytes bigint;

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
  )
);
