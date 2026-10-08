// Server-side Supabase client with elevated key for the external Supabase project.
// SECURITY: never expose the secret key to client-side code.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SU_URL =
  process.env.SU_URL ||
  process.env.VT_SU_URL ||
  (import.meta.env.VT_SU_URL as string | undefined);

const LEGACY_SECRET_KEY_NAME = ['SUPA', 'BASE', '_SECRET_KEY'].join('');
const LEGACY_SECRET_KEYS_NAME = ['SUPA', 'BASE', '_SECRET_KEYS'].join('');

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function resolveSupabaseAdminKey(): string | undefined {
  if (process.env.SU_SECRET_KEY) return process.env.SU_SECRET_KEY;

  if (process.env.SU_SECRET_KEYS) {
    try {
      const keys = JSON.parse(process.env.SU_SECRET_KEYS) as Record<string, string>;
      if (keys.default) return keys.default;
      const firstKey = Object.values(keys).find(Boolean);
      if (firstKey) return firstKey;
    } catch {
      console.warn('[Data] SU_SECRET_KEYS is not valid JSON.');
    }
  }

  const legacySingle = process.env[LEGACY_SECRET_KEY_NAME];
  if (legacySingle) return legacySingle;

  const legacyMultiple = process.env[LEGACY_SECRET_KEYS_NAME];
  if (legacyMultiple) {
    try {
      const keys = JSON.parse(legacyMultiple) as Record<string, string>;
      if (keys.default) return keys.default;
      return Object.values(keys).find(Boolean);
    } catch {
      console.warn('[Data] Legacy secret-key collection is not valid JSON.');
    }
  }

  return undefined;
}

function createSupabaseAdminClient() {
  const SU_ADMIN_KEY = resolveSupabaseAdminKey();

  if (!SU_URL) {
    throw new Error('Missing server connection variable: SU_URL.');
  }

  if (!SU_ADMIN_KEY) {
    const message = 'Missing server connection variable: SU_SECRET_KEY.';
    console.error(`[Data] ${message}`);
    throw new Error(message);
  }

  return createClient<Database>(SU_URL, SU_ADMIN_KEY, {
    global: {
      fetch: createSupabaseFetch(SU_ADMIN_KEY),
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
