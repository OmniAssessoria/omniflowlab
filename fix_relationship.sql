DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_roles_user_id_fkey'
    ) THEN
        ALTER TABLE public.user_roles 
        DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey; -- just in case it points to auth.users
        
        ALTER TABLE public.user_roles 
        ADD CONSTRAINT user_roles_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END $$;
