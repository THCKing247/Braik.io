import type { SupabaseClient } from "@supabase/supabase-js"

/** Best-effort side of ball from roster position_group text (no extra roster columns). */
export function inferUnitSideFromPositionGroup(positionGroup: string | null): "offense" | "defense" | "special_teams" | null {
  const raw = (positionGroup ?? "").trim().toLowerCase()
  if (!raw) return null
  if (
    /\b(spec|special|kicker|punter|long snap|ls)\b/.test(raw) ||
    raw.includes("special team")
  ) {
    return "special_teams"
  }
  const offense =
    /\b(qb|quarterback|rb|back|wr|receiver|te|tight|ol|oline|ot|og|tackle|guard|center|fb|fullback|slot|skill)\b/.test(
      raw
    ) || raw.includes("offense")
  const defense =
    /\b(de|dt|dl|lb|backer|db|cb|corner|safety|fs|ss|nickel|dime|edge|ilb|olb|mlb)\b/.test(raw) || raw.includes("defense")
  if (offense && !defense) return "offense"
  if (defense && !offense) return "defense"
  return null
}

/** Resolve roster player ids for a study assignment target. */
export async function resolveAssignmentPlayerIds(
  supabase: SupabaseClient,
  teamId: string,
  assignedToType: "team" | "side" | "position_group" | "players",
  assignedPositionGroup: string | null,
  assignedSide: "offense" | "defense" | "special_teams" | null,
  explicitPlayerIds: string[] | null
): Promise<string[]> {
  if (assignedToType === "players" && explicitPlayerIds?.length) {
    const { data } = await supabase
      .from("players")
      .select("id")
      .eq("team_id", teamId)
      .in("id", explicitPlayerIds)
    return (data ?? []).map((r) => r.id)
  }
  if (assignedToType === "position_group" && assignedPositionGroup?.trim()) {
    const { data } = await supabase
      .from("players")
      .select("id")
      .eq("team_id", teamId)
      .eq("position_group", assignedPositionGroup.trim())
      .neq("status", "inactive")
    return (data ?? []).map((r) => r.id)
  }

  const { data: roster } = await supabase
    .from("players")
    .select("id, position_group")
    .eq("team_id", teamId)
    .neq("status", "inactive")

  const rows = roster ?? []

  if (assignedToType === "side" && assignedSide) {
    return rows
      .filter((r) => inferUnitSideFromPositionGroup(r.position_group as string | null) === assignedSide)
      .map((r) => r.id as string)
  }

  return rows.map((r) => r.id as string)
}

/** When an assignment becomes published, ensure each targeted roster player has a study_assignment_players row. */
export async function ensureStudyAssignmentPlayerRows(
  supabase: SupabaseClient,
  teamId: string,
  assignmentId: string
): Promise<void> {
  const { data: a } = await supabase
    .from("study_assignments")
    .select("assigned_to_type, assigned_position_group, assigned_side, assigned_player_ids")
    .eq("id", assignmentId)
    .eq("team_id", teamId)
    .maybeSingle()

  if (!a) return

  const explicit =
    a.assigned_to_type === "players" && Array.isArray(a.assigned_player_ids)
      ? (a.assigned_player_ids as string[])
      : null

  const playerIds = await resolveAssignmentPlayerIds(
    supabase,
    teamId,
    a.assigned_to_type as "team" | "side" | "position_group" | "players",
    (a.assigned_position_group as string | null) ?? null,
    (a.assigned_side as "offense" | "defense" | "special_teams" | null) ?? null,
    explicit
  )

  if (playerIds.length === 0) return

  const { data: existing } = await supabase
    .from("study_assignment_players")
    .select("player_id")
    .eq("assignment_id", assignmentId)

  const have = new Set((existing ?? []).map((r) => r.player_id as string))
  const missing = playerIds.filter((id) => !have.has(id))
  if (missing.length === 0) return

  await supabase.from("study_assignment_players").insert(
    missing.map((player_id) => ({
      assignment_id: assignmentId,
      player_id,
      status: "not_started" as const,
    }))
  )
}
