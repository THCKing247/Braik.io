import { createClient } from "@supabase/supabase-js"
import { getSupabaseProjectUrl, getSupabaseServiceRoleKey } from "@/src/lib/supabase-project-env"

const supabaseUrl = getSupabaseProjectUrl()
const supabaseServiceRoleKey = getSupabaseServiceRoleKey()

export const missingSupabaseAdminEnv = [
  !supabaseUrl ? "SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL" : null,
  !supabaseServiceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
].filter((value): value is string => typeof value === "string")

export const supabaseAdmin =
  missingSupabaseAdminEnv.length === 0
    ? createClient(supabaseUrl as string, supabaseServiceRoleKey as string, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null

export function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error(`Missing required environment variables: ${missingSupabaseAdminEnv.join(", ")}`)
  }
  return supabaseAdmin
}

export function hasClientSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

