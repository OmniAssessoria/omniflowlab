-- Imagem colada em Informação do Atendimento é ação operacional de BKO/Admin.
-- Informações de texto preservam as permissões atuais.

create or replace function public.guard_suporte_informacao_imagem()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_doc public.suporte_documentos%rowtype;
  v_uid uuid := auth.uid();
begin
  if new.imagem_documento_id is null then
    return new;
  end if;

  if v_uid is null or not (
    public.has_role(v_uid,'admin'::public.app_role)
    or public.has_role(v_uid,'bko'::public.app_role)
  ) then
    raise exception '403: somente BKO ou Administrador pode anexar imagem à informação operacional.';
  end if;

  select * into v_doc
  from public.suporte_documentos
  where id = new.imagem_documento_id
    and deleted_at is null;

  if not found then
    raise exception 'Imagem vinculada não encontrada.';
  end if;

  if v_doc.solicitacao_id is distinct from new.solicitacao_id then
    raise exception 'A imagem precisa pertencer ao mesmo atendimento.';
  end if;

  if v_doc.created_by is distinct from v_uid then
    raise exception 'A imagem precisa ter sido enviada pelo mesmo usuário que registra a informação.';
  end if;

  if v_doc.mime_type not in ('image/jpeg','image/png','image/webp','image/gif') then
    raise exception 'O anexo da informação precisa ser uma imagem.';
  end if;

  return new;
end;
$function$;

revoke all on function public.guard_suporte_informacao_imagem() from public, anon, authenticated;
