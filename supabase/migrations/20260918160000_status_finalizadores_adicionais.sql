-- Amplia os Status Comerciais que finalizam comercialmente o pedido.
-- CLARO: MV - ATIVADO 100% e FB - CONECTADO.
-- VIVO: MV - LOGÍSTICA CONCLUÍDA, FB - INSTALADO e AVA - INSTALADO.
-- O frontend já abre o modal de confirmação sempre que is_final = true.

do $$
declare
  v_count integer;
begin
  update public.status_comercial_operadoras
  set is_final = true,
      updated_at = now()
  where
    (operadora = 'CLARO'::public.operadora_enum and nome in (
      'MV - ATIVADO 100%',
      'FB - CONECTADO'
    ))
    or
    (operadora = 'VIVO'::public.operadora_enum and nome in (
      'MV - LOGÍSTICA CONCLUÍDA',
      'FB - INSTALADO',
      'AVA - INSTALADO'
    ));

  select count(*)
  into v_count
  from public.status_comercial_operadoras
  where ativo
    and is_final
    and (
      (operadora = 'CLARO'::public.operadora_enum and nome in (
        'MV - ATIVADO 100%',
        'FB - CONECTADO'
      ))
      or
      (operadora = 'VIVO'::public.operadora_enum and nome in (
        'MV - LOGÍSTICA CONCLUÍDA',
        'FB - INSTALADO',
        'AVA - INSTALADO'
      ))
    );

  if v_count <> 5 then
    raise exception 'Esperados 5 Status Comerciais finalizadores ativos; encontrados %.', v_count;
  end if;
end $$;
