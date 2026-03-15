import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Ensure the user has a recruiter_accounts row (create if missing).
 * Used when a user first uses the recruiter portal.
 */
export async function ensureRecruiterAccount(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data: existing } = await supabase
    .from("recruiter_accounts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()

  if (existing) return

  await supabase.from("recruiter_accounts").insert({
    user_id: userId,
  })
}

/**
 * Check if the current user has a recruiter account.
 */
export async function getRecruiterAccount(
  supabase: SupabaseClient,
  userId: string
): Promise<{ id: string; organizationName: string | null; roleTitle: string | null; focusRegions: string | null } | null> {
  const { data } = await supabase
    .from("recruiter_accounts")
    .select("id, organization_name, role_title, focus_regions")
    .eq("user_id", userId)
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id,
    organizationName: (data as { organization_name?: string }).organization_name ?? null,
    roleTitle: (data as { role_title?: string }).role_title ?? null,
    focusRegions: (data as { focus_regions?: string }).focus_regions ?? null,
  }
}
