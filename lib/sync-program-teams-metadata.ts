import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * When a program links to an AD organization, denormalize org/program fields onto teams
 * (sport from program; school_id / athletic_department_id from organization; roster_size from player count when still null).
 */
export async function syncProgramTeamsMetadataFromOrganization(
  supabase: SupabaseClient,
  programId: string,
  organizationId: string
): Promise<{
  preview: Record<string, unknown>
  error?: string
}> {
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id, school_id, athletic_department_id")
    .eq("id", organizationId)
    .maybeSingle()

  if (orgErr || !org) {
    return {
      preview: {},
      error: orgErr?.message ?? "organization not found",
    }
  }

  let schoolId: string | null = org.school_id ?? null
  if (!schoolId && org.athletic_department_id) {
    const { data: dept } = await supabase
      .from("athletic_departments")
      .select("school_id")
      .eq("id", org.athletic_department_id)
      .maybeSingle()
    schoolId = dept?.school_id ?? null
  }

  const { data: program, error: progErr } = await supabase
    .from("programs")
    .select("id, sport")
    .eq("id", programId)
    .maybeSingle()

  if (progErr || !program) {
    return {
      preview: {},
      error: progErr?.message ?? "program not found",
    }
  }

  const programSport = (program.sport as string) || "football"

  const { data: teamList, error: listErr } = await supabase
    .from("teams")
    .select("id")
    .eq("program_id", programId)

  if (listErr) {
    return { preview: {}, error: listErr.message }
  }

  const teamIds = (teamList ?? []).map((t) => t.id).filter(Boolean) as string[]

  const { error: eSport } = await supabase
    .from("teams")
    .update({ sport: programSport })
    .eq("program_id", programId)
    .is("sport", null)

  const { error: eSchool } = schoolId
    ? await supabase.from("teams").update({ school_id: schoolId }).eq("program_id", programId).is("school_id", null)
    : { error: null }

  const { error: eDept } = org.athletic_department_id
    ? await supabase
        .from("teams")
        .update({ athletic_department_id: org.athletic_department_id })
        .eq("program_id", programId)
        .is("athletic_department_id", null)
    : { error: null }

  let rosterUpdates = 0
  if (teamIds.length > 0) {
    const { data: playerRows } = await supabase.from("players").select("team_id").in("team_id", teamIds)
    const counts = new Map<string, number>()
    for (const row of playerRows ?? []) {
      const tid = row.team_id as string
      if (!tid) continue
      counts.set(tid, (counts.get(tid) ?? 0) + 1)
    }
    for (const [teamId, n] of counts) {
      const { error: ru } = await supabase.from("teams").update({ roster_size: n }).eq("id", teamId).is("roster_size", null)
      if (!ru) rosterUpdates += 1
    }
  }

  const preview = {
    programId,
    organizationId,
    schoolId,
    athletic_department_id: org.athletic_department_id,
    sport: programSport,
    teamCount: teamIds.length,
    updateErrors: {
      sport: eSport?.message ?? null,
      school: eSchool?.message ?? null,
      athletic_department: eDept?.message ?? null,
    },
    rosterSizeBackfills: rosterUpdates,
  }

  console.info("[sync-program-teams-metadata]", JSON.stringify(preview))

  return { preview }
}
