import { createClient } from '@supabase/supabase-js'

// Admin client that bypasses RLS - only use server-side for trusted operations
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
