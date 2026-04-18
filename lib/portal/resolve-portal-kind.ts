import type { SupabaseClient } from "@supabase/supabase-js"
import type { BraikPortalKind } from "@/lib/portal/braik-portal-kind"

export type ResolvePortalKindInput = {
  supabase: SupabaseClient
  userId: string
  /** Already normalized upper snake (e.g. HEAD_COACH, PLAYER). */
  profileRoleUpper: string
}

/**
 * Server-side portal resolution for dashboard shell + entry redirects.
 */
export async function resolveBraikPortalKind(input: ResolvePortalKindInput): Promise<BraikPortalKind> {
  const role = input.profileRoleUpper.trim().toUpperCase()

  if (role === "PLAYER" || role === "ATHLETE") return "player"
  if (role === "PARENT") return "parent"

  if (
    role === "HEAD_COACH" ||
    role === "ASSISTANT_COACH" ||
    role === "ATHLETIC_DIRECTOR" ||
    role === "SCHOOL_ADMIN"
  ) {
    return "coach"
  }

  const { data: recruiter } = await input.supabase
    .from("recruiter_accounts")
    .select("id")
    .eq("user_id", input.userId)
    .maybeSingle()

  if (recruiter) return "recruiter"

  return "coach"
}
