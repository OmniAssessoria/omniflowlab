-- 1. Migrar usuários existentes com role 'suporte' para 'bko'
UPDATE public.user_roles
SET role = 'bko'
WHERE role = 'suporte';

-- 2. Atualizar logs de auditoria
UPDATE public.audit_logs
SET descricao = REPLACE(descricao, '(suporte)', '(bko)')
WHERE acao = 'user_create' AND descricao LIKE '%(suporte)%';

UPDATE public.audit_logs
SET valor_novo = CASE 
    WHEN jsonb_typeof(valor_novo) = 'object' THEN valor_novo || '{"role": "bko"}'::jsonb
    ELSE valor_novo 
END
WHERE entidade = 'user' AND valor_novo->>'role' = 'suporte';

-- 3. Atualizar registros em clientes
UPDATE public.clientes
SET deleted_by_role = 'bko'
WHERE deleted_by_role = 'suporte';