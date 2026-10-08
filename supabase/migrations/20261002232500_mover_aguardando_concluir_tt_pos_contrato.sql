-- Reposiciona a etapa existente "Aguardando concluir TT" para imediatamente
-- depois de "Contrato Assinado", preservando a ordem relativa das demais etapas.
-- A operação é segura mesmo se a ordem logo após Contrato Assinado já estiver ocupada.

do $$
declare
  v_contrato_ordem integer;
  v_max_ordem integer;
  v_offset integer;
begin
  lock table public.pipeline_etapas in share row exclusive mode;

  select ordem
    into v_contrato_ordem
  from public.pipeline_etapas
  where id = 'a-assinado'
    and funil_id = 'assinatura';

  if v_contrato_ordem is null then
    raise exception 'Etapa Contrato Assinado (a-assinado) não encontrada.';
  end if;

  if not exists (
    select 1
    from public.pipeline_etapas
    where id = 'a-tt'
      and funil_id = 'assinatura'
  ) then
    raise exception 'Etapa Aguardando concluir TT (a-tt) não encontrada.';
  end if;

  select coalesce(max(ordem), 0) into v_max_ordem
  from public.pipeline_etapas;

  v_offset := v_max_ordem + 1000;

  -- Retira temporariamente a etapa TT da sequência.
  update public.pipeline_etapas
  set ordem = -1000000,
      nome = 'Aguardando concluir TT',
      cor = 'warning',
      ativo = true,
      updated_at = now()
  where id = 'a-tt'
    and funil_id = 'assinatura';

  -- Abre um espaço imediatamente após Contrato Assinado sem colidir
  -- com a constraint UNIQUE de ordem.
  update public.pipeline_etapas
  set ordem = ordem + v_offset
  where ordem > v_contrato_ordem
    and id <> 'a-tt';

  update public.pipeline_etapas
  set ordem = ordem - v_offset + 1
  where ordem > v_offset;

  -- Insere TT no espaço recém-aberto.
  update public.pipeline_etapas
  set ordem = v_contrato_ordem + 1,
      updated_at = now()
  where id = 'a-tt'
    and funil_id = 'assinatura';
end
$$;
