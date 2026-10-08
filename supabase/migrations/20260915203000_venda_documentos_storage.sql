-- Documentos privados vinculados aos pedidos.
-- Metadados permanecem auditáveis; binários ficam em bucket privado.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pedido-documentos',
  'pedido-documentos',
  false,
  104857600,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.venda_documentos (
  id uuid primary key,
  venda_id uuid not null references public.vendas(id) on delete cascade,
  titulo text not null check (length(btrim(titulo)) between 1 and 200),
  arquivo_nome_original text not null,
  storage_path text not null unique,
  mime_type text not null check (mime_type in (
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  )),
  tamanho_bytes bigint not null check (tamanho_bytes > 0 and tamanho_bytes <= 104857600),
  created_by uuid not null references auth.users(id),
  created_by_nome text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  deleted_by_nome text
);

create index if not exists venda_documentos_venda_ativos_idx
  on public.venda_documentos(venda_id, created_at desc)
  where deleted_at is null;

create or replace function public.venda_usuario_tem_acesso(p_venda_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.vendas v
    where v.id = p_venda_id
      and v.deleted_at is null
      and coalesce(v.is_deleted, false) = false
      and (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        or public.has_role(auth.uid(), 'gestor'::public.app_role)
        or public.has_role(auth.uid(), 'bko'::public.app_role)
        or public.has_role(auth.uid(), 'suporte'::public.app_role)
        or (
          public.has_role(auth.uid(), 'consultor'::public.app_role)
          and v.consultor_id = auth.uid()
        )
      )
  );
$$;

revoke all on function public.venda_usuario_tem_acesso(uuid) from public, anon;
grant execute on function public.venda_usuario_tem_acesso(uuid) to authenticated;

alter table public.venda_documentos enable row level security;

drop policy if exists "Acesso a documentos segue acesso ao pedido" on public.venda_documentos;
create policy "Acesso a documentos segue acesso ao pedido"
on public.venda_documentos
for select
to authenticated
using (public.venda_usuario_tem_acesso(venda_id));

revoke insert, update, delete on public.venda_documentos from authenticated;
grant select on public.venda_documentos to authenticated;

-- Storage segue o UUID da venda no primeiro segmento do caminho.
drop policy if exists "Upload documentos de pedidos acessiveis" on storage.objects;
create policy "Upload documentos de pedidos acessiveis"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'pedido-documentos'
  and public.venda_usuario_tem_acesso(split_part(name, '/', 1)::uuid)
);

drop policy if exists "Ler documentos ativos de pedidos acessiveis" on storage.objects;
create policy "Ler documentos ativos de pedidos acessiveis"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'pedido-documentos'
  and public.venda_usuario_tem_acesso(split_part(name, '/', 1)::uuid)
  and exists (
    select 1
    from public.venda_documentos d
    where d.storage_path = name
      and d.deleted_at is null
  )
);

drop policy if exists "Remover binario de pedido acessivel" on storage.objects;
create policy "Remover binario de pedido acessivel"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'pedido-documentos'
  and public.venda_usuario_tem_acesso(split_part(name, '/', 1)::uuid)
);

create or replace function public.registrar_documento_pedido(
  p_documento_id uuid,
  p_venda_id uuid,
  p_titulo text,
  p_nome_original text,
  p_storage_path text,
  p_mime_type text,
  p_tamanho_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_nome text;
  v_titulo text := btrim(coalesce(p_titulo, ''));
  v_nome_original text := btrim(coalesce(p_nome_original, ''));
begin
  if v_user_id is null then
    raise exception '401: usuário não autenticado.';
  end if;

  if not public.venda_usuario_tem_acesso(p_venda_id) then
    raise exception '403: sem acesso a este pedido.';
  end if;

  if length(v_titulo) < 1 or length(v_titulo) > 200 then
    raise exception 'Título do documento é obrigatório e deve ter até 200 caracteres.';
  end if;

  if length(v_nome_original) < 1 then
    raise exception 'Nome original do arquivo é obrigatório.';
  end if;

  if p_mime_type not in (
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ) then
    raise exception 'Tipo de arquivo não permitido.';
  end if;

  if p_tamanho_bytes <= 0 or p_tamanho_bytes > 104857600 then
    raise exception 'Arquivo deve ter no máximo 100 MB.';
  end if;

  if split_part(p_storage_path, '/', 1) <> p_venda_id::text
     or split_part(p_storage_path, '/', 2) <> p_documento_id::text then
    raise exception 'Caminho de documento inválido.';
  end if;

  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'pedido-documentos'
      and o.name = p_storage_path
  ) then
    raise exception 'Arquivo não encontrado no armazenamento.';
  end if;

  select coalesce(nome_completo, email, 'Usuário')
    into v_user_nome
  from public.profiles
  where id = v_user_id;

  v_user_nome := coalesce(v_user_nome, 'Usuário');

  insert into public.venda_documentos (
    id, venda_id, titulo, arquivo_nome_original, storage_path,
    mime_type, tamanho_bytes, created_by, created_by_nome
  ) values (
    p_documento_id, p_venda_id, v_titulo, v_nome_original, p_storage_path,
    p_mime_type, p_tamanho_bytes, v_user_id, v_user_nome
  );

  insert into public.venda_historico (
    venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome
  ) values (
    p_venda_id,
    'campo'::public.historico_tipo_enum,
    'documento_pedido',
    null,
    p_documento_id::text,
    'Documento adicionado: ' || v_titulo || ' (' || v_nome_original || ').',
    v_user_id,
    v_user_nome
  );

  return p_documento_id;
end;
$$;

revoke all on function public.registrar_documento_pedido(uuid,uuid,text,text,text,text,bigint) from public, anon;
grant execute on function public.registrar_documento_pedido(uuid,uuid,text,text,text,text,bigint) to authenticated;

create or replace function public.excluir_documento_pedido(p_documento_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_nome text;
  v_doc public.venda_documentos%rowtype;
begin
  if v_user_id is null then
    raise exception '401: usuário não autenticado.';
  end if;

  select * into v_doc
  from public.venda_documentos
  where id = p_documento_id
  for update;

  if not found then
    raise exception 'Documento não encontrado.';
  end if;

  if not public.venda_usuario_tem_acesso(v_doc.venda_id) then
    raise exception '403: sem acesso a este pedido.';
  end if;

  if v_doc.deleted_at is not null then
    return v_doc.storage_path;
  end if;

  select coalesce(nome_completo, email, 'Usuário')
    into v_user_nome
  from public.profiles
  where id = v_user_id;

  v_user_nome := coalesce(v_user_nome, 'Usuário');

  update public.venda_documentos
  set deleted_at = now(),
      deleted_by = v_user_id,
      deleted_by_nome = v_user_nome
  where id = p_documento_id
    and deleted_at is null;

  insert into public.venda_historico (
    venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome
  ) values (
    v_doc.venda_id,
    'campo'::public.historico_tipo_enum,
    'documento_pedido',
    p_documento_id::text,
    'excluido',
    'Documento excluído: ' || v_doc.titulo || ' (' || v_doc.arquivo_nome_original || ').',
    v_user_id,
    v_user_nome
  );

  return v_doc.storage_path;
end;
$$;

revoke all on function public.excluir_documento_pedido(uuid) from public, anon;
grant execute on function public.excluir_documento_pedido(uuid) to authenticated;
