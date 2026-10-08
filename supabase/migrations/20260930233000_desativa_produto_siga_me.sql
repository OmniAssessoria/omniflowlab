-- SIGA-ME é produto legado e não deve mais aparecer para novos cadastros.
-- Mantém o registro apenas para preservar integridade/histórico caso necessário.

update public.produtos_catalogo
set ativo = false
where id = '5873ce70-3c34-4aec-9ab1-e2fae15449d4'::uuid
   or (
     upper(coalesce(operadora::text, '')) = 'VIVO'
     and regexp_replace(
       translate(upper(btrim(nome)),
         'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
         'AAAAAEEEEIIIIOOOOOUUUUC'),
       '[^A-Z0-9]+','','g'
     ) = 'SIGAME'
   );
