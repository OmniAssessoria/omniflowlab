DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_roles_user_id_fkey'
    ) THEN
        -- Check if there is an existing FK to auth.users and drop it if we want to point to profiles
        -- This is safer for Supabase client-side joins via PostgREST
        ALTER TABLE public.user_roles 
        DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
        
        ALTER TABLE public.user_roles 
        ADD CONSTRAINT user_roles_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Also verify/add the reverse if needed for the schema cache
-- Usually the FK above is enough for profiles -> user_roles join if using select('*, user_roles(*)')
