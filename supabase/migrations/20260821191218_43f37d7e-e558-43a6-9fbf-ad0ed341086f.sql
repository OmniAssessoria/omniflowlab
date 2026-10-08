SET session_replication_role = 'replica';

-- Atualiza e-mail e senha (usando pgcrypto através de extensão se disponível, 
-- ou simplesmente forçando o e-mail e permitindo que o usuário use o 'esqueci senha' 
-- se o crypt falhar, mas vamos tentar com a extensão habilitada)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE auth.users 
SET email = 'pablomazinesantos@gmail.com', 
    encrypted_password = crypt('123456', gen_salt('bf')),
    email_confirmed_at = now(),
    updated_at = now()
WHERE id = '9a81554c-6f52-4423-9400-eef7991fb1b6';

UPDATE public.profiles 
SET email = 'pablomazinesantos@gmail.com',
    updated_at = now()
WHERE id = '9a81554c-6f52-4423-9400-eef7991fb1b6';

SET session_replication_role = 'origin';