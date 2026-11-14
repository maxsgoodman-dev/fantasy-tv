import { createClient } from '@supabase/supabase-js'

/** Service-role client for auth admin calls. Server-only: never import from client code. */
export function createAuthAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
