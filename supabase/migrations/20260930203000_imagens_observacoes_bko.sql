-- Imagens nas observações de venda.
-- Somente BKO pode enviar/remover arquivos do bucket dedicado.
-- Qualquer usuário autenticado que tenha acesso à venda pode visualizar.

alter table public.venda_observacoes
  add column if not exists imagens text[] not null default '{}';

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'venda-observacoes',
  'venda-observacoes',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','image/gif']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Ler imagens de observacoes acessiveis" on storage.objects;
create policy "Ler imagens de observacoes acessiveis"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'venda-observacoes'
  and public.venda_usuario_tem_acesso((split_part(name, '/', 1))::uuid)
);

drop policy if exists "BKO envia imagens de observacoes" on storage.objects;
create policy "BKO envia imagens de observacoes"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'venda-observacoes'
  and public.has_role(auth.uid(), 'bko'::public.app_role)
  and public.venda_usuario_tem_acesso((split_part(name, '/', 1))::uuid)
);

drop policy if exists "BKO remove imagens de observacoes" on storage.objects;
create policy "BKO remove imagens de observacoes"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'venda-observacoes'
  and public.has_role(auth.uid(), 'bko'::public.app_role)
  and public.venda_usuario_tem_acesso((split_part(name, '/', 1))::uuid)
);
