-- Desabilita temporariamente o gatilho de proteção se ele existir e for restritivo
SET session_replication_role = 'replica';

UPDATE auth.users 
SET email = 'pablomazineng@gmail.com', 
    email_confirmed_at = now(),
    updated_at = now()
WHERE email = 'pablomazinesantos@gmail.com';

UPDATE public.profiles 
SET email = 'pablomazineng@gmail.com',
    updated_at = now()
WHERE email = 'pablomazinesantos@gmail.com';

SET session_replication_role = 'origin';