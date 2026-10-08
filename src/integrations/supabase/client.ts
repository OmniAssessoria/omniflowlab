import { createClient } from '@supabase/supabase-js';
import type { Database } from './types-extended';
import { brokeredPreviewStorage } from './previewAuthStorage';

const SU_URL = import.meta.env.VT_SU_URL as string | undefined;
const SU_PUBLISHABLE_KEY = import.meta.env.VT_SU_PUBLISHABLE_KEY as string | undefined;
const AUTH_STORAGE_KEY = 'omni-flow-jgruz-auth-v2';

function createSupabaseClient() {
  if (!SU_URL || !SU_PUBLISHABLE_KEY) {
    throw new Error('Configuração de conexão indisponível: VT_SU_URL / VT_SU_PUBLISHABLE_KEY.');
  }

  return createClient<Database>(SU_URL, SU_PUBLISHABLE_KEY, {
    auth: {
      storage: brokeredPreviewStorage(),
      storageKey: AUTH_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
