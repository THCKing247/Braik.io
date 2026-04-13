import type { SupabaseClient } from "@supabase/supabase-js"

export type DueCollectionTargetFlags = {
  targetAll: boolean
  targetAssistantCoaches: boolean
  targetPlayers: boolean
  targetParents: boolean
}

export type ResolvedRecipient = {
  user_id: string
  role_kind: "assistant_coach" | "player" | "parent"
  player_id: string | null
}

function effectiveFlags(f: DueCollectionTargetFlags): DueCollectionTargetFlags {
  if (f.targetAll) {
    return {
      targetAll: true,
      targetAssistantCoaches: true,
      targetPlayers: true,
      targetParents: true,
    }
  }
  return { ...f, targetAll: false }
}

/**
 * Resolve distinct team users for a due collection from target flags.
 * Order: players first, then parents not yet listed, then assistant coaches — one row per user_id.
 */
export async function resolveDueCollectionRecipients(
  supabase: SupabaseClient,
  teamId: string,
  flags: DueCollectionTargetFlags
): Promise<ResolvedRecipient[]> {
  const eff = effectiveFlags(flags)
  if (!eff.targetAssistantCoaches && !eff.targetPlayers && !eff.targetParents) {
    return []
  }

  const byUser = new Map<string, ResolvedRecipient>()

  if (eff.targetPlayers) {
    const { data: players, error: pErr } = await supabase
      .from("players")
      .select("id, user_id")
      .eq("team_id", teamId)
      .eq("status", "active")
      .not("user_id", "is", null)
    if (pErr) throw new Error(pErr.message)
    for (const p of players ?? []) {
      const uid = p.user_id as string
      if (!uid) continue
      byUser.set(uid, {
        user_id: uid,
        role_kind: "player",
        player_id: p.id as string,
      })
    }
  }

  if (eff.targetParents) {
    const { data: teamPlayers, error: tpErr } = await supabase
      .from("players")
      .select("id")
      .eq("team_id", teamId)
      .eq("status", "active")
    if (tpErr) throw new Error(tpErr.message)
    const playerIds = (teamPlayers ?? []).map((r) => r.id).filter(Boolean) as string[]
    if (playerIds.length > 0) {
      const { data: links, error: lErr } = await supabase
        .from("parent_player_links")
        .select("parent_user_id, player_id")
        .in("player_id", playerIds)
      if (lErr) throw new Error(lErr.message)
      for (const l of links ?? []) {
        if (!l.parent_user_id || !l.player_id) continue
        const uid = l.parent_user_id as string
        if (!byUser.has(uid)) {
          byUser.set(uid, { user_id: uid, role_kind: "parent", player_id: null })
        }
      }
    }
  }

  if (eff.targetAssistantCoaches) {
    const { data: staff, error: sErr } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", teamId)
      .eq("role", "assistant_coach")
      .eq("active", true)
    if (sErr) throw new Error(sErr.message)
    for (const m of staff ?? []) {
      const uid = m.user_id as string
      if (!uid) continue
      if (!byUser.has(uid)) {
        byUser.set(uid, { user_id: uid, role_kind: "assistant_coach", player_id: null })
      }
    }
  }

  const resolved = Array.from(byUser.values())
  if (resolved.length === 0) return []

  // Only include IDs that exist in public.users (matches FK on fundraising_due_collection_recipients).
  // Roster/parent rows can theoretically reference UUIDs not present in users; skip those safely.
  const ids = resolved.map((r) => r.user_id)
  const { data: existingRows, error: usersErr } = await supabase.from("users").select("id").in("id", ids)
  if (usersErr) throw new Error(usersErr.message)
  const allowed = new Set((existingRows ?? []).map((u) => String((u as { id: string }).id)))
  return resolved.filter((r) => allowed.has(r.user_id))
}
