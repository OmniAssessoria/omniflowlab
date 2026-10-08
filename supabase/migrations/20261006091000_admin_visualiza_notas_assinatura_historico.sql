-- Permite que administradores visualizem as Notas de Assinatura no histórico unificado.
-- Mantém a política existente de Gestor/Consultor e não concede acesso ao BKO.

create policy "Assinatura notas visiveis para admin"
on public.venda_consultor_notas
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));
