import { cookies } from "next/headers"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

export type SessionUser = {
  id: string
  email: string
  name?: string | null
  role?: string
  adminRole?: string
  teamId?: string
  teamName?: string
  organizationName?: string
  positionGroups?: string[] | null
  isPlatformOwner?: boolean
}

export type AppSession = { user: SessionUser }

/**
 * Get the current session from Supabase Auth (sb-access-token cookie).
 * Returns null if no valid session. Use in dashboard layout and protected routes.
 */
export async function getServerSession(): Promise<{ user: SessionUser } | null> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null
  }

  const accessToken = cookies().get("sb-access-token")?.value
  if (!accessToken) {
    return null
  }

  const supabase = getSupabaseServer()
  const { data: userData, error } = await supabase.auth.getUser(accessToken)
  if (error || !userData?.user?.email) {
    return null
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, team_id, full_name")
    .eq("id", userData.user.id)
    .maybeSingle()

  // Optional: load user row from public.users for adminRole if table exists
  let adminRole: string | undefined
  let isPlatformOwner = false
  const { data: appUser } = await supabase
    .from("users")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle()
  if (appUser) {
    adminRole = appUser.role
    isPlatformOwner = (appUser as { is_platform_owner?: boolean }).is_platform_owner === true
  }

  // Normalize role to uppercase so UI components (DashboardNav, QuickActionsSidebar,
  // SubscriptionGuard) that check "HEAD_COACH" etc. match correctly.
  const rawRole = profile?.role ?? "player"
  const role = rawRole.toUpperCase().replace(/ /g, "_")
  return {
    user: {
      id: userData.user.id,
      email: userData.user.email,
      name: profile?.full_name ?? userData.user.user_metadata?.full_name ?? null,
      role,
      adminRole,
      teamId: profile?.team_id ?? undefined,
      teamName: undefined,
      organizationName: undefined,
      positionGroups: null,
      isPlatformOwner,
    },
  }
}

/**
 * Alias for getServerSession (Supabase-only; no separate cookie fallback).
 */
export async function getServerSessionOrSupabase(): Promise<{ user: SessionUser } | null> {
  return getServerSession()
}
