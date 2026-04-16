import type { SupabaseClient } from "@supabase/supabase-js"

export type PlaybookSummaryRow = {
  id: string
  teamId: string
  name: string
  visibility: string
  createdAt: string
  updatedAt: string
  formationCount: number
  playCount: number
}

/** Shared by GET /api/playbooks/summary and dashboard deferred-core bootstrap. */
export async function loadPlaybooksSummaryForTeam(
  supabase: SupabaseClient,
  teamId: string
): Promise<PlaybookSummaryRow[]> {
  const [playbooksRes, formationsRes, playsRes] = await Promise.all([
    supabase
      .from("playbooks")
      .select("id, team_id, name, visibility, created_at, updated_at")
      .eq("team_id", teamId)
      .order("name", { ascending: true }),
    supabase.from("formations").select("playbook_id").eq("team_id", teamId).not("playbook_id", "is", null),
    supabase.from("plays").select("playbook_id").eq("team_id", teamId).not("playbook_id", "is", null),
  ])

  if (playbooksRes.error) {
    console.error("[loadPlaybooksSummaryForTeam] playbooks", playbooksRes.error)
    throw new Error("Failed to load playbooks")
  }
  if (formationsRes.error) {
    console.error("[loadPlaybooksSummaryForTeam] formations", formationsRes.error)
    throw new Error("Failed to load formation counts")
  }
  if (playsRes.error) {
    console.error("[loadPlaybooksSummaryForTeam] plays", playsRes.error)
    throw new Error("Failed to load play counts")
  }

  const formationCountByPlaybook = new Map<string, number>()
  for (const row of formationsRes.data ?? []) {
    const pid = row.playbook_id as string
    if (!pid) continue
    formationCountByPlaybook.set(pid, (formationCountByPlaybook.get(pid) ?? 0) + 1)
  }

  const playCountByPlaybook = new Map<string, number>()
  for (const row of playsRes.data ?? []) {
    const pid = row.playbook_id as string
    if (!pid) continue
    playCountByPlaybook.set(pid, (playCountByPlaybook.get(pid) ?? 0) + 1)
  }

  return (playbooksRes.data ?? []).map((p) => ({
    id: p.id,
    teamId: p.team_id,
    name: p.name,
    visibility: p.visibility ?? "team",
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    formationCount: formationCountByPlaybook.get(p.id) ?? 0,
    playCount: playCountByPlaybook.get(p.id) ?? 0,
  }))
}
