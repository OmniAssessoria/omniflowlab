-- Observações do pedido: no máximo 1 imagem por observação.
-- Upload/remocão liberados para Admin, Gestor, BKO e Consultor com acesso à venda.
-- A imagem permanece em coluna própria (imagens) e não é propagada para status/histórico textual.

alter table public.venda_observacoes
  drop constraint if exists venda_observacoes_uma_imagem_check;

alter table public.venda_observacoes
  add constraint venda_observacoes_uma_imagem_check
  check (coalesce(cardinality(imagens), 0) <= 1);

create or replace function public.proteger_imagens_observacao_bko()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_pode_midia boolean := false;
begin
  if coalesce(cardinality(new.imagens), 0) > 1 then
    raise exception 'A observação aceita somente 1 imagem.';
  end if;

  if auth.uid() is null then
    return new;
  end if;

  v_pode_midia :=
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'gestor'::public.app_role)
    or public.has_role(auth.uid(), 'bko'::public.app_role)
    or public.has_role(auth.uid(), 'consultor'::public.app_role);

  if tg_op = 'INSERT' then
    if coalesce(cardinality(new.imagens), 0) > 0 and not v_pode_midia then
      raise exception '403: perfil sem permissão para inserir imagem em observações.';
    end if;
    return new;
  end if;

  if new.imagens is distinct from old.imagens and not v_pode_midia then
    raise exception '403: perfil sem permissão para alterar imagem em observações.';
  end if;

  return new;
end;
$function$;

drop policy if exists "BKO envia imagens de observacoes" on storage.objects;
drop policy if exists "Perfis operacionais enviam imagens de observacoes" on storage.objects;

create policy "Perfis operacionais enviam imagens de observacoes"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'venda-observacoes'
  and (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'gestor'::public.app_role)
    or public.has_role(auth.uid(), 'bko'::public.app_role)
    or public.has_role(auth.uid(), 'consultor'::public.app_role)
  )
  and public.venda_usuario_tem_acesso((split_part(name, '/', 1))::uuid)
);

drop policy if exists "BKO remove imagens de observacoes" on storage.objects;
drop policy if exists "Perfis operacionais removem imagens de observacoes" on storage.objects;

create policy "Perfis operacionais removem imagens de observacoes"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'venda-observacoes'
  and (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'gestor'::public.app_role)
    or public.has_role(auth.uid(), 'bko'::public.app_role)
    or public.has_role(auth.uid(), 'consultor'::public.app_role)
  )
  and public.venda_usuario_tem_acesso((split_part(name, '/', 1))::uuid)
);
