-- Permite vincular uma imagem privada a uma informação operacional de suporte.
-- Reutiliza suporte_documentos/storage existentes e preserva as regras atuais de acesso.

alter table public.suporte_informacoes
  add column if not exists imagem_documento_id uuid
  references public.suporte_documentos(id)
  on delete set null;

create index if not exists idx_suporte_informacoes_imagem_documento
  on public.suporte_informacoes(imagem_documento_id)
  where imagem_documento_id is not null;

create or replace function public.guard_suporte_informacao_imagem()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_doc public.suporte_documentos%rowtype;
begin
  if new.imagem_documento_id is null then
    return new;
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

  if v_doc.mime_type not in ('image/jpeg','image/png','image/webp','image/gif') then
    raise exception 'O anexo da informação precisa ser uma imagem.';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_guard_suporte_informacao_imagem
  on public.suporte_informacoes;

create trigger trg_guard_suporte_informacao_imagem
before insert or update of imagem_documento_id, solicitacao_id
on public.suporte_informacoes
for each row
execute function public.guard_suporte_informacao_imagem();

revoke all on function public.guard_suporte_informacao_imagem() from public, anon, authenticated;
