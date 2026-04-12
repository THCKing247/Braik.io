import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Best-effort cleanup when secure signup fails after creating auth + DB side effects.
 * Order respects FKs: team_members and player rows before public.users.
 */
export async function cleanupSignupArtifacts(supabase: SupabaseClient, userId: string): Promise<void> {
  await supabase.from("team_members").delete().eq("user_id", userId)

  await supabase
    .from("player_invites")
    .update({
      status: "sent",
      claimed_by_user_id: null,
      claimed_at: null,
    })
    .eq("claimed_by_user_id", userId)

  const { data: selfRegRows } = await supabase
    .from("players")
    .select("id")
    .eq("user_id", userId)
    .eq("self_registered", true)

  const selfIds = (selfRegRows ?? []).map((r) => r.id as string)
  if (selfIds.length > 0) {
    await supabase.from("players").delete().in("id", selfIds)
  }

  await supabase
    .from("players")
    .update({
      user_id: null,
      claimed_at: null,
      claim_status: "unclaimed",
      invite_status: "invited",
    })
    .eq("user_id", userId)

  await supabase.from("parent_player_links").delete().eq("parent_user_id", userId)

  await supabase.from("profiles").delete().eq("id", userId)

  await supabase.from("users").delete().eq("id", userId)
}
