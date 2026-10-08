-- Fluxo de suporte para Closer:
-- Closer cria o chamado na Operação Closer.
-- Somente Admin e BKO visualizam, respondem e operam chamados criados por Closer.
-- Demais fluxos de suporte existentes permanecem inalterados.

create or replace function public.suporte_usuario_tem_acesso(p_solicitacao_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.suporte_solicitacoes s
    left join public.vendas v on v.id=s.venda_id
    where s.id=p_solicitacao_id
      and s.deleted_at is null
      and auth.uid() is not null
      and (
        (
          public.has_role(s.criado_por,'closer'::public.app_role)
          and (
            public.has_role(auth.uid(),'admin'::public.app_role)
            or public.has_role(auth.uid(),'bko'::public.app_role)
          )
        )
        or
        (
          not public.has_role(s.criado_por,'closer'::public.app_role)
          and (
            public.has_role(auth.uid(),'admin'::public.app_role)
            or public.has_role(auth.uid(),'bko'::public.app_role)
            or public.has_role(auth.uid(),'gestor'::public.app_role)
            or s.criado_por=auth.uid()
            or v.consultor_id=auth.uid()
          )
        )
      )
  );
$function$;

alter table public.suporte_mensagens
  drop constraint if exists suporte_mensagens_autor_role_check;

alter table public.suporte_mensagens
  add constraint suporte_mensagens_autor_role_check
  check (autor_role in ('consultor','bko','admin'));

drop policy if exists "suporte mensagens insercao" on public.suporte_mensagens;

create policy "suporte mensagens insercao"
on public.suporte_mensagens
for insert
to authenticated
with check (
  autor_id = auth.uid()
  and public.suporte_usuario_tem_acesso(solicitacao_id)
  and (
    (autor_role='admin' and public.has_role(auth.uid(),'admin'::public.app_role))
    or (autor_role='bko' and public.has_role(auth.uid(),'bko'::public.app_role))
    or (autor_role='consultor' and public.has_role(auth.uid(),'consultor'::public.app_role))
  )
);
