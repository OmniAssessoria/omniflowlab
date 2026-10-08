// Server-side auth middleware for the external data project.
import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const SU_URL = import.meta.env.VT_SU_URL as string | undefined
const SU_PUBLISHABLE_KEY = import.meta.env.VT_SU_PUBLISHABLE_KEY as string | undefined

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const request = getRequest()

    if (!SU_URL || !SU_PUBLISHABLE_KEY) {
      throw new Error('Server connection configuration unavailable')
    }

    if (!request?.headers) {
      throw new Error('Unauthorized: No request headers available')
    }

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Unauthorized: No authorization header provided')
    }

    const token = authHeader.slice('Bearer '.length).trim()
    if (!token || token.split('.').length !== 3) {
      throw new Error('Unauthorized: Invalid token')
    }

    const supabase = createClient<Database>(SU_URL, SU_PUBLISHABLE_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const { data, error } = await supabase.auth.getClaims(token)
    if (error || !data?.claims?.sub) {
      throw new Error(`Unauthorized: Invalid token${error?.message ? ` (${error.message})` : ''}`)
    }

    return next({
      context: {
        supabase,
        userId: data.claims.sub,
        claims: data.claims,
      },
    })
  },
)
