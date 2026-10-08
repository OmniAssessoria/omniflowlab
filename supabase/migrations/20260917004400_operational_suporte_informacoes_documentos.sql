-- Evolução Operacional 2026-09-16
-- Histórico de informações e documentos privados por atendimento.

create table if not exists public.suporte_informacoes (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.suporte_solicitacoes(id) on delete cascade,
  informacao text not null check (length(btrim(informacao)) > 0),
  created_by uuid not null references auth.users(id),
  created_by_nome text not null,
  created_by_role text not null check (created_by_role in ('consultor','bko','admin')),
  created_at timestamptz not null default now()
);

create index if not exists idx_suporte_informacoes_solicitacao_created
  on public.suporte_informacoes(solicitacao_id, created_at desc);

alter table public.suporte_informacoes enable row level security;

drop policy if exists suporte_informacoes_read on public.suporte_informacoes;
create policy suporte_informacoes_read
on public.suporte_informacoes for select to authenticated
using (public.suporte_usuario_tem_acesso(solicitacao_id));

drop policy if exists suporte_informacoes_insert on public.suporte_informacoes;
create policy suporte_informacoes_insert
on public.suporte_informacoes for insert to authenticated
with check (
  created_by = auth.uid()
  and public.suporte_usuario_tem_acesso(solicitacao_id)
  and (
    (created_by_role='admin' and public.has_role(auth.uid(),'admin'::public.app_role))
    or (created_by_role='bko' and public.has_role(auth.uid(),'bko'::public.app_role))
    or (created_by_role='consultor' and public.has_role(auth.uid(),'consultor'::public.app_role))
  )
);

grant select, insert on public.suporte_informacoes to authenticated;

create table if not exists public.suporte_documentos (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.suporte_solicitacoes(id) on delete cascade,
  titulo text not null check (length(btrim(titulo)) between 1 and 200),
  arquivo_nome_original text not null,
  storage_path text not null unique,
  mime_type text not null,
  tamanho_bytes bigint not null check (tamanho_bytes > 0 and tamanho_bytes <= 104857600),
  created_by uuid not null references auth.users(id),
  created_by_nome text not null,
  created_by_role text not null check (created_by_role in ('consultor','bko','admin')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  deleted_by_nome text
);

create index if not exists idx_suporte_documentos_solicitacao_created
  on public.suporte_documentos(solicitacao_id, created_at desc)
  where deleted_at is null;

alter table public.suporte_documentos enable row level security;

drop policy if exists suporte_documentos_read on public.suporte_documentos;
create policy suporte_documentos_read
on public.suporte_documentos for select to authenticated
using (deleted_at is null and public.suporte_usuario_tem_acesso(solicitacao_id));

drop policy if exists suporte_documentos_insert on public.suporte_documentos;
create policy suporte_documentos_insert
on public.suporte_documentos for insert to authenticated
with check (
  created_by = auth.uid()
  and deleted_at is null
  and public.suporte_usuario_tem_acesso(solicitacao_id)
  and (
    (created_by_role='admin' and public.has_role(auth.uid(),'admin'::public.app_role))
    or (created_by_role='bko' and public.has_role(auth.uid(),'bko'::public.app_role))
    or (created_by_role='consultor' and public.has_role(auth.uid(),'consultor'::public.app_role))
  )
);

drop policy if exists suporte_documentos_soft_delete on public.suporte_documentos;
create policy suporte_documentos_soft_delete
on public.suporte_documentos for update to authenticated
using (public.suporte_usuario_tem_acesso(solicitacao_id))
with check (public.suporte_usuario_tem_acesso(solicitacao_id));

grant select, insert, update on public.suporte_documentos to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'suporte-documentos',
  'suporte-documentos',
  false,
  104857600,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg','image/png','image/webp','image/gif'
  ]
)
on conflict (id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Upload documentos de suporte acessiveis" on storage.objects;
create policy "Upload documentos de suporte acessiveis"
on storage.objects for insert to authenticated
with check (
  bucket_id='suporte-documentos'
  and public.suporte_usuario_tem_acesso((split_part(name,'/',1))::uuid)
);

drop policy if exists "Ler documentos de suporte acessiveis" on storage.objects;
create policy "Ler documentos de suporte acessiveis"
on storage.objects for select to authenticated
using (
  bucket_id='suporte-documentos'
  and public.suporte_usuario_tem_acesso((split_part(name,'/',1))::uuid)
  and exists (
    select 1 from public.suporte_documentos d
    where d.storage_path=storage.objects.name and d.deleted_at is null
  )
);

drop policy if exists "Remover binario de suporte acessivel" on storage.objects;
create policy "Remover binario de suporte acessivel"
on storage.objects for delete to authenticated
using (
  bucket_id='suporte-documentos'
  and public.suporte_usuario_tem_acesso((split_part(name,'/',1))::uuid)
);

create or replace function public.registrar_documento_suporte(
  p_documento_id uuid,
  p_solicitacao_id uuid,
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
  v_user_id uuid:=auth.uid();
  v_user_nome text;
  v_role text;
  v_titulo text:=btrim(coalesce(p_titulo,''));
begin
  if v_user_id is null then raise exception '401: usuário não autenticado.'; end if;
  if not public.suporte_usuario_tem_acesso(p_solicitacao_id) then raise exception '403: sem acesso ao atendimento.'; end if;
  if not (
    public.has_role(v_user_id,'admin'::public.app_role)
    or public.has_role(v_user_id,'bko'::public.app_role)
    or public.has_role(v_user_id,'consultor'::public.app_role)
  ) then raise exception '403: perfil sem permissão para anexar documentos.'; end if;
  if length(v_titulo)<1 or length(v_titulo)>200 then raise exception 'Título do documento é obrigatório e deve ter até 200 caracteres.'; end if;
  if nullif(btrim(p_nome_original),'') is null then raise exception 'Nome original do arquivo é obrigatório.'; end if;
  if p_mime_type not in ('application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png','image/webp','image/gif') then raise exception 'Tipo de arquivo não permitido.'; end if;
  if p_tamanho_bytes<=0 or p_tamanho_bytes>104857600 then raise exception 'Arquivo deve ter no máximo 100 MB.'; end if;
  if split_part(p_storage_path,'/',1)<>p_solicitacao_id::text or split_part(p_storage_path,'/',2)<>p_documento_id::text then raise exception 'Caminho de documento inválido.'; end if;
  if not exists(select 1 from storage.objects where bucket_id='suporte-documentos' and name=p_storage_path) then raise exception 'Arquivo não encontrado no armazenamento.'; end if;

  select coalesce(nome_completo,email,'Usuário') into v_user_nome from public.profiles where id=v_user_id;
  v_user_nome:=coalesce(v_user_nome,'Usuário');
  v_role:=case when public.has_role(v_user_id,'admin'::public.app_role) then 'admin' when public.has_role(v_user_id,'bko'::public.app_role) then 'bko' else 'consultor' end;

  insert into public.suporte_documentos(id,solicitacao_id,titulo,arquivo_nome_original,storage_path,mime_type,tamanho_bytes,created_by,created_by_nome,created_by_role)
  values(p_documento_id,p_solicitacao_id,v_titulo,btrim(p_nome_original),p_storage_path,p_mime_type,p_tamanho_bytes,v_user_id,v_user_nome,v_role);

  perform public.suporte_registrar_evento(p_solicitacao_id,null,'documento_adicionado','Documento adicionado: '||v_titulo||' ('||btrim(p_nome_original)||').',v_user_id,v_role,jsonb_build_object('documento_id',p_documento_id));
  return p_documento_id;
end;
$$;

grant execute on function public.registrar_documento_suporte(uuid,uuid,text,text,text,text,bigint) to authenticated;

create or replace function public.excluir_documento_suporte(p_documento_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid:=auth.uid();
  v_user_nome text;
  v_role text;
  v_doc public.suporte_documentos%rowtype;
begin
  if v_user_id is null then raise exception '401: usuário não autenticado.'; end if;
  select * into v_doc from public.suporte_documentos where id=p_documento_id for update;
  if not found then raise exception 'Documento não encontrado.'; end if;
  if not public.suporte_usuario_tem_acesso(v_doc.solicitacao_id) then raise exception '403: sem acesso ao atendimento.'; end if;
  if v_doc.deleted_at is not null then return v_doc.storage_path; end if;

  select coalesce(nome_completo,email,'Usuário') into v_user_nome from public.profiles where id=v_user_id;
  v_user_nome:=coalesce(v_user_nome,'Usuário');
  v_role:=case when public.has_role(v_user_id,'admin'::public.app_role) then 'admin' when public.has_role(v_user_id,'bko'::public.app_role) then 'bko' else 'consultor' end;

  update public.suporte_documentos
  set deleted_at=now(),deleted_by=v_user_id,deleted_by_nome=v_user_nome
  where id=p_documento_id and deleted_at is null;

  perform public.suporte_registrar_evento(v_doc.solicitacao_id,null,'documento_excluido','Documento excluído: '||v_doc.titulo||' ('||v_doc.arquivo_nome_original||').',v_user_id,v_role,jsonb_build_object('documento_id',p_documento_id));
  return v_doc.storage_path;
end;
$$;

grant execute on function public.excluir_documento_suporte(uuid) to authenticated;
