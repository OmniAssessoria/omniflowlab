-- Impede novos cadastros/alterações que reutilizem documento de uma empresa ativa.
-- Não altera nem mescla duplicidades históricas já existentes.
-- Também dá ao perfil Closer acesso somente às empresas criadas por ele,
-- para que "Minhas Empresas" funcione para todos os perfis sem abrir a carteira inteira.

create or replace function public.cliente_documento_em_uso(
  p_documento text,
  p_excluir_cliente_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.clientes c
    where c.deleted_at is null
      and coalesce(c.is_deleted, false) = false
      and regexp_replace(coalesce(c.cnpj_cpf, ''), '[^0-9A-Za-z]', '', 'g')
          = regexp_replace(coalesce(p_documento, ''), '[^0-9A-Za-z]', '', 'g')
      and regexp_replace(coalesce(p_documento, ''), '[^0-9A-Za-z]', '', 'g') <> ''
      and (p_excluir_cliente_id is null or c.id <> p_excluir_cliente_id)
  );
$function$;

grant execute on function public.cliente_documento_em_uso(text, uuid) to authenticated;

create policy "closer visualiza empresas proprias"
on public.clientes
for select
to authenticated
using (
  public.has_role(auth.uid(), 'closer'::public.app_role)
  and created_by = auth.uid()
);

create policy "closer cria empresas proprias"
on public.clientes
for insert
to authenticated
with check (
  public.has_role(auth.uid(), 'closer'::public.app_role)
  and created_by = auth.uid()
);

create policy "closer edita empresas proprias"
on public.clientes
for update
to authenticated
using (
  public.has_role(auth.uid(), 'closer'::public.app_role)
  and created_by = auth.uid()
)
with check (
  public.has_role(auth.uid(), 'closer'::public.app_role)
  and created_by = auth.uid()
);
