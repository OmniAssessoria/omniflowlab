-- O consultor responsável pelo pedido deve conseguir ler o card vinculado à sua solicitação.
drop policy if exists "leitura tickets por perfil" on public.tickets;

create policy "leitura tickets por perfil"
on public.tickets for select to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'gestor'::public.app_role)
  or public.has_role(auth.uid(), 'bko'::public.app_role)
  or public.has_role(auth.uid(), 'suporte'::public.app_role)
  or criado_por = auth.uid()
  or atribuido_a = auth.uid()
  or exists (
    select 1
    from public.suporte_solicitacoes s
    join public.vendas v on v.id = s.venda_id
    where s.id = tickets.solicitacao_id
      and (s.criado_por = auth.uid() or v.consultor_id = auth.uid())
  )
);
